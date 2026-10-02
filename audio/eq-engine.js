/**
 * SoundHub EQ engine (runs in the offscreen document).
 * Handles tab capture, biquad EQ chain, presets, and FFT.
 */
(function () {
  "use strict";

  var VERSION_KEY = "VERSION";
  var PRESETS_KEY = "PRESETS";
  var PRESETS_SYNC_PREFIX = "PRESETS.";
  var GAIN_KEY = "GAIN";
  var FILTER_COUNT = 11;
  var AUDIO_SMOOTH_TC = 0.085;
  var AUDIO_FAST_TC = 0.04;
  var OUTPUT_FADE_SEC = 0.22;
  var DRY_RELEASE_MS = 300;
  var ANALYSER_IDLE_MS = 1000;
  var FFT_SIZE = 8192;
  var DEFAULT_Q = 0.7071;
  var DEFAULT_FREQUENCIES = [
    20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
  ];

  var appVersion = chrome.runtime.getManifest().version;
  var syncStorage = chrome.storage.sync;

  var audioCtx = null;
  var preGain = null;
  var masterGain = null;
  var fadeGain = null;
  var analyser = null;
  var analyserLastUsedAt = 0;
  var filters = [];
  var checkSampleRate = function () {};
  var tabStreams = {};
  var engineStarted = false;
  var onMessage = null;
  var analyserIdleTimer = null;
  var messageListenerBound = false;
  var fadeOutTimer = null;

  function dispatchMessage(msg, sender, sendResponse) {
    if (typeof onMessage === "function") {
      return onMessage(msg, sender, sendResponse);
    }
  }

  function ensureMessageListener() {
    if (messageListenerBound) return;
    messageListenerBound = true;
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      return dispatchMessage(msg, sender, sendResponse);
    });
  }

  function parseJson(raw, fallback) {
    try {
      var value = typeof raw === "string" ? JSON.parse(raw) : raw;
      return value == null ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function readLocalPresets() {
    var presets = parseJson(localStorage[PRESETS_KEY], {});
    return presets && typeof presets === "object" ? presets : {};
  }

  function writeLocalPresets(presets) {
    localStorage[PRESETS_KEY] = JSON.stringify(presets);
  }

  function syncPresetKey(name) {
    return PRESETS_SYNC_PREFIX + name;
  }

  function loadPresets(callback) {
    var presets = readLocalPresets();
    syncStorage.get(null, function (items) {
      if (chrome.runtime.lastError) {
        console.warn(chrome.runtime.lastError);
      }
      if (items) {
        Object.keys(items).forEach(function (key) {
          if (key.startsWith(PRESETS_SYNC_PREFIX)) {
            presets[key.slice(PRESETS_SYNC_PREFIX.length)] = items[key];
          }
        });
      }
      callback(presets);
    });
  }

  function savePreset(name, data, done) {
    var presets = readLocalPresets();
    presets[name] = data;
    writeLocalPresets(presets);
    var payload = {};
    payload[syncPresetKey(name)] = data;
    syncStorage.set(payload, function () {
      if (chrome.runtime.lastError) {
        console.warn(chrome.runtime.lastError);
      }
      if (done) done();
    });
  }

  function deletePreset(msg, done) {
    var presets = readLocalPresets();
    delete presets[msg.preset];
    writeLocalPresets(presets);
    syncStorage.remove(syncPresetKey(msg.preset), done);
  }

  function createAudioContext() {
    return new AudioContext({ latencyHint: "playback" });
  }

  function reloadAudioContext() {
    if (!engineStarted) return;
    audioCtx.close();
    audioCtx = null;
    engineStarted = false;
    disposeAnalyser();
    var streams = Object.values(tabStreams);
    tabStreams = {};
    for (var i = 0; i < streams.length; i++) {
      try {
        streams[i].audioSource.disconnect();
      } catch (err) {}
    }
    startEngine(streams);
  }

  function disposeAnalyser() {
    if (masterGain && analyser) {
      try {
        masterGain.disconnect(analyser);
      } catch (err) {}
    }
    analyser = null;
    analyserLastUsedAt = 0;
  }

  function readStoredGain() {
    var gain = parseJson(localStorage[GAIN_KEY], 1);
    return typeof gain === "number" ? gain : 1;
  }

  function writeStoredGain(value) {
    localStorage[GAIN_KEY] = JSON.stringify(value);
  }

  function readStoredFilter(index) {
    return parseJson(localStorage["filter" + index], null);
  }

  function writeStoredFilter(index, data) {
    localStorage["filter" + index] = JSON.stringify(data);
  }

  function startEngine(existingStreams) {
    if (engineStarted) return;
    engineStarted = true;

    audioCtx = createAudioContext();
    audioCtx.suspend();

    var sampleRateReloadArmed = false;
    checkSampleRate = function () {
      if (sampleRateReloadArmed) return;
      var probe = createAudioContext();
      var changed =
        !!(audioCtx.sampleRate &&
          probe.sampleRate &&
          audioCtx.sampleRate !== probe.sampleRate);
      probe.close();
      if (changed) {
        sampleRateReloadArmed = true;
        console.info("sampleRate changed, reloading AudioContext");
        reloadAudioContext();
      }
    };

    preGain = audioCtx.createGain();
    preGain.gain.value = 1;
    masterGain = audioCtx.createGain();
    masterGain.gain.value = clampMasterGain(readStoredGain());
    fadeGain = audioCtx.createGain();
    fadeGain.gain.value = 0;

    if (!localStorage[VERSION_KEY]) {
      localStorage[VERSION_KEY] = "0.0.0";
    }
    // One-shot migration: push local presets into chrome.storage.sync.
    if (localStorage["sync"] !== " ") {
      loadPresets(function (presets) {
        Object.keys(presets).forEach(function (name) {
          savePreset(name, presets[name], function () {});
        });
      });
      localStorage["sync"] = " ";
    }
    localStorage[VERSION_KEY] = appVersion;

    filters = [];
    for (var i = 0; i < FILTER_COUNT; i++) {
      var filter = audioCtx.createBiquadFilter();
      if (i === 0) filter.type = "lowshelf";
      else if (i === FILTER_COUNT - 1) filter.type = "highshelf";
      else filter.type = "peaking";

      var stored = readStoredFilter(i);
      if (stored && stored.f != null) {
        filter.frequency.value = stored.f;
        filter.gain.value = stored.g;
        filter.Q.value = stored.q;
      } else {
        filter.frequency.value = DEFAULT_FREQUENCIES[i];
        filter.gain.value = 0;
        filter.Q.value = DEFAULT_Q;
      }
      filters.push(filter);
      writeStoredFilter(i, {
        f: filter.frequency.value,
        g: filter.gain.value,
        q: filter.Q.value,
      });
    }

    // Always-connected chain: quieter than reconnecting filters when gain crosses 0.
    preGain.connect(filters[0]);
    for (var c = 0; c < FILTER_COUNT - 1; c++) {
      filters[c].connect(filters[c + 1]);
    }
    filters[FILTER_COUNT - 1].connect(masterGain);
    masterGain.connect(fadeGain);
    fadeGain.connect(audioCtx.destination);

    function rampParam(param, value, timeConstant) {
      var now = audioCtx.currentTime;
      try {
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
        if (!timeConstant || timeConstant <= 0) {
          param.setValueAtTime(value, now);
        } else {
          param.setTargetAtTime(value, now, timeConstant);
        }
      } catch (err) {
        param.value = value;
      }
    }

    function rampOutputFade(level, seconds) {
      if (!fadeGain) return;
      var now = audioCtx.currentTime;
      var param = fadeGain.gain;
      var dur = Math.max(0.02, seconds || OUTPUT_FADE_SEC);
      try {
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(level, now + dur);
      } catch (err) {
        param.value = level;
      }
    }

    function cancelFadeOut() {
      if (fadeOutTimer) {
        clearTimeout(fadeOutTimer);
        fadeOutTimer = null;
      }
    }

    function clampMasterGain(value) {
      if (value > 10) return 10;
      if (value < 0.00316) return 0.00316;
      return value;
    }

    function clampGain(value) {
      if (value < -30) return -30;
      if (value > 30) return 30;
      return value;
    }

    function clampFrequency(value) {
      if (value < 5) return 5;
      if (value > 20000) return 20000;
      return value;
    }

    function clampQ(value) {
      if (value < 0.2) return 0.2;
      if (value > 11) return 11;
      return value;
    }

    function modifyFilter(msg) {
      var filter = filters[msg.index];
      if (!filter) return;
      var gain = clampGain(msg.gain);
      var frequency = clampFrequency(msg.frequency);
      var q = clampQ(msg.q);
      var tc = msg.smooth ? AUDIO_SMOOTH_TC : AUDIO_FAST_TC;
      rampParam(filter.gain, gain, tc);
      rampParam(filter.frequency, frequency, tc);
      rampParam(filter.Q, q, tc);
      if (msg.persist !== false) {
        writeStoredFilter(msg.index, { f: frequency, g: gain, q: q });
      }
    }

    function modifyGain(msg) {
      var gain = clampMasterGain(msg.gain);
      var tc = msg.smooth ? AUDIO_SMOOTH_TC : AUDIO_FAST_TC;
      rampParam(masterGain.gain, gain, tc);
      if (msg.persist !== false) {
        writeStoredGain(gain);
      }
    }

    /** Re-apply saved EQ to the live graph without touching storage. */
    function applyStoredGraph(smooth) {
      for (var i = 0; i < FILTER_COUNT; i++) {
        var stored = readStoredFilter(i) || {
          f: DEFAULT_FREQUENCIES[i],
          g: 0,
          q: DEFAULT_Q,
        };
        modifyFilter({
          index: i,
          frequency: stored.f,
          gain: stored.g,
          q: stored.q,
          smooth: !!smooth,
          persist: false,
        });
      }
      modifyGain({
        gain: readStoredGain(),
        smooth: !!smooth,
        persist: false,
      });
    }

    /**
     * Ease EQ toward dry passthrough before releasing tabCapture.
     * Avoids silence→unmute jump while still sounding smooth.
     */
    function flattenGraphForRelease() {
      for (var i = 0; i < FILTER_COUNT; i++) {
        var stored = readStoredFilter(i) || {
          f: DEFAULT_FREQUENCIES[i],
          g: 0,
          q: DEFAULT_Q,
        };
        modifyFilter({
          index: i,
          frequency: stored.f,
          gain: 0,
          q: stored.q,
          smooth: true,
          persist: false,
        });
      }
      modifyGain({ gain: 1, smooth: true, persist: false });
    }

    function saveCurrentAsPreset(msg) {
      var frequencies = [];
      var gains = [];
      var qs = [];
      for (var i = 0; i < FILTER_COUNT; i++) {
        var stored = readStoredFilter(i);
        if (stored) {
          frequencies.push(stored.f);
          gains.push(stored.g);
          qs.push(stored.q);
        } else {
          frequencies.push(filters[i].frequency.value);
          gains.push(filters[i].gain.value);
          qs.push(filters[i].Q.value);
        }
      }
      savePreset(
        msg.preset,
        { frequencies: frequencies, gains: gains, qs: qs },
        fullRefresh,
      );
    }

    function applyPreset(msg) {
      loadPresets(function (presets) {
        var frequencies;
        var gains;
        var qs;
        if (msg.preset === "bassBoost") {
          frequencies = DEFAULT_FREQUENCIES.slice();
          gains = DEFAULT_FREQUENCIES.map(function () {
            return 0;
          });
          qs = DEFAULT_FREQUENCIES.map(function () {
            return DEFAULT_Q;
          });
          frequencies[0] = 340;
          gains[0] = 5;
        } else {
          var preset = presets[msg.preset];
          if (!preset) return;
          frequencies = preset.frequencies;
          gains = preset.gains;
          qs = preset.qs;
        }
        for (var i = 0; i < frequencies.length; i++) {
          modifyFilter({
            index: i,
            frequency: frequencies[i],
            gain: gains[i],
            q: qs[i],
            smooth: true,
          });
        }
        fullRefresh();
      });
    }

    function captureAndAttach(stream) {
      if (!stream) {
        fullRefresh();
        return;
      }
      getActiveTab(function (tab) {
        attachStream(stream, tab);
        fullRefresh();
      });
    }

    function sendWorkspaceStatus() {
      var payload = {
        type: "sendWorkspaceStatus",
        eqFilters: [],
        streams: [],
        gain: readStoredGain(),
      };
      for (var i = 0; i < filters.length; i++) {
        var filter = filters[i];
        var stored = readStoredFilter(i);
        payload.eqFilters.push({
          frequency: stored && stored.f != null ? stored.f : filter.frequency.value,
          gain: stored && stored.g != null ? stored.g : filter.gain.value,
          type: filter.type,
          q: stored && stored.q != null ? stored.q : filter.Q.value,
        });
      }
      Object.keys(tabStreams).forEach(function (id) {
        payload.streams.push(tabStreams[id].tab);
      });
      chrome.runtime.sendMessage(payload);
    }

    function sendSampleRate() {
      chrome.runtime.sendMessage({
        type: "sendSampleRate",
        Fs: audioCtx.sampleRate,
      });
    }

    function sendPresets() {
      loadPresets(function (presets) {
        chrome.runtime.sendMessage({ type: "sendPresets", presets: presets });
      });
    }

    function fullRefresh() {
      sendCurrentTabStatus();
      sendWorkspaceStatus();
      sendSampleRate();
      sendPresets();
    }

    function getActiveTab(callback) {
      chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
        if (!tabs || tabs.length !== 1) {
          console.warn("expected 1 active tab, got", tabs && tabs.length);
          return;
        }
        callback(tabs[0]);
      });
    }

    function sendCurrentTabStatus() {
      getActiveTab(function (tab) {
        var payload = {
          type: "sendCurrentTabStatus",
          streaming: tab.id in tabStreams,
        };
        if (window.SoundHubDomainFilter) {
          window.SoundHubDomainFilter.getFilter(function (filter) {
            payload.domainAllowed = window.SoundHubDomainFilter.isAllowedForUrl(
              tab.url,
              filter,
            );
            payload.hostname = window.SoundHubDomainFilter.hostnameFromUrl(
              tab.url,
            );
            chrome.runtime.sendMessage(payload);
          });
        } else {
          chrome.runtime.sendMessage(payload);
        }
      });
    }

    function attachStream(stream, tab) {
      if (!stream || !tab) {
        fullRefresh();
        return;
      }

      cancelFadeOut();
      var wasEmpty = Object.keys(tabStreams).length === 0;

      if (tab.id in tabStreams) {
        tabStreams[tab.id].stream.getTracks().forEach(function (track) {
          track.stop();
        });
        try {
          tabStreams[tab.id].audioSource.disconnect();
        } catch (err) {}
        delete tabStreams[tab.id];
      }

      var source = audioCtx.createMediaStreamSource(stream);
      source.connect(preGain);
      tabStreams[tab.id] = { stream: stream, tab: tab, audioSource: source };

      if (wasEmpty) {
        applyStoredGraph(false);
        try {
          fadeGain.gain.cancelScheduledValues(audioCtx.currentTime);
          fadeGain.gain.setValueAtTime(0, audioCtx.currentTime);
        } catch (err) {
          fadeGain.gain.value = 0;
        }
        var startFade = function () {
          rampOutputFade(1, OUTPUT_FADE_SEC);
        };
        var resumeResult = audioCtx.resume();
        if (resumeResult && typeof resumeResult.then === "function") {
          resumeResult.then(startFade).catch(startFade);
        } else {
          startFade();
        }
      } else if (fadeGain.gain.value < 0.999) {
        rampOutputFade(1, OUTPUT_FADE_SEC * 0.6);
      }
    }

    function stopCurrentTabStream() {
      getActiveTab(disconnectTab);
    }

    function teardownTabEntry(tabId) {
      var entry = tabStreams[tabId];
      if (!entry) return;
      entry.stream.getTracks().forEach(function (track) {
        track.stop();
      });
      try {
        entry.audioSource.disconnect();
      } catch (err) {}
      delete tabStreams[tabId];
    }

    function disconnectTab(tab) {
      if (!tab || !(tab.id in tabStreams)) {
        fullRefresh();
        return;
      }
      if (fadeOutTimer) return;

      cancelFadeOut();

      var isLast = Object.keys(tabStreams).length === 1;
      if (!isLast) {
        teardownTabEntry(tab.id);
        fullRefresh();
        return;
      }

      // Keep output audible, ease EQ to dry passthrough, then release capture.
      // Volume-fade-to-zero is avoided: tab is muted during capture, so silence
      // followed by unmute always clicks.
      if (fadeGain) {
        try {
          var now = audioCtx.currentTime;
          fadeGain.gain.cancelScheduledValues(now);
          fadeGain.gain.setValueAtTime(1, now);
        } catch (err) {
          fadeGain.gain.value = 1;
        }
      }

      flattenGraphForRelease();

      var tabId = tab.id;
      fadeOutTimer = setTimeout(function () {
        fadeOutTimer = null;
        teardownTabEntry(tabId);
        applyStoredGraph(false);
        if (Object.keys(tabStreams).length === 0) {
          if (fadeGain) {
            try {
              fadeGain.gain.cancelScheduledValues(audioCtx.currentTime);
              fadeGain.gain.setValueAtTime(0, audioCtx.currentTime);
            } catch (err) {
              fadeGain.gain.value = 0;
            }
          }
          audioCtx.suspend();
          disposeAnalyser();
        }
        fullRefresh();
      }, DRY_RELEASE_MS);
    }

    function resetAllFilters() {
      for (var i = 0; i < FILTER_COUNT; i++) {
        modifyFilter({
          index: i,
          gain: 0,
          frequency: DEFAULT_FREQUENCIES[i],
          q: DEFAULT_Q,
          smooth: true,
        });
      }
      modifyGain({ gain: 1, smooth: true });
      fullRefresh();
    }

    function resetOneFilter(msg) {
      modifyFilter({
        index: msg.index,
        gain: 0,
        frequency: DEFAULT_FREQUENCIES[msg.index],
        q: DEFAULT_Q,
        smooth: msg.smooth !== false,
      });
    }

    function exportPresets() {
      loadPresets(function (presets) {
        var link = document.createElement("a");
        var blob = new Blob([JSON.stringify(presets, null, 2)], {
          type: "application/json;charset=UTF-8",
        });
        link.href = URL.createObjectURL(blob);
        link.download = "SoundHubPresets.json";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () {
          URL.revokeObjectURL(link.href);
        }, 1000);
      });
    }

    function isExtensionPage(tab) {
      return (
        !tab ||
        !tab.url ||
        tab.url.startsWith("chrome-extension://" + chrome.runtime.id)
      );
    }

    function ensureAnalyser() {
      if (analyser) return analyser;
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.5;
      masterGain.connect(analyser);
      return analyser;
    }

    function handleGetFft(sendResponse) {
      var node = ensureAnalyser();
      analyserLastUsedAt = performance.now();
      var bins = new Float32Array(node.frequencyBinCount);
      node.getFloatFrequencyData(bins);
      sendResponse({ type: "fft", fft: Array.from(bins) });
    }

    onMessage = function (msg, _sender, sendResponse) {
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case "attachTabCapture": {
          if (msg.tabId in tabStreams) {
            if (!msg.replace) return;
            teardownTabEntry(msg.tabId);
          }
          var resolveTab = function (tab) {
            if (isExtensionPage(tab)) return;
            var attach = async function () {
              try {
                var stream = await navigator.mediaDevices.getUserMedia({
                  audio: {
                    mandatory: {
                      chromeMediaSource: "tab",
                      chromeMediaSourceId: msg.streamId,
                    },
                  },
                  video: false,
                });
                attachStream(stream, tab);
                fullRefresh();
              } catch (err) {
                console.error(err);
              }
            };
            if (window.SoundHubDomainFilter) {
              window.SoundHubDomainFilter.checkTabAllowed(tab, function (ok) {
                if (ok) attach();
              });
            } else {
              attach();
            }
          };
          if (msg.tab && msg.tab.id) resolveTab(msg.tab);
          else chrome.tabs.get(msg.tabId, resolveTab);
          return;
        }

        case "eqTab": {
          if (!msg.on) {
            stopCurrentTabStream();
            if (sendResponse) sendResponse({ ok: true, streaming: false });
            return;
          }
          var startEq = function (tab) {
            if (isExtensionPage(tab)) {
              sendCurrentTabStatus();
              if (sendResponse) sendResponse({ ok: false });
              return;
            }
            var url = (tab && tab.url) || "";
            if (
              !url ||
              url.startsWith("chrome://") ||
              url.startsWith("edge://") ||
              url.startsWith("about:") ||
              url.startsWith("devtools://")
            ) {
              sendCurrentTabStatus();
              if (sendResponse) sendResponse({ ok: false });
              return;
            }
            if (tab.id in tabStreams) {
              // Stop was mid dry-release: cancel it and restore EQ instead of
              // requesting a new capture (avoids null-stream races).
              if (fadeOutTimer) {
                cancelFadeOut();
                applyStoredGraph(true);
                if (fadeGain) rampOutputFade(1, OUTPUT_FADE_SEC * 0.5);
              }
              sendCurrentTabStatus();
              if (sendResponse) sendResponse({ ok: true, streaming: true });
              return;
            }
            var captureAttempts = 0;
            var capture = function () {
              captureAttempts += 1;
              chrome.tabCapture.capture(
                { audio: true, video: false, targetTabId: tab.id },
                function (stream) {
                  var err =
                    chrome.runtime.lastError && chrome.runtime.lastError.message;
                  if (!stream) {
                    if (captureAttempts < 2) {
                      setTimeout(capture, 160);
                      return;
                    }
                    if (err) console.warn("tabCapture failed:", err);
                    sendCurrentTabStatus();
                    if (sendResponse) sendResponse({ ok: false });
                    return;
                  }
                  captureAndAttach(stream);
                  sendCurrentTabStatus();
                  if (sendResponse) {
                    sendResponse({
                      ok: true,
                      streaming: tab.id in tabStreams,
                    });
                  }
                },
              );
            };
            if (window.SoundHubDomainFilter) {
              window.SoundHubDomainFilter.checkTabAllowed(tab, function (ok) {
                if (!ok) {
                  sendCurrentTabStatus();
                  if (sendResponse) sendResponse({ ok: false });
                  return;
                }
                capture();
              });
            } else {
              capture();
            }
          };
          if (typeof msg.tabId === "number") {
            chrome.tabs.get(msg.tabId, startEq);
          } else {
            chrome.tabs.query(
              { currentWindow: true, active: true },
              function (tabs) {
                if (tabs && tabs[0]) startEq(tabs[0]);
                else if (sendResponse) sendResponse({ ok: false });
              },
            );
          }
          return true;
        }

        case "getCurrentTabStatus":
          sendCurrentTabStatus();
          break;
        case "getWorkspaceStatus":
          sendWorkspaceStatus();
          break;
        case "getFullRefresh":
          fullRefresh();
          break;
        case "onPopupOpen":
          checkSampleRate();
          break;
        case "modifyFilter":
          modifyFilter(msg);
          break;
        case "modifyGain":
          modifyGain(msg);
          break;
        case "disconnectTab":
          disconnectTab(msg.tab);
          break;
        case "syncDomainFilter":
          fullRefresh();
          break;
        case "resetFilters":
          resetAllFilters();
          break;
        case "resetFilter":
          resetOneFilter(msg);
          break;
        case "preset":
          applyPreset(msg);
          break;
        case "savePreset":
          saveCurrentAsPreset(msg);
          break;
        case "importPresets": {
          var imported = msg.presets || {};
          var names = Object.keys(imported);
          if (!names.length) break;
          var pending = names.length;
          names.forEach(function (name) {
            savePreset(name, imported[name], function () {
              pending -= 1;
              if (pending === 0) fullRefresh();
            });
          });
          break;
        }
        case "deletePreset":
          deletePreset(msg, fullRefresh);
          break;
        case "exportPresets":
          exportPresets();
          break;
        case "getTabCaptureStatus": {
          var captureTabId = msg.tabId;
          if (sendResponse) {
            sendResponse({
              streaming:
                typeof captureTabId === "number" && captureTabId in tabStreams,
            });
          }
          return true;
        }
        case "getEqSnapshot": {
          var snapFilters = [];
          for (var si = 0; si < FILTER_COUNT; si++) {
            var storedSnap = readStoredFilter(si) || {
              f: DEFAULT_FREQUENCIES[si],
              g: 0,
              q: DEFAULT_Q,
            };
            snapFilters.push({
              f: storedSnap.f,
              g: storedSnap.g,
              q: storedSnap.q,
            });
          }
          if (sendResponse) {
            sendResponse({
              ok: true,
              filters: snapFilters,
              gain: readStoredGain(),
            });
          }
          return true;
        }
        case "getFFT":
          getActiveTab(function (tab) {
            if (!tab || !(tab.id in tabStreams)) {
              if (sendResponse) sendResponse({ type: "fft", fft: null });
              return;
            }
            handleGetFft(sendResponse);
          });
          return true;
        default:
          break;
      }
    };

    if (existingStreams) {
      for (var s = 0; s < existingStreams.length; s++) {
        attachStream(existingStreams[s].stream, existingStreams[s].tab);
      }
      fullRefresh();
    }
    ensureMessageListener();
  }

  startEngine();

  analyserIdleTimer = setInterval(function () {
    if (!analyser || !analyserLastUsedAt) return;
    if (performance.now() - analyserLastUsedAt > ANALYSER_IDLE_MS) {
      disposeAnalyser();
    }
  }, ANALYSER_IDLE_MS);
})();
