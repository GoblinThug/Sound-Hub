/**
 * SoundHub service worker — offscreen host, page EQ bridge, and MV3 API.
 */
importScripts('../shared/domain-filter.js');

const OFFSCREEN_URL = 'offscreen/offscreen.html';
const STOPPED_HOSTS_KEY = 'USER_STOPPED_HOSTS';
/** tabId → hostname where the user manually stopped EQ */
const userStoppedHosts = new Map();
/** tabId → tab snapshot for in-page (element) EQ */
const pageEqByTab = new Map();
const EQ_FORWARD_TYPES = new Set([
  'modifyFilter',
  'modifyGain',
  'resetFilters',
  'resetFilter',
]);
const EQ_SNAPSHOT_TYPES = new Set(['preset', 'resetFilters', 'importPresets']);
const NO_STOP_LOCK_REASONS = new Set(['filter', 'navigation', 'replace']);
/** tabIds mid-reload — ignore stale tabCapture until page EQ restarts */
const tabReloading = new Set();
let stoppedHostsLoaded = false;
let creatingOffscreen = null;
let creatingHostWindow = null;
let hostWindowId = null;
let creatingHostTab = null;
let hostTabId = null;

async function hasOffscreenDocument() {
  if (!chrome.runtime.getContexts) {
    return false;
  }
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)]
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen || !chrome.offscreen.createDocument) {
    return false;
  }
  if (creatingOffscreen) {
    await creatingOffscreen;
    return true;
  }
  if (await hasOffscreenDocument()) {
    return true;
  }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA', 'LOCAL_STORAGE'],
    justification: 'Process captured tab audio for EQ and persist settings.'
  });
  try {
    await creatingOffscreen;
    return true;
  } catch (err) {
    console.warn('Failed to create offscreen document:', err);
    return false;
  } finally {
    creatingOffscreen = null;
  }
}

function getWindow(windowId) {
  return new Promise((resolve) => {
    chrome.windows.get(windowId, null, (win) => resolve(win || null));
  });
}

async function ensureHostWindow() {
  if (!chrome.windows || !chrome.windows.create) {
    return false;
  }
  if (creatingHostWindow) {
    await creatingHostWindow;
    return !!hostWindowId;
  }
  if (hostWindowId !== null) {
    const existing = await getWindow(hostWindowId);
    if (existing) {
      return true;
    }
    hostWindowId = null;
  }

  const url = chrome.runtime.getURL(OFFSCREEN_URL);
  creatingHostWindow = new Promise((resolve) => {
    chrome.windows.create(
      {
        url: url,
        type: 'popup',
        focused: false,
        width: 1,
        height: 1,
        left: -10000,
        top: -10000,
        state: 'minimized'
      },
      (win) => {
        if (win && typeof win.id === 'number') {
          hostWindowId = win.id;
        }
        resolve();
      }
    );
  });
  await creatingHostWindow;
  creatingHostWindow = null;
  return !!hostWindowId;
}

function getTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => resolve(tab || null));
  });
}

async function ensureHostTab() {
  if (!chrome.tabs || !chrome.tabs.create) {
    return false;
  }
  if (creatingHostTab) {
    await creatingHostTab;
    return !!hostTabId;
  }
  if (hostTabId !== null) {
    const existing = await getTab(hostTabId);
    if (existing) {
      return true;
    }
    hostTabId = null;
  }

  const url = chrome.runtime.getURL(OFFSCREEN_URL);
  creatingHostTab = new Promise((resolve) => {
    chrome.tabs.create(
      {
        url: url,
        active: false,
        pinned: true
      },
      (tab) => {
        if (tab && typeof tab.id === 'number') {
          hostTabId = tab.id;
        }
        resolve();
      }
    );
  });
  await creatingHostTab;
  creatingHostTab = null;
  return !!hostTabId;
}

async function ensureAudioHost() {
  const offscreenOk = await ensureOffscreenDocument();
  if (offscreenOk) {
    return true;
  }
  const windowOk = await ensureHostWindow();
  if (windowOk) {
    return true;
  }
  return await ensureHostTab();
}

