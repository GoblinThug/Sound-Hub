/**
 * Domain helpers for SoundHub (hostname parsing; manual EQ only).
 */
(function (global) {
  const STORAGE_KEY = 'DOMAIN_FILTER';
  const DEFAULT_FILTER = { mode: 'manual', domains: [] };

  function normalizeDomain(input) {
    if (!input || typeof input !== 'string') return '';
    let s = input.trim().toLowerCase();
    if (!s) return '';
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
    s = s.split('/')[0].split('?')[0].split('#')[0];
    if (s.startsWith('www.')) s = s.slice(4);
    return s;
  }

  function hostnameFromUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      return normalizeDomain(new URL(url).hostname);
    } catch (_) {
      return normalizeDomain(url);
    }
  }

  function domainMatches(hostname, pattern) {
    if (!hostname || !pattern) return false;
    const host = normalizeDomain(hostname);
    const rule = normalizeDomain(pattern);
    if (!host || !rule) return false;
    if (host === rule) return true;
    return host.endsWith('.' + rule);
  }

  function migrateMode(mode) {
    // Autostart removed — legacy auto modes map to manual.
    if (mode === 'manual') return 'manual';
    return 'manual';
  }

  function sanitizeFilter(raw) {
    if (!raw || typeof raw !== 'object') {
      return { mode: 'manual', domains: [] };
    }
    const mode = migrateMode(raw.mode);
    const domains = Array.isArray(raw.domains)
      ? [...new Set(raw.domains.map(normalizeDomain).filter(Boolean))]
      : [];
    return { mode, domains };
  }

  function isAllowedForHostname(_hostname, _filter) {
    return true;
  }

  function isAllowedForUrl(_url, _filter) {
    return true;
  }

  function getFilter(cb) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(STORAGE_KEY, (data) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          cb(sanitizeFilter(null));
          return;
        }
        cb(sanitizeFilter(data && data[STORAGE_KEY]));
      });
      return;
    }
    cb(sanitizeFilter(null));
  }

  function setFilter(filter, cb) {
    const sanitized = sanitizeFilter(filter);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ [STORAGE_KEY]: sanitized }, () => {
        if (cb) cb(sanitized);
      });
      return;
    }
    if (cb) cb(sanitized);
  }

  function checkTabAllowed(_tab, cb) {
    cb(true);
  }

  function isListedDomain(url, filter) {
    const cfg = sanitizeFilter(filter);
    if (!cfg.domains.length) return false;
    const host = hostnameFromUrl(url);
    if (!host) return false;
    return cfg.domains.some((d) => domainMatches(host, d));
  }

  /** Autostart removed — always false. */
  function shouldAutoEnable(_url, _filter) {
    return false;
  }

  global.SoundHubDomainFilter = {
    STORAGE_KEY,
    DEFAULT_FILTER,
    normalizeDomain,
    hostnameFromUrl,
    domainMatches,
    sanitizeFilter,
    isAllowedForHostname,
    isAllowedForUrl,
    getFilter,
    setFilter,
    checkTabAllowed,
    isListedDomain,
    shouldAutoEnable,
  };
})(typeof window !== 'undefined' ? window : self);
