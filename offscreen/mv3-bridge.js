/**
 * MV3 offscreen bridge — shims chrome.* APIs via the service worker.
 */
/* MV3 offscreen bridge */
(function(){
  if (typeof chrome === 'undefined' || !chrome.runtime) { return; }
  function bridge(type, payload, cb) {
    try {
      chrome.runtime.sendMessage({__soundhubBridge: true, type: type, payload: payload}, function(response) {
        if (cb) cb(response || {});
      });
    } catch (err) {
      console.error(err);
      if (cb) cb({ error: err && err.message });
    }
  }

  var tabCaptureListeners = [];
  var storageListeners = [];

  chrome.runtime.onMessage.addListener(function(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.__soundhubBridgeEvent === 'tabCapture.onStatusChanged') {
      tabCaptureListeners.forEach(function(fn) {
        try { fn(msg.payload); } catch (e) { console.error(e); }
      });
    }
    if (msg.__soundhubBridgeEvent === 'storage.onChanged') {
      storageListeners.forEach(function(fn) {
        try { fn(msg.payload, msg.area || 'sync'); } catch (e) { console.error(e); }
      });
    }
  });

  chrome.storage = chrome.storage || {};
  if (!chrome.storage.sync) {
    chrome.storage.sync = {
      get: function(keys, cb) { bridge('storage.sync.get', { keys: keys }, function(res) { if (cb) cb(res.data || {}); }); },
      set: function(items, cb) { bridge('storage.sync.set', { items: items }, function() { if (cb) cb(); }); },
      remove: function(keys, cb) { bridge('storage.sync.remove', { keys: keys }, function() { if (cb) cb(); }); }
    };
  }
  if (!chrome.storage.onChanged) {
    chrome.storage.onChanged = { addListener: function(fn) { storageListeners.push(fn); } };
  }

  chrome.tabs = chrome.tabs || {};
  if (!chrome.tabs.query) {
    chrome.tabs.query = function(queryInfo, cb) { bridge('tabs.query', { queryInfo: queryInfo }, function(res) { if (cb) cb(res.data || []); }); };
  }
  if (!chrome.tabs.getSelected) {
    chrome.tabs.getSelected = function(windowId, cb) { bridge('tabs.getSelected', { windowId: windowId }, function(res) { if (cb) cb(res.data || null); }); };
  }
  if (!chrome.tabs.get) {
    chrome.tabs.get = function(tabId, cb) { bridge('tabs.get', { tabId: tabId }, function(res) { if (cb) cb(res.data || null); }); };
  }

  chrome.windows = chrome.windows || {};
  if (typeof chrome.windows.WINDOW_ID_CURRENT === 'undefined') {
    chrome.windows.WINDOW_ID_CURRENT = -2;
  }
  if (!chrome.windows.get) {
    chrome.windows.get = function(windowId, getInfo, cb) { bridge('windows.get', { windowId: windowId, getInfo: getInfo }, function(res) { if (cb) cb(res.data || null); }); };
  }
  if (!chrome.windows.update) {
    chrome.windows.update = function(windowId, updateInfo, cb) { bridge('windows.update', { windowId: windowId, updateInfo: updateInfo }, function(res) { if (cb) cb(res.data || null); }); };
  }

  chrome.tabCapture = chrome.tabCapture || {};
  if (!chrome.tabCapture.capture) {
    chrome.tabCapture.capture = function(options, cb) {
      bridge('tabCapture.getMediaStreamId', { options: options || {} }, async function(res) {
        try {
          if (res && res.error) {
            // Expected for chrome:// pages or missing tab access — keep console quiet.
            if (cb) cb(null);
            return;
          }
          var streamId = res && res.data && res.data.streamId;
          if (!streamId) {
            if (cb) cb(null);
            return;
          }
          var audio = (options && options.audio === false) ? false : {
            mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId }
          };
          var video = (options && options.video) ? {
            mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId }
          } : false;
          var stream = await navigator.mediaDevices.getUserMedia({ audio: audio, video: video });
          if (cb) cb(stream);
        } catch (err) {
          console.warn('tabCapture getUserMedia failed:', err && err.message ? err.message : err);
          if (cb) cb(null);
        }
      });
    };
  }
  if (!chrome.tabCapture.onStatusChanged) {
    chrome.tabCapture.onStatusChanged = { addListener: function(fn) { tabCaptureListeners.push(fn); } };
  }
})();
// MV3/Brave fallback: offscreen runtime may lack getManifest/id
if (typeof chrome !== 'undefined' && chrome.runtime) {
  if (typeof chrome.runtime.getManifest !== 'function') {
    chrome.runtime.getManifest = function() { return { version: '0.0.0' }; };
  }
  if (!chrome.runtime.id) {
    try { chrome.runtime.id = location.host; } catch (e) {}
  }
}
