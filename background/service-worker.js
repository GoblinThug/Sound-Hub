/**
 * SoundHub service worker — offscreen host, tab autostart, and MV3 API bridge.
 */
importScripts('../shared/domain-filter.js');

const OFFSCREEN_URL = 'offscreen/offscreen.html';
const DOMAIN_FILTER_KEY = SoundHubDomainFilter.STORAGE_KEY;
const STOPPED_HOSTS_KEY = 'USER_STOPPED_HOSTS';
/** tabId → hostname where the user manually stopped EQ */
const userStoppedHosts = new Map();
const autoEqInFlight = new Set();
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

function getFilterConfig() {
  return new Promise((resolve) => {
    SoundHubDomainFilter.getFilter(resolve);
  });
}

function getMediaStreamIdForTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) {
        console.warn('Auto EQ: tabCapture failed', chrome.runtime.lastError);
        resolve(null);
        return;
      }
      resolve(streamId);
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTabActive(tabId) {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    return !!(tabs && tabs[0] && tabs[0].id === tabId);
  });
}

function tabSnapshot(tab) {
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
  };
}

async function startEqForTab(tab) {
  if (!stoppedHostsLoaded) await loadStoppedHosts();
  if (!tab || typeof tab.id !== 'number') return;
  if (!isBrowsableUrl(tab.url)) return;
  if (isStoppedOnCurrentDomain(tab)) return;
  if (autoEqInFlight.has(tab.id)) return;

  const filter = await getFilterConfig();
  if (!SoundHubDomainFilter.shouldAutoEnable(tab.url, filter)) return;

  autoEqInFlight.add(tab.id);
  try {
    const ok = await ensureAudioHost();
    if (!ok) return;

    await wait(350);

    const stillActive = await isTabActive(tab.id);
    if (!stillActive) return;

    const freshTab = (await getTab(tab.id)) || tab;
    if (!isBrowsableUrl(freshTab.url)) return;
    if (isStoppedOnCurrentDomain(freshTab)) return;
    if (!SoundHubDomainFilter.shouldAutoEnable(freshTab.url, filter)) return;

    const streamId = await getMediaStreamIdForTab(freshTab.id);
    if (!streamId) {
      chrome.runtime.sendMessage({ type: 'eqTab', on: true, tabId: freshTab.id, auto: true }, () => {
        void chrome.runtime.lastError;
      });
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: 'attachTabCapture',
        tabId: freshTab.id,
        streamId,
        tab: tabSnapshot(freshTab),
      },
      () => {
        void chrome.runtime.lastError;
      }
    );
  } finally {
    autoEqInFlight.delete(tab.id);
  }
}

const autoEqTimers = new Map();

function scheduleAutoEnableEq(tabId, delayMs) {
  clearTimeout(autoEqTimers.get(tabId));
  autoEqTimers.set(
    tabId,
    setTimeout(() => {
      autoEqTimers.delete(tabId);
      getTab(tabId).then((tab) => {
        if (tab && tab.active) startEqForTab(tab);
      });
    }, delayMs)
  );
}

function tryAutoEnableActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) startEqForTab(tabs[0]);
  });
}

function syncEqWithDomainFilter(filter) {
  const cfg = SoundHubDomainFilter.sanitizeFilter(filter);
  userStoppedHosts.clear();
  persistStoppedHosts();
  ensureAudioHost().then(async (ok) => {
    if (!ok) return;
    // Offscreen may need a brief moment after wake/create.
    await wait(120);
    chrome.runtime.sendMessage({ type: 'syncDomainFilter', filter: cfg }, () => {
      void chrome.runtime.lastError;
      // Only auto-start when the active tab matches the new mode.
      tryAutoEnableActiveTab();
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return;
  }
  if (message.type === 'eqTab') {
    if (message.on === false) {
      if (message.reason !== 'filter') {
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
    if (message.reason !== 'filter') {
      markUserStoppedTab(message.tab.id, message.tab.url);
    }
  }
  if (message.type === 'syncDomainFilterNow') {
    syncEqWithDomainFilter(message.filter);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'tryAutoEq') {
    loadStoppedHosts().then(() => {
      tryAutoEnableActiveTab();
      sendResponse({ ok: true });
    });
    return true;
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
    autoEqInFlight.delete(tabId);
    clearTimeout(autoEqTimers.get(tabId));
    autoEqTimers.delete(tabId);
  });
}

if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      clearStopIfDomainChanged(tabId, changeInfo.url);
      scheduleAutoEnableEq(tabId, 250);
      return;
    }
    if (changeInfo.status === 'complete') {
      scheduleAutoEnableEq(tabId, 350);
    }
  });
}

if (chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    scheduleAutoEnableEq(activeInfo.tabId, 200);
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
  if (area === 'sync' && changes[DOMAIN_FILTER_KEY]) {
    syncEqWithDomainFilter(changes[DOMAIN_FILTER_KEY].newValue);
  }
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