function wrapCallback(result) {
  const err = chrome.runtime.lastError;
  if (err) {
    return { error: err.message };
  }
  return { data: result };
}

async function handleBridgeMessage(message) {
  const payload = (message && message.payload) || {};
  switch (message.type) {
    case 'storage.sync.get':
      return await new Promise((resolve) => {
        chrome.storage.sync.get(payload.keys ?? null, (items) => {
          resolve(wrapCallback(items));
        });
      });
    case 'storage.sync.set':
      return await new Promise((resolve) => {
        chrome.storage.sync.set(payload.items || {}, () => {
          resolve(wrapCallback(true));
        });
      });
    case 'storage.sync.remove':
      return await new Promise((resolve) => {
        chrome.storage.sync.remove(payload.keys ?? null, () => {
          resolve(wrapCallback(true));
        });
      });
    case 'tabs.query':
      try {
        return { data: await chrome.tabs.query(payload.queryInfo || {}) };
      } catch (err) {
        return { error: err && err.message };
      }
    case 'tabs.getSelected':
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return { data: tabs[0] || null };
      } catch (err) {
        return { error: err && err.message };
      }
    case 'tabs.get':
      try {
        return { data: await getTab(payload.tabId) };
      } catch (err) {
        return { error: err && err.message };
      }
    case 'windows.get':
      return await new Promise((resolve) => {
        chrome.windows.get(payload.windowId, payload.getInfo || null, (win) => {
          resolve(wrapCallback(win));
        });
      });
    case 'windows.update':
      return await new Promise((resolve) => {
        chrome.windows.update(payload.windowId, payload.updateInfo || {}, (win) => {
          resolve(wrapCallback(win));
        });
      });
    case 'tabCapture.getMediaStreamId': {
      const options = payload.options || {};
      let targetTabId = options.targetTabId;
      if (typeof targetTabId !== 'number') {
        targetTabId = Number(targetTabId);
      }
      if (!Number.isFinite(targetTabId)) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          targetTabId = tabs && tabs[0] && tabs[0].id;
        } catch (_) {
          targetTabId = null;
        }
      }
      if (typeof targetTabId !== 'number') {
        return { error: 'No target tab for capture' };
      }
      try {
        const tab = await getTab(targetTabId);
        if (!tab || !isBrowsableUrl(tab.url)) {
          return { error: 'Tab cannot be captured' };
        }
      } catch (_) {
        return { error: 'Tab cannot be captured' };
      }
      const getOptions = { targetTabId: targetTabId };
      if (typeof options.consumerTabId === 'number') {
        getOptions.consumerTabId = options.consumerTabId;
      }
      return await new Promise((resolve) => {
        chrome.tabCapture.getMediaStreamId(getOptions, (streamId) => {
          const result = wrapCallback(streamId);
          if (result.error) {
            resolve(result);
          } else if (!streamId) {
            resolve({ error: 'No media stream id' });
          } else {
            resolve({ data: { streamId: streamId } });
          }
        });
      });
    }
    default:
      return { error: 'Unknown bridge message: ' + message.type };
  }
}

function isBrowsableUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('about:') &&
    !url.startsWith('edge://')
  );
}

function persistStoppedHosts() {
  const obj = {};
  userStoppedHosts.forEach((host, tabId) => {
    obj[String(tabId)] = host;
  });
  if (chrome.storage && chrome.storage.session) {
    chrome.storage.session.set({ [STOPPED_HOSTS_KEY]: obj });
  }
}

function loadStoppedHosts() {
  return new Promise((resolve) => {
    if (!chrome.storage || !chrome.storage.session) {
      stoppedHostsLoaded = true;
      resolve();
      return;
    }
    chrome.storage.session.get(STOPPED_HOSTS_KEY, (data) => {
      const raw = (data && data[STOPPED_HOSTS_KEY]) || {};
      userStoppedHosts.clear();
      Object.keys(raw).forEach((key) => {
        const tabId = Number(key);
        if (Number.isFinite(tabId) && raw[key]) {
          userStoppedHosts.set(tabId, raw[key]);
        }
      });
      stoppedHostsLoaded = true;
      resolve();
    });
  });
}

