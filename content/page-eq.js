/**
 * In-page EQ for HTML5 video/audio players.
 * Keeps native fullscreen working (unlike tabCapture).
 */
(function () {
  'use strict';

  if (globalThis.__soundhubPageEq) {
    return;
  }

  var FILTER_COUNT = 11;
  var DEFAULT_Q = 0.7071;
  var DEFAULT_FREQUENCIES = [
    20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
  ];
  var AUDIO_SMOOTH_TC = 0.085;
  var AUDIO_FAST_TC = 0.04;
  var HOOK_TIMEOUT_MS = 3500;
  var HOOK_POLL_MS = 250;

  var ctx = null;
  var preGain = null;
  var masterGain = null;
  var fadeGain = null;
  var analyser = null;
  var filters = [];
  var source = null;
  var hookedEl = null;
  var active = false;
  var starting = false;
  var observer = null;
  var pollTimer = null;
  var startDeadline = 0;

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

  function rampParam(param, value, timeConstant) {
    if (!ctx || !param) return;
    var now = ctx.currentTime;
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

  function ensureContext() {
    if (ctx) return ctx;
    ctx = new AudioContext({ latencyHint: 'playback' });
    preGain = ctx.createGain();
    preGain.gain.value = 1;
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    fadeGain = ctx.createGain();
    fadeGain.gain.value = 1;
    filters = [];
    for (var i = 0; i < FILTER_COUNT; i++) {
      var filter = ctx.createBiquadFilter();
      if (i === 0) filter.type = 'lowshelf';
      else if (i === FILTER_COUNT - 1) filter.type = 'highshelf';
      else filter.type = 'peaking';
      filter.frequency.value = DEFAULT_FREQUENCIES[i];
      filter.gain.value = 0;
      filter.Q.value = DEFAULT_Q;
      filters.push(filter);
    }
    preGain.connect(filters[0]);
    for (var c = 0; c < FILTER_COUNT - 1; c++) {
      filters[c].connect(filters[c + 1]);
    }
    filters[FILTER_COUNT - 1].connect(masterGain);
    masterGain.connect(fadeGain);
    fadeGain.connect(ctx.destination);
    return ctx;
  }

  function applySnapshot(snap) {
    if (!snap) return;
    ensureContext();
    var list = snap.filters || [];
    for (var i = 0; i < FILTER_COUNT; i++) {
      var item = list[i] || {};
      var f = filters[i];
      rampParam(f.frequency, clampFrequency(item.f != null ? item.f : DEFAULT_FREQUENCIES[i]), 0);
      rampParam(f.gain, clampGain(item.g != null ? item.g : 0), 0);
      rampParam(f.Q, clampQ(item.q != null ? item.q : DEFAULT_Q), 0);
    }
    if (snap.gain != null) {
      rampParam(masterGain.gain, clampMasterGain(snap.gain), 0);
    }
  }

  function isDrmBlocked(el) {
    try {
      if (el.mediaKeys) return true;
    } catch (err) {}
    return false;
  }

  function scoreElement(el) {
    if (!el || el.muted && el.volume === 0) return -1;
    if (isDrmBlocked(el)) return -1;
    var rect = el.getBoundingClientRect();
    var area = Math.max(0, rect.width) * Math.max(0, rect.height);
    var score = area;
    if (!el.paused) score += 1e7;
    if (el.tagName === 'VIDEO') score += 1e5;
    if (el.classList && el.classList.contains('html5-main-video')) score += 5e6;
    try {
      if (el.closest && el.closest('.html5-video-player, #movie_player, .video-stream')) {
        score += 2e6;
      }
    } catch (err) {}
    return score;
  }

  function collectMedia(root, out) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('video, audio');
    for (var i = 0; i < nodes.length; i++) {
      out.push(nodes[i]);
    }
  }

  function findBestMedia() {
    var candidates = [];
    collectMedia(document, candidates);
    try {
      var hosts = document.querySelectorAll('*');
      for (var i = 0; i < hosts.length; i++) {
        if (hosts[i].shadowRoot) collectMedia(hosts[i].shadowRoot, candidates);
      }
    } catch (err) {}

    var best = null;
    var bestScore = 0;
    for (var j = 0; j < candidates.length; j++) {
      var score = scoreElement(candidates[j]);
      if (score > bestScore) {
        bestScore = score;
        best = candidates[j];
      }
    }
    return best;
  }

  function detachSource() {
    if (source) {
      try {
        source.disconnect();
      } catch (err) {}
      source = null;
    }
    hookedEl = null;
  }

  function hookElement(el) {
    if (!el || el === hookedEl) return true;
    if (isDrmBlocked(el)) return false;
    ensureContext();
    try {
      var next = ctx.createMediaElementSource(el);
      detachSource();
      source = next;
      hookedEl = el;
      source.connect(preGain);
      var resume = function () {
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(function () {});
        }
      };
      el.addEventListener('play', resume);
      resume();
      return true;
    } catch (err) {
      // Element already hooked by another AudioContext / extension.
      console.warn('SoundHub page EQ: hook failed', err);
      return false;
    }
  }

  function clearPoll() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function clearObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function clearTimers() {
    clearPoll();
    clearObserver();
  }

  function watchForMediaSwap() {
    clearObserver();
    observer = new MutationObserver(function () {
      if (!active) return;
      if (hookedEl && hookedEl.isConnected) return;
      tryHookOnce();
    });
    try {
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
    } catch (err) {}
  }

  function tryHookOnce() {
    var el = findBestMedia();
    if (!el) return false;
    return hookElement(el);
  }

  function finishStart(ok, reason) {
    starting = false;
    clearPoll();
    if (!ok) {
      active = false;
      clearObserver();
      teardownGraph();
    } else {
      watchForMediaSwap();
    }
    return { ok: !!ok, reason: reason || (ok ? 'ok' : 'no_media') };
  }

  function scheduleHookAttempts(resolve) {
    var settled = false;
    var done = function (ok, reason) {
      if (settled) return;
      settled = true;
      resolve(finishStart(ok, reason));
    };

    clearTimers();
    observer = new MutationObserver(function () {
      if (!active && !starting) return;
      if (tryHookOnce()) done(true, 'hooked');
    });
    try {
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
    } catch (err) {}

    var tick = function () {
      if (settled) return;
      if (!starting && !active) return;
      if (tryHookOnce()) {
        done(true, 'hooked');
        return;
      }
      if (Date.now() >= startDeadline) {
        done(false, 'timeout');
        return;
      }
      pollTimer = setTimeout(tick, HOOK_POLL_MS);
    };
    tick();
  }

  function teardownGraph() {
    detachSource();
    if (analyser && masterGain) {
      try {
        masterGain.disconnect(analyser);
      } catch (err) {}
    }
    analyser = null;
    if (ctx) {
      try {
        ctx.close();
      } catch (err) {}
    }
    ctx = null;
    preGain = null;
    masterGain = null;
    fadeGain = null;
    filters = [];
  }

  function start(snapshot) {
    if (active && hookedEl) {
      applySnapshot(snapshot);
      return Promise.resolve({ ok: true, reason: 'already' });
    }
    if (starting) {
      return Promise.resolve({ ok: false, reason: 'busy' });
    }
    starting = true;
    active = true;
    ensureContext();
    applySnapshot(snapshot);

    if (tryHookOnce()) {
      starting = false;
      return Promise.resolve(finishStart(true, 'hooked'));
    }

    startDeadline = Date.now() + HOOK_TIMEOUT_MS;
    return new Promise(function (resolve) {
      scheduleHookAttempts(resolve);
    });
  }

  function stop() {
    starting = false;
    active = false;
    clearTimers();
    teardownGraph();
    return { ok: true };
  }

  function modifyFilter(msg) {
    if (!active || !filters.length) return;
    var filter = filters[msg.index];
    if (!filter) return;
    var tc = msg.smooth ? AUDIO_SMOOTH_TC : AUDIO_FAST_TC;
    rampParam(filter.gain, clampGain(msg.gain), tc);
    rampParam(filter.frequency, clampFrequency(msg.frequency), tc);
    rampParam(filter.Q, clampQ(msg.q), tc);
  }

  function modifyGain(msg) {
    if (!active || !masterGain) return;
    var tc = msg.smooth ? AUDIO_SMOOTH_TC : AUDIO_FAST_TC;
    rampParam(masterGain.gain, clampMasterGain(msg.gain), tc);
  }

  function resetFilters() {
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
  }

  function getFft() {
    if (!active || !ctx || !masterGain) return null;
    if (!analyser) {
      analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.5;
      masterGain.connect(analyser);
    }
    var bins = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(bins);
    return Array.from(bins);
  }

  function isActive() {
    return !!(active && hookedEl);
  }

  globalThis.__soundhubPageEq = {
    start: start,
    stop: stop,
    applySnapshot: applySnapshot,
    modifyFilter: modifyFilter,
    modifyGain: modifyGain,
    resetFilters: resetFilters,
    getFft: getFft,
    isActive: isActive,
  };

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'pageEq.ping':
        sendResponse({ ready: true, active: isActive() });
        return;
      case 'pageEq.stop':
        sendResponse(stop());
        return;
      case 'pageEq.applySnapshot':
        if (isActive()) applySnapshot(msg);
        sendResponse({ ok: true });
        return;
      case 'modifyFilter':
        if (isActive()) modifyFilter(msg);
        break;
      case 'modifyGain':
        if (isActive()) modifyGain(msg);
        break;
      case 'resetFilters':
        if (isActive()) resetFilters();
        break;
      case 'resetFilter':
        if (isActive()) {
          modifyFilter({
            index: msg.index,
            gain: 0,
            frequency: DEFAULT_FREQUENCIES[msg.index],
            q: DEFAULT_Q,
            smooth: msg.smooth !== false,
          });
        }
        break;
      case 'pageEq.getFFT': {
        if (!isActive()) return;
        sendResponse({ type: 'fft', fft: getFft() });
        return;
      }
      default:
        break;
    }
  });
})();
