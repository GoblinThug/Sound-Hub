/**
 * Isolated-world bridge to the main-world page EQ engine.
 * Receives extension messages and forwards them via CustomEvent.
 */
(function () {
  'use strict';

  if (globalThis.__soundhubPageEq) return;

  var DEFAULT_FREQUENCIES = [
    20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
  ];
  var DEFAULT_Q = 0.7071;
  var seq = 0;

  function callMain(method, args) {
    return new Promise(function (resolve) {
      var id = 'sh' + String(++seq) + '_' + Date.now();
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        window.removeEventListener('soundhub-page-eq-result', onResult);
        resolve({ ok: false, reason: 'bridge_timeout' });
      }, 6000);

      function onResult(event) {
        var detail = event && event.detail;
        if (!detail || detail.id !== id || done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('soundhub-page-eq-result', onResult);
        resolve(detail.result);
      }

      window.addEventListener('soundhub-page-eq-result', onResult);
      window.dispatchEvent(
        new CustomEvent('soundhub-page-eq-call', {
          detail: { id: id, method: method, args: args || [] },
        })
      );
    });
  }

  function start(snapshot, options) {
    return callMain('start', [snapshot || { filters: [], gain: 1 }, options || {}]);
  }

  function probeMedia() {
    return callMain('probeMedia').then(function (v) {
      return !!v;
    });
  }

  function stop() {
    return callMain('stop');
  }

  function applySnapshot(snap) {
    return callMain('applySnapshot', [snap]);
  }

  function modifyFilter(msg) {
    return callMain('modifyFilter', [msg]);
  }

  function modifyGain(msg) {
    return callMain('modifyGain', [msg]);
  }

  function resetFilters() {
    return callMain('resetFilters');
  }

  function getFft() {
    return callMain('getFft').then(function (fft) {
      return fft;
    });
  }

  function isActive() {
    return callMain('isActive').then(function (v) {
      return !!v;
    });
  }

  globalThis.__soundhubPageEq = {
    start: start,
    stop: stop,
    applySnapshot: function (snap) {
      applySnapshot(snap);
    },
    modifyFilter: function (msg) {
      modifyFilter(msg);
    },
    modifyGain: function (msg) {
      modifyGain(msg);
    },
    resetFilters: resetFilters,
    getFft: function () {
      // sync API used by executeScript paths expects a value; prefer async bridge via messages
      return null;
    },
    getFftAsync: getFft,
    isActive: function () {
      return false;
    },
    isActiveAsync: isActive,
  };

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'pageEq.start':
        start(msg.snapshot || { filters: [], gain: 1 }, msg.options || {}).then(function (res) {
          sendResponse(res || { ok: false });
        });
        return true;
      case 'pageEq.probe':
        probeMedia().then(function (hasMedia) {
          sendResponse({ hasMedia: !!hasMedia });
        });
        return true;
      case 'pageEq.ping':
        isActive().then(function (active) {
          sendResponse({ ready: true, active: active });
        });
        return true;
      case 'pageEq.stop':
        stop().then(function (res) {
          sendResponse(res || { ok: true });
        });
        return true;
      case 'pageEq.applySnapshot':
        applySnapshot(msg).then(function () {
          sendResponse({ ok: true });
        });
        return true;
      case 'modifyFilter':
        modifyFilter(msg);
        break;
      case 'modifyGain':
        modifyGain(msg);
        break;
      case 'resetFilters':
        resetFilters();
        break;
      case 'resetFilter':
        modifyFilter({
          index: msg.index,
          gain: 0,
          frequency: DEFAULT_FREQUENCIES[msg.index],
          q: DEFAULT_Q,
          smooth: msg.smooth !== false,
        });
        break;
      case 'pageEq.getFFT':
        getFft().then(function (fft) {
          sendResponse({ type: 'fft', fft: fft });
        });
        return true;
      default:
        break;
    }
  });

})();