function markUserStoppedTab(tabId, url) {
  if (typeof tabId !== 'number') return;
  const host = SoundHubDomainFilter.hostnameFromUrl(url);
  if (!host) return;
  userStoppedHosts.set(tabId, host);
  persistStoppedHosts();
}

function clearUserStoppedTab(tabId) {
  if (typeof tabId !== 'number') return;
  if (userStoppedHosts.delete(tabId)) persistStoppedHosts();
}

function markUserStoppedActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) markUserStoppedTab(tabs[0].id, tabs[0].url);
  });
}

/** Stay off only while still on the domain where the user pressed Stop. */
function isStoppedOnCurrentDomain(tab) {
  if (!tab || typeof tab.id !== 'number') return false;
  const stoppedHost = userStoppedHosts.get(tab.id);
  if (!stoppedHost) return false;
  const currentHost = SoundHubDomainFilter.hostnameFromUrl(tab.url);
  if (!currentHost) return true;
  if (currentHost !== stoppedHost) {
    userStoppedHosts.delete(tab.id);
    persistStoppedHosts();
    return false;
  }
  return true;
}

function clearStopIfDomainChanged(tabId, url) {
  const stoppedHost = userStoppedHosts.get(tabId);
  if (!stoppedHost) return false;
  const host = SoundHubDomainFilter.hostnameFromUrl(url);
  if (host && host !== stoppedHost) {
    userStoppedHosts.delete(tabId);
    persistStoppedHosts();
    return true;
  }
  return false;
}

function runtimeSend(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      void chrome.runtime.lastError;
      resolve(response);
    });
  });
}

function getEqSnapshot() {
  const attempt = (left) =>
    runtimeSend({ type: 'getEqSnapshot' }).then((res) => {
      if (res && res.ok) {
        return { filters: res.filters || [], gain: res.gain != null ? res.gain : 1 };
      }
      if (left <= 0) return { filters: [], gain: 1 };
      return wait(60).then(() => attempt(left - 1));
    });
  return attempt(5);
}

function injectPageEq(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    return Promise.resolve(false);
  }
  // Main frame only: YouTube's player video lives there. Main-world engine
  // survives extension reloads so we never re-bind the same <video>.
  return chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['content/page-eq-main.js'],
    })
    .then(() =>
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'ISOLATED',
        files: ['content/page-eq.js'],
      })
    )
    .then(() => true)
    .catch((err) => {
      console.warn('SoundHub: page EQ inject failed', err);
      return false;
    });
}

function startPageEqInTab(tabId, snapshot, options) {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    return Promise.resolve({ ok: false, reason: 'no_scripting' });
  }
  const startOpts = options || { fast: true };
  return chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: async (state, opts) => {
        const api = globalThis.__soundhubPageEq;
        if (!api || typeof api.start !== 'function') {
          return { ok: false, reason: 'not_injected' };
        }
        try {
          return await api.start(state, opts);
        } catch (err) {
          return { ok: false, reason: String(err && err.message ? err.message : err) };
        }
      },
      args: [snapshot || { filters: [], gain: 1 }, startOpts],
    })
    .then((results) => {
      const result = results && results[0] && results[0].result;
      return result || { ok: false, reason: 'no_media' };
    })
    .catch((err) => {
      console.warn('SoundHub: page EQ start failed', err);
      return { ok: false, reason: 'inject_error' };
    });
}

function stopPageEqInTab(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    pageEqByTab.delete(tabId);
    return Promise.resolve();
  }
  return chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: async () => {
        const api = globalThis.__soundhubPageEq;
        if (api && typeof api.stop === 'function') return api.stop();
        return { ok: true };
      },
    })
    .catch(() => null)
    .finally(() => {
      pageEqByTab.delete(tabId);
    });
}

