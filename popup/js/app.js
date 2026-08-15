/**
 * SoundHub popup controller — presets, tabs, EQ canvas bridge.
 */
(function () {
  const SHOW_VIZ_KEY = 'SHOW_VISUALIZER';
  const LAST_TAB_KEY = 'last-tab';

  let hostReady = null;
  const rawSend = chrome.runtime.sendMessage.bind(chrome.runtime);
  let eqView = null;
  let vizTimer = null;
  let lastFftAt = 0;
  let waitingWorkspace = true;
  let eqStreaming = false;
  let currentDomainAllowed = true;
  let eqBusy = false;
  let eqDesired = null; // null | true | false while a user toggle is in flight
  let eqBusyTimer = null;

  function ensureOffscreen() {
    if (hostReady) return hostReady;
    hostReady = new Promise((resolve) => {
      rawSend({ type: 'ensureOffscreen' }, (response) => {
        // Touch lastError so Chrome does not log an unchecked warning.
        const err = chrome.runtime.lastError;
        if (err || (response && response.ok === false)) {
          console.warn('SoundHub: audio host not ready', err || response);
        }
        resolve();
      });
    });
    return hostReady;
  }

  function sendMessage(msg, cb) {
    ensureOffscreen().then(() => {
      if (typeof cb !== 'function') {
        // Fire-and-forget: do not pass a callback (avoids "message port closed" warnings).
        try {
          rawSend(msg);
        } catch (_) {}
        return;
      }
      rawSend(msg, (response) => {
        void chrome.runtime.lastError;
        cb(response);
      });
    });
  }

  function requestRefresh() {
    sendMessage({ type: 'getFullRefresh' });
  }

  function showVisualizer() {
    return localStorage[SHOW_VIZ_KEY] == true;
  }

  function syncVisualizerState() {
    syncVizButton();
    if (eqView) eqView.setShowVisualizer(showVisualizer());
    pollFft();
  }

  function toggleVisualizer() {
    localStorage[SHOW_VIZ_KEY] ^= true;
    syncVisualizerState();
  }

  function syncVizButton() {
    const btn = document.getElementById('vizButton');
    if (btn) btn.classList.toggle('on', showVisualizer());
    const settingsToggle = document.getElementById('settingsSpectrumToggle');
    if (settingsToggle) settingsToggle.checked = showVisualizer();
  }

  function t(key, vars) {
    return window.SoundHubI18n ? window.SoundHubI18n.t(key, vars) : key;
  }

  function closeSettingsPanel() {
    const panel = document.getElementById('settingsPanel');
    const btn = document.getElementById('settingsButton');
    if (!panel || !btn) return;
    panel.hidden = true;
    btn.classList.remove('is-active');
    btn.setAttribute('aria-expanded', 'false');
  }

  function syncThemePicker() {
    const picker = document.getElementById('settingsThemePicker');
    if (!picker || !window.SoundHubThemes) return;
    const active = window.SoundHubThemes.getStoredThemeId();
    picker.querySelectorAll('.theme-swatch').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.themeId === active);
      el.setAttribute('aria-checked', el.dataset.themeId === active ? 'true' : 'false');
    });
  }

  function buildThemePicker(root) {
    root.innerHTML = '';
    window.SoundHubThemes.list.forEach((theme) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-swatch';
      btn.dataset.themeId = theme.id;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', theme.name);
      btn.setAttribute('aria-checked', 'false');

      const colors = document.createElement('span');
      colors.className = 'theme-swatch-colors';
      theme.swatch.forEach((hex) => {
        const chip = document.createElement('span');
        chip.style.background = hex;
        colors.appendChild(chip);
      });

      const name = document.createElement('span');
      name.className = 'theme-swatch-name';
      name.textContent = theme.name;

      btn.appendChild(colors);
      btn.appendChild(name);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.SoundHubThemes.applyTheme(theme.id);
        syncThemePicker();
      });
      root.appendChild(btn);
    });
    syncThemePicker();
  }

  function syncLangPicker() {
    const picker = document.getElementById('settingsLangPicker');
    if (!picker || !window.SoundHubI18n) return;
    const active = window.SoundHubI18n.getLang();
    picker.querySelectorAll('.lang-option').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.langId === active);
      el.setAttribute('aria-checked', el.dataset.langId === active ? 'true' : 'false');
    });
  }

  function buildLangPicker(root) {
    root.innerHTML = '';
    window.SoundHubI18n.LANGS.forEach((lang) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-option';
      btn.dataset.langId = lang.id;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', lang.label);

      const short = document.createElement('span');
      short.className = 'lang-option-short';
      short.textContent = lang.short;

      const name = document.createElement('span');
      name.textContent = lang.label;

      btn.appendChild(short);
      btn.appendChild(name);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.SoundHubI18n.setLang(lang.id);
        syncLangPicker();
      });
      root.appendChild(btn);
    });
    syncLangPicker();
  }

  function bindSettings() {
    const btn = document.getElementById('settingsButton');
    const panel = document.getElementById('settingsPanel');
    const spectrumToggle = document.getElementById('settingsSpectrumToggle');
    const themePicker = document.getElementById('settingsThemePicker');
    const langPicker = document.getElementById('settingsLangPicker');
    const versionEl = document.getElementById('settingsVersion');
    if (!btn || !panel) return;

    if (versionEl) {
      try {
        versionEl.textContent = chrome.runtime.getManifest().version;
      } catch (_) {
        versionEl.textContent = '—';
      }
    }

    if (spectrumToggle) {
      spectrumToggle.checked = showVisualizer();
      spectrumToggle.addEventListener('change', () => {
        const on = showVisualizer();
        if (spectrumToggle.checked !== on) toggleVisualizer();
      });
    }

    if (themePicker && window.SoundHubThemes) {
      buildThemePicker(themePicker);
    }

    if (langPicker && window.SoundHubI18n) {
      buildLangPicker(langPicker);
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = panel.hidden;
      closeSettingsPanel();
      if (willOpen) {
        panel.hidden = false;
        btn.classList.add('is-active');
        btn.setAttribute('aria-expanded', 'true');
        if (spectrumToggle) spectrumToggle.checked = showVisualizer();
        syncThemePicker();
        syncLangPicker();
      }
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    document.getElementById('settingsGuideButton')?.addEventListener('click', () => {
      const guideTab = document.getElementById('tab-2');
      if (guideTab) guideTab.checked = true;
      closeSettingsPanel();
    });

    document.addEventListener('click', closeSettingsPanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSettingsPanel();
    });
  }

  function pollFft() {
    if (vizTimer) {
      clearTimeout(vizTimer);
      vizTimer = null;
    }
    if (!showVisualizer() || !eqStreaming) {
      return;
    }
    const minGap = 1000 / 30;
    const wait = minGap - (performance.now() - lastFftAt);
    if (wait > 0) {
      vizTimer = setTimeout(pollFft, wait);
      return;
    }
    sendMessage({ type: 'getFFT' }, onFft);
  }

  function onFft(msg) {
    if (!showVisualizer() || !eqStreaming) {
      return;
    }
    if (!msg || !msg.fft) {
      pollFft();
      return;
    }
    lastFftAt = performance.now();
    if (eqView) eqView.setSpectrum(msg.fft);
    pollFft();
  }

  function applyWorkspace(msg) {
    waitingWorkspace = false;
    if (!eqView) return;
    eqView.setWorkspace(msg.eqFilters || [], msg.gain);
    renderActiveTabs(msg.streams || []);
    sendMessage({ type: 'getCurrentTabStatus' });
  }

  function renderActiveTabs(streams) {
    const root = document.getElementById('eqTabList');
    if (!root) return;
    root.innerHTML = '';
    if (!streams.length) {
      root.textContent = t('noActiveTabs');
      return;
    }
    const table = document.createElement('table');
    streams.forEach((tab) => {
      const row = document.createElement('tr');
      const cellBtn = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = t('stopEqTab');
      btn.className = 'btn btn-ghost-danger';
      btn.addEventListener('click', () => sendMessage({ type: 'disconnectTab', tab }));
      const icon = document.createElement('img');
      icon.className = 'tabFavIcon';
      icon.src = tab.favIconUrl || '';
      icon.alt = '';
      btn.appendChild(icon);
      cellBtn.appendChild(btn);
      row.appendChild(cellBtn);
      const cellTitle = document.createElement('td');
      cellTitle.textContent =
        tab.title && tab.title.length > 45 ? tab.title.slice(0, 45) + '…' : tab.title || 'Tab';
      row.appendChild(cellTitle);
      table.appendChild(row);
    });
    root.appendChild(table);
  }

  function syncPresetScrollFades() {
    const wrap = document.querySelector('.preset-scroll-wrap');
    const scroller = wrap && wrap.querySelector('.preset-scroll');
    if (!wrap || !scroller) return;
    const max = scroller.scrollWidth - scroller.clientWidth;
    const left = scroller.scrollLeft;
    const overflow = max > 2;
    wrap.classList.toggle('is-overflow', overflow);
    wrap.classList.toggle('can-scroll-left', left > 2);
    wrap.classList.toggle('can-scroll-right', overflow && left < max - 2);
  }

  function renderPresets(presets) {
    const root = document.getElementById('userPresetSpan');
    if (!root) return;
    root.innerHTML = '';
    Object.keys(presets || {}).forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = name;
      btn.title = name;
      btn.addEventListener('click', () => {
        sendMessage({ type: 'preset', preset: name });
        document.getElementById('presetNameInput').value = name;
        root.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
      root.appendChild(btn);
    });
    requestAnimationFrame(syncPresetScrollFades);
  }

  function setEqButtonLive(live, domainAllowed) {
    if (typeof domainAllowed === 'boolean') currentDomainAllowed = domainAllowed;
    eqStreaming = !!live;
    const btn = document.getElementById('eqTabButton');
    if (!btn) return;
    btn.classList.toggle('is-live', eqStreaming);
    btn.disabled = eqBusy;
    btn.classList.remove('is-blocked');
    btn.title = eqBusy
      ? t('eqWait')
      : eqStreaming
        ? t('eqStopTitle')
        : t('eqStartTitle');
    btn.textContent = eqStreaming ? t('eqStop') : t('eqStart');
    if (eqStreaming && showVisualizer()) pollFft();
    else {
      pollFft();
      if (!eqStreaming && eqView) eqView.collapseSpectrum();
    }
  }

  function clearEqBusy() {
    eqBusy = false;
    eqDesired = null;
    if (eqBusyTimer) {
      clearTimeout(eqBusyTimer);
      eqBusyTimer = null;
    }
    const btn = document.getElementById('eqTabButton');
    if (btn) btn.disabled = false;
  }

  function beginEqToggle(wantOn) {
    if (eqBusy) return;
    eqBusy = true;
    eqDesired = wantOn;
    setEqButtonLive(wantOn);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || typeof tab.id !== 'number') {
        clearEqBusy();
        setEqButtonLive(false);
        return;
      }

      if (!wantOn) {
        sendMessage(
          {
            type: 'eqTab',
            on: false,
            tabId: tab.id,
            tabUrl: tab.url,
            reason: 'user',
          },
          () => sendMessage({ type: 'getCurrentTabStatus' })
        );
        return;
      }

      const url = String(tab.url || '');
      if (
        !url ||
        url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') ||
        url.startsWith('about:') ||
        url.startsWith('devtools://')
      ) {
        clearEqBusy();
        setEqButtonLive(false);
        return;
      }

      // Obtain streamId in the popup (user gesture / activeTab), then attach in offscreen.
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
        const err = chrome.runtime.lastError;
        if (err || !streamId) {
          // Fallback: offscreen/SW path (host_permissions).
          sendMessage(
            {
              type: 'eqTab',
              on: true,
              tabId: tab.id,
              tabUrl: tab.url,
              reason: 'user',
            },
            () => sendMessage({ type: 'getCurrentTabStatus' })
          );
          return;
        }
        sendMessage(
          {
            type: 'attachTabCapture',
            tabId: tab.id,
            streamId,
            tab: {
              id: tab.id,
              url: tab.url,
              title: tab.title,
              favIconUrl: tab.favIconUrl,
            },
            reason: 'user',
          },
          () => sendMessage({ type: 'getCurrentTabStatus' })
        );
      });
    });

    if (eqBusyTimer) clearTimeout(eqBusyTimer);
    eqBusyTimer = setTimeout(() => {
      clearEqBusy();
      sendMessage({ type: 'getCurrentTabStatus' });
    }, 2500);
  }

  function bindEqButton() {
    const btn = document.getElementById('eqTabButton');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      if (eqBusy || btn.disabled) return;
      beginEqToggle(!eqStreaming);
    });
  }

  function refreshDomainEqState() {
    sendMessage({ type: 'getCurrentTabStatus' });
    window.SoundHubDomains?.refreshCurrentTab?.();
  }

  function syncMixerWithDomainFilter(filter) {
    if (!filter || !window.SoundHubDomainFilter) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab) return;
      const keep = window.SoundHubDomainFilter.shouldAutoEnable(tab.url, filter);
      if (!keep && eqStreaming) {
        eqBusy = true;
        eqDesired = false;
        setEqButtonLive(false);
        sendMessage({ type: 'eqTab', on: false, reason: 'filter', tabId: tab.id, tabUrl: tab.url }, () => {
          clearEqBusy();
          sendMessage({ type: 'getCurrentTabStatus' });
        });
      }
    });
  }

  function isFullscreenTab() {
    return (
      new URLSearchParams(window.location.search).get('fullscreen') === '1' ||
      window.innerWidth > 1000
    );
  }

  function initFullscreenLayout() {
    const BASE_APP_W = 748;
    const MAX_SCALE = 2.4;
    const PAD_Y = 48;
    const PAD_X = 48;

    let cachedAppH = null;
    let appliedScale = -1;
    let resizeTimer = null;

    function apply() {
      const root = document.documentElement;
      const fs = isFullscreenTab();
      document.body.classList.toggle('is-fullscreen-tab', fs);

      if (!fs) {
        root.style.removeProperty('--fs-scale');
        root.style.removeProperty('--fs-app-h');
        cachedAppH = null;
        appliedScale = -1;
        const vp = document.querySelector('meta[name="viewport"]');
        if (vp) vp.setAttribute('content', 'width=748, initial-scale=1');
        const fsBtn = document.getElementById('fullscreenButton');
        if (fsBtn) fsBtn.style.removeProperty('display');
        return;
      }

      const vp = document.querySelector('meta[name="viewport"]');
      if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1');

      const fsBtn = document.getElementById('fullscreenButton');
      if (fsBtn) fsBtn.style.display = 'none';

      const app = document.querySelector('.app');
      if (!app) return;

      if (cachedAppH == null) {
        cachedAppH = app.offsetHeight;
      }

      const availH = window.innerHeight - PAD_Y * 2;
      const availW = window.innerWidth - PAD_X * 2;

      let scale = Math.min(availH / cachedAppH, availW / BASE_APP_W, MAX_SCALE);
      scale = Math.max(1, Math.round(scale * 1000) / 1000);

      if (scale === appliedScale) return;

      appliedScale = scale;
      root.style.setProperty('--fs-scale', String(scale));
      root.style.setProperty('--fs-app-h', `${cachedAppH}px`);
      if (eqView) eqView.render();
    }

    function scheduleApply() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(apply, 120);
    }

    apply();
    window.addEventListener('resize', scheduleApply);
  }

  function bindControls() {
    const presetInput = document.getElementById('presetNameInput');

    document.getElementById('resetFiltersButton').addEventListener('click', () => {
      presetInput.value = '';
      sendMessage({ type: 'resetFilters' });
    });

    document.getElementById('bassBoostButton').addEventListener('click', () => {
      presetInput.value = '';
      sendMessage({ type: 'preset', preset: 'bassBoost' });
    });

    document.getElementById('savePresetButton').addEventListener('click', () => {
      const name = presetInput.value.trim();
      if (name) sendMessage({ type: 'savePreset', preset: name });
      else {
        presetInput.focus();
      }
    });

    document.getElementById('deletePresetButton').addEventListener('click', () => {
      const name = presetInput.value.trim();
      if (name) sendMessage({ type: 'deletePreset', preset: name });
    });

    presetInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('savePresetButton').click();
      }
    });

    document.getElementById('exportPresetsButton').addEventListener('click', () => {
      sendMessage({ type: 'exportPresets' });
    });

    const fileInput = document.getElementById('importPresetsFile');
    document.getElementById('importPresetsButton').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      Array.from(fileInput.files || []).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const raw = JSON.parse(ev.target.result);
            const normalized = window.SoundHubPresetImport
              ? window.SoundHubPresetImport.normalizePresets(raw, { fileName: file.name })
              : { presets: raw, count: Object.keys(raw || {}).length, format: 'raw' };

            if (!normalized.count) {
              console.error('No supported presets found in file', file.name);
              return;
            }

            sendMessage({ type: 'importPresets', presets: normalized.presets });
            console.info(
              `Imported ${normalized.count} preset(s) from ${file.name} (${normalized.format})`
            );
          } catch (err) {
            console.error('Invalid preset file', err);
          }
        };
        reader.readAsText(file);
      });
      fileInput.value = '';
    });

    document.getElementById('vizButton').addEventListener('click', () => {
      toggleVisualizer();
    });

    ['tab-1', 'tab-2', 'tab-3', 'tab-4'].forEach((id) => {
      document.getElementById(id).addEventListener('change', function onTab() {
        if (this.checked) localStorage[LAST_TAB_KEY] = id;
      });
    });

    const lastTab = localStorage[LAST_TAB_KEY];
    if (lastTab) {
      const el = document.getElementById(lastTab);
      if (el) el.checked = true;
    }

    bindSettings();
    bindEqButton();
  }

  function initEqCanvas() {
    eqView = new EqCanvasView({
      eqCanvas: document.getElementById('eqCanvas'),
      gainCanvas: document.getElementById('gainCanvas'),
      sendMessage,
      requestRefresh,
    });
    eqView.setWorkspace([], 1);
    syncVisualizerState();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'sendCurrentTabStatus': {
        const streaming = !!msg.streaming;
        if (eqDesired !== null && streaming !== eqDesired) {
          // Ignore stale status while a user toggle is still settling.
          break;
        }
        clearEqBusy();
        setEqButtonLive(streaming, msg.domainAllowed);
        break;
      }
      case 'sendWorkspaceStatus':
        applyWorkspace(msg);
        break;
      case 'sendSampleRate':
        if (eqView && msg.Fs) eqView.setSampleRate(msg.Fs);
        break;
      case 'sendPresets':
        renderPresets(msg.presets);
        break;
      default:
        break;
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SoundHubI18n) window.SoundHubI18n.init();
    initEqCanvas();
    bindControls();
    initFullscreenLayout();
    setEqButtonLive(false);
    sendMessage({ type: 'onPopupOpen' });
    requestRefresh();
    sendMessage({ type: 'getCurrentTabStatus' });
    sendMessage({ type: 'tryAutoEq' });

    document.addEventListener('soundhub-theme-change', () => {
      if (eqView) eqView.render();
    });

    document.addEventListener('soundhub-lang-change', () => {
      setEqButtonLive(eqStreaming);
      sendMessage({ type: 'getFullRefresh' });
      window.SoundHubDomains?.refreshCurrentTab?.();
    });

    document.addEventListener('soundhub-domains-change', (e) => {
      syncMixerWithDomainFilter(e.detail);
      refreshDomainEqState();
    });

    const presetScroller = document.querySelector('.preset-scroll');
    if (presetScroller) {
      presetScroller.addEventListener('scroll', syncPresetScrollFades, { passive: true });
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(syncPresetScrollFades).observe(presetScroller);
      }
      requestAnimationFrame(syncPresetScrollFades);
    }

    const tick = () => {
      if (waitingWorkspace) requestRefresh();
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 1000);

    const subtitle = document.getElementById('lt');
    if (subtitle) subtitle.textContent = '';
  });
})();
