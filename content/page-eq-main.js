/**
 * Main-world page EQ engine.
 * Survives extension reloads (until the tab is refreshed), so
 * createMediaElementSource is not called twice on the same <video>.
 */
(function () {
  'use strict';

  if (window.__soundhubPageEqMain && window.__soundhubPageEqMain.__alive) {
    return;
  }

  var FILTER_COUNT = 11;
  var DEFAULT_Q = 0.7071;
  var DEFAULT_FREQUENCIES = [
    20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
  ];
  var AUDIO_SMOOTH_TC = 0.085;
  var AUDIO_FAST_TC = 0.04;
  var HOOK_TIMEOUT_MS = 4500;
  var HOOK_POLL_MS = 100;

  var ctx = null;
  var preGain = null;
  var masterGain = null;
  var fadeGain = null;
  var analyser = null;
  var filters = [];
  var source = null;
  var hookedEl = null;
  var hookMode = null;
  var captureStream = null;
  var savedMuted = null;
  var active = false;
  var starting = false;
  var hookLock = false;
  var observer = null;
  var pollTimer = null;
  var startDeadline = 0;
  var elementSourceMap = new WeakMap();
  var burnedElements = new WeakSet();

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
      if (!timeConstant || timeConstant <= 0) param.setValueAtTime(value, now);
      else param.setTargetAtTime(value, now, timeConstant);
    } catch (err) {
      param.value = value;
    }
  }

  function ensureContext() {
    if (ctx && ctx.state !== 'closed') return ctx;
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
    for (var c = 0; c < FILTER_COUNT - 1; c++) filters[c].connect(filters[c + 1]);
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
    if (snap.gain != null) rampParam(masterGain.gain, clampMasterGain(snap.gain), 0);
  }

  function isDrmBlocked(el) {
    try {
      if (el.mediaKeys) return true;
    } catch (err) {}
    return false;
  }

  function scoreElement(el) {
    if (!el || isDrmBlocked(el)) return -1;
    var rect = el.getBoundingClientRect();
    var area = Math.max(0, rect.width) * Math.max(0, rect.height);
    var score = area + 1;
    if (!el.paused) score += 1e7;
    if (!el.muted) score += 5e5;
    if (el.tagName === 'VIDEO') score += 1e5;
    if (el.classList && el.classList.contains('html5-main-video')) score += 5e6;
    try {
      if (el.closest && el.closest('.html5-video-player, #movie_player, .video-stream')) {
        score += 2e6;
      }
    } catch (err) {}
    if (burnedElements.has(el) && !elementSourceMap.has(el)) score -= 1e9;
    return score;
  }

  function collectMedia(root, out) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('video, audio');
    for (var i = 0; i < nodes.length; i++) out.push(nodes[i]);
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

  function bindResume(el) {
    var resume = function () {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    };
    el.addEventListener('play', resume);
    resume();
  }

  function restoreCaptureMute() {
    if (hookedEl && savedMuted != null) {
      try {
        hookedEl.muted = savedMuted;
      } catch (err) {}
    }
    savedMuted = null;
    if (captureStream) {
      try {
        captureStream.getTracks().forEach(function (track) {
          track.stop();
        });
      } catch (err) {}
      captureStream = null;
    }
  }

  function disconnectSourceOnly() {
    if (source) {
      try {
        source.disconnect();
      } catch (err) {}
    }
  }

  function bypassToDestination() {
    if (!source || !ctx || ctx.state === 'closed') return;
    disconnectSourceOnly();
    try {
      source.connect(ctx.destination);
    } catch (err) {}
  }

  function connectThroughEq() {
    if (!source || !preGain) return;
    disconnectSourceOnly();
    try {
      source.connect(preGain);
    } catch (err) {}
  }

  function attachSource(next, el, mode) {
    if (hookedEl && hookedEl !== el && hookMode === 'capture') {
      restoreCaptureMute();
    } else if (hookedEl && hookedEl !== el) {
      try {
        if (source) {
          source.disconnect();
          source.connect(ctx.destination);
        }
      } catch (err) {}
    }
    source = next;
    hookedEl = el;
    hookMode = mode;
    connectThroughEq();
    bindResume(el);
  }

  function hookViaCaptureStream(el) {
    if (!el || typeof el.captureStream !== 'function') return false;
    ensureContext();
    try {
      var stream = el.captureStream();
      if (!stream.getAudioTracks().length) {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
        return false;
      }
      savedMuted = el.muted;
      el.muted = true;
      captureStream = stream;
      attachSource(ctx.createMediaStreamSource(stream), el, 'capture');
      return true;
    } catch (err) {
      restoreCaptureMute();
      return false;
    }
  }

  function hookElement(el) {
    if (!el || (el === hookedEl && source)) return true;
    if (isDrmBlocked(el) || hookLock) return false;
    hookLock = true;
    try {
      ensureContext();
      var existing = elementSourceMap.get(el);
      if (existing) {
        attachSource(existing, el, 'element');
        return true;
      }
      if (burnedElements.has(el)) return hookViaCaptureStream(el);

      try {
        var next = ctx.createMediaElementSource(el);
        elementSourceMap.set(el, next);
        burnedElements.add(el);
        attachSource(next, el, 'element');
        return true;
      } catch (err) {
        burnedElements.add(el);
        // Expected when another graph already owns the element, or after a
        // prior extension context was torn down without a page refresh.
        if (err && err.name === 'InvalidStateError') {
          return hookViaCaptureStream(el);
        }
        return false;
      }
    } finally {
      hookLock = false;
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
    document.addEventListener(
      'play',
      function () {
        if (!active) return;
        if (hookedEl && hookedEl.isConnected) return;
        tryHookOnce();
      },
      true
    );
  }

  function tryHookOnce() {
    var el = findBestMedia();
    return el ? hookElement(el) : false;
  }

  function finishStart(ok, reason) {
    starting = false;
    clearPoll();
    if (!ok) {
      active = false;
      clearObserver();
      if (source) bypassToDestination();
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
      if (settled || (!active && !starting)) return;
      if (tryHookOnce()) done(true, 'hooked');
    });
    try {
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
    } catch (err) {}
    document.addEventListener(
      'play',
      function () {
        if (settled || (!active && !starting)) return;
        if (tryHookOnce()) done(true, 'hooked');
      },
      true
    );
    var tick = function () {
      if (settled || (!starting && !active)) return;
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

  function probeMedia() {
    return !!findBestMedia();
  }

  function start(snapshot, options) {
    options = options || {};
    var hookTimeout = options.fast ? 800 : HOOK_TIMEOUT_MS;
    if (active && hookedEl && source) {
      connectThroughEq();
      applySnapshot(snapshot);
      return Promise.resolve({ ok: true, reason: 'already' });
    }
    if (starting) return Promise.resolve({ ok: false, reason: 'busy' });

    if (hookedEl && source && hookedEl.isConnected) {
      starting = false;
      active = true;
      ensureContext();
      connectThroughEq();
      applySnapshot(snapshot);
      watchForMediaSwap();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
      return Promise.resolve({ ok: true, reason: 'reused' });
    }

    starting = true;
    active = true;
    ensureContext();
    applySnapshot(snapshot);

    if (tryHookOnce()) {
      starting = false;
      return Promise.resolve(finishStart(true, 'hooked'));
    }
    startDeadline = Date.now() + hookTimeout;
    return new Promise(function (resolve) {
      scheduleHookAttempts(resolve);
    });
  }

  function stop() {
    starting = false;
    active = false;
    clearTimers();
    if (hookMode === 'capture') {
      restoreCaptureMute();
      disconnectSourceOnly();
      source = null;
      hookedEl = null;
      hookMode = null;
    } else if (source) {
      bypassToDestination();
    }
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
    rampParam(masterGain.gain, clampMasterGain(msg.gain), msg.smooth ? AUDIO_SMOOTH_TC : AUDIO_FAST_TC);
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
    return !!(active && hookedEl && source);
  }

  function onBridgeCall(event) {
    var detail = event && event.detail;
    if (!detail || !detail.id) return;
    var method = detail.method;
    var args = detail.args || [];
    var result;
    try {
      if (method === 'start') result = start(args[0], args[1]);
      else if (method === 'probeMedia') result = probeMedia();
      else if (method === 'stop') result = stop();
      else if (method === 'applySnapshot') {
        applySnapshot(args[0]);
        result = { ok: true };
      } else if (method === 'modifyFilter') {
        modifyFilter(args[0] || {});
        result = { ok: true };
      } else if (method === 'modifyGain') {
        modifyGain(args[0] || {});
        result = { ok: true };
      } else if (method === 'resetFilters') {
        resetFilters();
        result = { ok: true };
      } else if (method === 'resetFilter') {
        modifyFilter({
          index: args[0] && args[0].index,
          gain: 0,
          frequency: DEFAULT_FREQUENCIES[args[0] && args[0].index],
          q: DEFAULT_Q,
          smooth: !(args[0] && args[0].smooth === false),
        });
        result = { ok: true };
      } else if (method === 'getFft') result = getFft();
      else if (method === 'isActive') result = isActive();
      else result = { ok: false, reason: 'unknown_method' };
    } catch (err) {
      result = { ok: false, reason: String(err && err.message ? err.message : err) };
    }

    Promise.resolve(result).then(function (value) {
      window.dispatchEvent(
        new CustomEvent('soundhub-page-eq-result', {
          detail: { id: detail.id, result: value },
        })
      );
    });
  }

  window.addEventListener('soundhub-page-eq-call', onBridgeCall);

  window.__soundhubPageEqMain = {
    __alive: true,
    start: start,
    stop: stop,
    applySnapshot: applySnapshot,
    modifyFilter: modifyFilter,
    modifyGain: modifyGain,
    resetFilters: resetFilters,
    getFft: getFft,
    isActive: isActive,
    probeMedia: probeMedia,
  };
})();