function forwardToPageEqTabs(message) {
  if (!pageEqByTab.size) return;
  for (const tabId of pageEqByTab.keys()) {
    chrome.tabs.sendMessage(tabId, message, () => {
      void chrome.runtime.lastError;
    });
  }
}

function pushSnapshotToPageEqTabs() {
  if (!pageEqByTab.size) return;
  getEqSnapshot().then((snap) => {
    forwardToPageEqTabs({
      type: 'pageEq.applySnapshot',
      filters: snap.filters,
      gain: snap.gain,
    });
  });
}

function notifyPageEqStatus(tab, streaming) {
  const payload = {
    type: 'sendCurrentTabStatus',
    streaming: !!streaming,
    path: streaming ? 'element' : null,
  };
  if (tab && tab.url && typeof SoundHubDomainFilter !== 'undefined') {
    SoundHubDomainFilter.getFilter((filter) => {
      payload.domainAllowed = SoundHubDomainFilter.isAllowedForUrl(tab.url, filter);
      payload.hostname = SoundHubDomainFilter.hostnameFromUrl(tab.url);
      chrome.runtime.sendMessage(payload, () => {
        void chrome.runtime.lastError;
      });
    });
  } else {
    chrome.runtime.sendMessage(payload, () => {
      void chrome.runtime.lastError;
    });
  }
}

function getPageEqStreams() {
  return Array.from(pageEqByTab.values());
}

async function queryPageEqActive(tabId) {
  if (typeof tabId !== 'number') return false;
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'pageEq.ping' }, (res) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(!!(res && res.active));
    });
  });
}

async function isCaptureActiveOnTab(tabId) {
  const res = await runtimeSend({ type: 'getTabCaptureStatus', tabId });
  return !!(res && res.streaming);
}

async function isEqActiveOnTab(tab) {
  if (!tab || typeof tab.id !== 'number') return false;

  // After F5 the offscreen capture entry may still exist for this tabId even
  // though the page document (and page EQ) was destroyed.
  if (tabReloading.has(tab.id)) {
    const pageActive = await queryPageEqActive(tab.id);
    if (pageActive) {
      tabReloading.delete(tab.id);
      pageEqByTab.set(tab.id, tabSnapshot(tab));
    }
    return pageActive;
  }

  if (pageEqByTab.has(tab.id)) return true;
  if (await isCaptureActiveOnTab(tab.id)) return true;
  const pageActive = await queryPageEqActive(tab.id);
  if (pageActive) {
    pageEqByTab.set(tab.id, tabSnapshot(tab));
  }
  return pageActive;
}

async function refreshPageEqRegistry(tab) {
  if (!tab || typeof tab.id !== 'number') return false;
  if (pageEqByTab.has(tab.id)) return true;
  const pageActive = await queryPageEqActive(tab.id);
  if (pageActive) {
    pageEqByTab.set(tab.id, tabSnapshot(tab));
  }
  return pageActive;
}

function startPageEqViaMessage(tabId, snapshot, options) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: 'pageEq.start',
        snapshot: snapshot || { filters: [], gain: 1 },
        options: options || {},
      },
      (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(res);
      }
    );
  });
}

function pageHasMedia(tabId) {
  const probe = () =>
    new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'pageEq.probe' }, (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(!!(res && res.hasMedia));
      });
    });

  return probe().then(async (result) => {
    if (result === null) {
      await injectPageEq(tabId);
      result = await probe();
    }
    return result === true;
  });
}

async function tryStartPageEq(tab, options) {
  if (!tab || typeof tab.id !== 'number') return false;
  if (!isBrowsableUrl(tab.url)) return false;

  options = options || {};
  const startOpts = { fast: options.fast !== false };

  if (!options.forcePageEq) {
    const hasMedia = await pageHasMedia(tab.id);
    if (!hasMedia) return false;
  }

  const snapshot = await getEqSnapshot();

  let result = await startPageEqViaMessage(tab.id, snapshot, startOpts);
  if (!result || !result.ok) {
    await injectPageEq(tab.id);
    result = await startPageEqViaMessage(tab.id, snapshot, startOpts);
  }
  if (!result || !result.ok) {
    result = await startPageEqInTab(tab.id, snapshot, startOpts);
  }
  if (!result || !result.ok) return false;

  pageEqByTab.set(tab.id, tabSnapshot(tab));
  tabReloading.delete(tab.id);
  notifyPageEqStatus(tab, true);
  return true;
}

async function stopEqOnTab(tabId, tabUrl, reason) {
  if (pageEqByTab.has(tabId)) {
    const tab = pageEqByTab.get(tabId) || { id: tabId, url: tabUrl };
    await stopPageEqInTab(tabId);
    notifyPageEqStatus(tab, false);
  }
  await disconnectCaptureForTab(tabId, tabUrl, reason);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tabSnapshot(tab) {
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
  };
}

function disconnectCaptureForTab(tabId, url, reason) {
  return runtimeSend({
    type: 'disconnectTab',
    tab: { id: tabId, url: url || '' },
    reason: reason || 'navigation',
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return;
  }

  if (EQ_FORWARD_TYPES.has(message.type)) {
    forwardToPageEqTabs(message);
  }
  if (EQ_SNAPSHOT_TYPES.has(message.type)) {
    setTimeout(pushSnapshotToPageEqTabs, 150);
  }

  if (message.type === 'getPageEqStreams') {
    sendResponse({ streams: getPageEqStreams() });
    return true;
  }

  if (message.type === 'getPageEqActive') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab) {
        sendResponse({ active: false });
        return;
      }
      const capture = await isCaptureActiveOnTab(tab.id);
      const page = pageEqByTab.has(tab.id) || (await refreshPageEqRegistry(tab));
      sendResponse({ active: !!(page || capture), path: page ? 'element' : capture ? 'capture' : null });
    });
    return true;
  }

  if (message.type === 'getCurrentTabEqStatus') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab) {
        sendResponse({ streaming: false });
        return;
      }
      const capture = await isCaptureActiveOnTab(tab.id);
      const page = pageEqByTab.has(tab.id) || (await refreshPageEqRegistry(tab));
      const streaming = !!(page || capture);
      const payload = { streaming, path: page ? 'element' : capture ? 'capture' : null };
      SoundHubDomainFilter.getFilter((filter) => {
        payload.domainAllowed = SoundHubDomainFilter.isAllowedForUrl(tab.url, filter);
        payload.hostname = SoundHubDomainFilter.hostnameFromUrl(tab.url);
        sendResponse(payload);
      });
    });
    return true;
  }

  if (message.type === 'getEqFFT') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs && tabs[0];
      if (tab && pageEqByTab.has(tab.id) && chrome.scripting) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'ISOLATED',
            func: async () => {
              const api = globalThis.__soundhubPageEq;
              if (!api || !api.isActiveAsync || !api.getFftAsync) return null;
              const active = await api.isActiveAsync();
              if (!active) return null;
              return api.getFftAsync();
            },
          });
          const fft = results && results[0] && results[0].result;
          sendResponse({ type: 'fft', fft: Array.isArray(fft) ? fft : null });
        } catch (_) {
          sendResponse({ type: 'fft', fft: null });
        }
        return;
      }
      chrome.runtime.sendMessage({ type: 'getFFT' }, (res) => {
        void chrome.runtime.lastError;
        sendResponse(res || { type: 'fft', fft: null });
      });
    });
    return true;
  }

  if (message.type === 'startPageEq') {
    const tabId = message.tabId;
    getTab(tabId).then(async (tab) => {
      if (!tab) {
        sendResponse({ ok: false });
        return;
      }
      if (message.reason === 'user') {
        clearUserStoppedTab(tab.id);
      }
      await disconnectCaptureForTab(tab.id, tab.url, 'replace');
      await ensureAudioHost();
      const ok = await tryStartPageEq(tab, { fast: true });
      sendResponse({ ok: !!ok, path: ok ? 'element' : null });
    });
    return true;
  }

  if (message.type === 'stopPageEq') {
    const tabId = message.tabId;
    if (typeof tabId === 'number' && pageEqByTab.has(tabId)) {
      const tab = pageEqByTab.get(tabId);
      stopPageEqInTab(tabId).then(() => {
        notifyPageEqStatus(tab, false);
        sendResponse({ ok: true });
      });
      return true;
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'eqTab') {
    if (message.on === false) {
      if (typeof message.tabId === 'number' && pageEqByTab.has(message.tabId)) {
        const tab = pageEqByTab.get(message.tabId);
        stopPageEqInTab(message.tabId).then(() => {
          if (tab) notifyPageEqStatus(tab, false);
        });
      } else if (typeof message.tabId !== 'number') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && pageEqByTab.has(tabs[0].id)) {
            const tab = pageEqByTab.get(tabs[0].id);
            stopPageEqInTab(tabs[0].id).then(() => {
              if (tab) notifyPageEqStatus(tab, false);
            });
          }
        });
      }
      if (message.reason !== 'filter' && !NO_STOP_LOCK_REASONS.has(message.reason)) {
        if (typeof message.tabId === 'number') {
          markUserStoppedTab(message.tabId, message.tabUrl);
        } else {
          markUserStoppedActiveTab();
        }
      }
    } else if (message.on === true && message.reason === 'user') {
      // Manual start clears the stop-lock for this tab.
      if (typeof message.tabId === 'number') {
        clearUserStoppedTab(message.tabId);
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) clearUserStoppedTab(tabs[0].id);
        });
      }
    }
  }
  if (message.type === 'attachTabCapture' && message.reason === 'user') {
    if (typeof message.tabId === 'number') {
      clearUserStoppedTab(message.tabId);
    }
  }
  if (message.type === 'disconnectTab' && message.tab && typeof message.tab.id === 'number') {
    if (pageEqByTab.has(message.tab.id)) {
      stopPageEqInTab(message.tab.id);
    }
    if (!NO_STOP_LOCK_REASONS.has(message.reason)) {
      markUserStoppedTab(message.tab.id, message.tab.url);
    }
  }
  if (message.type === 'ensureOffscreen') {
    ensureAudioHost().then((ok) => sendResponse({ ok: !!ok }));
    return true;
  }
  if (message.__soundhubBridge) {
    handleBridgeMessage(message).then(sendResponse);
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  ensureOffscreenDocument();
  loadStoppedHosts();
});

chrome.runtime.onStartup.addListener(() => {
  ensureOffscreenDocument();
  loadStoppedHosts();
});

loadStoppedHosts();

if (chrome.windows && chrome.windows.onRemoved) {
  chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === hostWindowId) {
      hostWindowId = null;
    }
  });
}

if (chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === hostTabId) {
      hostTabId = null;
    }
    userStoppedHosts.delete(tabId);
    pageEqByTab.delete(tabId);
    tabReloading.delete(tabId);
  });
}

if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      tabReloading.add(tabId);
      pageEqByTab.delete(tabId);
      disconnectCaptureForTab(tabId, changeInfo.url || '', 'navigation');
      return;
    }
    if (changeInfo.url) {
      clearStopIfDomainChanged(tabId, changeInfo.url);
      tabReloading.add(tabId);
      pageEqByTab.delete(tabId);
      disconnectCaptureForTab(tabId, changeInfo.url, 'navigation');
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  chrome.runtime.sendMessage(
    {
      __soundhubBridgeEvent: 'storage.onChanged',
      payload: changes,
      area: area
    },
    () => {
      void chrome.runtime.lastError;
    }
  );
});

chrome.tabCapture.onStatusChanged.addListener((status) => {
  chrome.runtime.sendMessage(
    {
      __soundhubBridgeEvent: 'tabCapture.onStatusChanged',
      payload: status
    },
    () => {
      void chrome.runtime.lastError;
    }
  );
});
