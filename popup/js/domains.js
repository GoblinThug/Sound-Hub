/**
 * Domains tab — choose how EQ auto-starts, and manage the domain list.
 */
(function () {
  const MODE_IDS = ['manual', 'auto_all', 'auto_list'];

  let filterState = { mode: 'manual', domains: [] };
  let currentTabUrl = '';

  function el(id) {
    return document.getElementById(id);
  }

  function t(key, vars) {
    return window.SoundHubI18n ? window.SoundHubI18n.t(key, vars) : key;
  }

  function modeMeta(id) {
    if (id === 'manual') {
      return { label: t('modeManual'), hint: t('modeManualHint') };
    }
    if (id === 'auto_all') {
      return { label: t('modeAutoAll'), hint: t('modeAutoAllHint') };
    }
    return { label: t('modeAutoList'), hint: t('modeAutoListHint') };
  }

  function renderCurrentTab() {
    const root = el('domainsCurrentTab');
    if (!root || !window.SoundHubDomainFilter) return;

    const host = window.SoundHubDomainFilter.hostnameFromUrl(currentTabUrl);
    if (!host) {
      root.textContent = t('currentTabUnavailable');
      root.className = 'domains-current is-muted';
      return;
    }

    const auto = window.SoundHubDomainFilter.shouldAutoEnable(currentTabUrl, filterState);
    const listed = window.SoundHubDomainFilter.isListedDomain(currentTabUrl, filterState);

    let status;
    if (filterState.mode === 'manual') {
      status = t('statusManualOnly');
    } else if (auto) {
      status = t('statusAutostart');
    } else if (filterState.mode === 'auto_list') {
      status = listed ? t('statusInList') : t('statusNotInList');
    } else {
      status = t('statusManual');
    }

    root.textContent = t('currentTabLine', { host, status });
    root.className = 'domains-current ' + (auto ? 'is-allowed' : 'is-muted');
  }

  function renderModePicker() {
    const root = el('domainsModePicker');
    if (!root) return;
    root.innerHTML = '';
    root.setAttribute('role', 'radiogroup');
    root.setAttribute('aria-label', t('domainsModeAria'));

    MODE_IDS.forEach((id) => {
      const meta = modeMeta(id);
      const label = document.createElement('label');
      label.className =
        'domains-mode-option' + (filterState.mode === id ? ' is-active' : '');

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'domain-mode';
      input.value = id;
      input.checked = filterState.mode === id;

      const body = document.createElement('span');
      body.className = 'domains-mode-body';

      const title = document.createElement('span');
      title.className = 'domains-mode-title';
      title.textContent = meta.label;

      const hint = document.createElement('span');
      hint.className = 'domains-mode-hint';
      hint.textContent = meta.hint;

      body.appendChild(title);
      body.appendChild(hint);

      input.addEventListener('change', () => {
        if (!input.checked) return;
        filterState = { ...filterState, mode: id };
        persistFilter();
      });

      label.appendChild(input);
      label.appendChild(body);
      root.appendChild(label);
    });

    const listBlock = el('domainsListBlock');
    if (listBlock) {
      listBlock.hidden = filterState.mode !== 'auto_list';
    }
  }

  function renderDomainList() {
    const root = el('domainList');
    if (!root) return;
    root.innerHTML = '';

    if (!filterState.domains.length) {
      const empty = document.createElement('li');
      empty.className = 'domain-list-empty';
      empty.textContent = t('domainListEmpty');
      root.appendChild(empty);
      return;
    }

    filterState.domains.forEach((domain) => {
      const item = document.createElement('li');
      item.className = 'domain-list-item';

      const name = document.createElement('span');
      name.className = 'domain-list-name';
      name.textContent = domain;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-icon btn-danger btn-filled-icon domain-remove';
      btn.title = t('domainRemove');
      btn.setAttribute('aria-label', t('domainRemoveNamed', { name: domain }));
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M3 6.38597C3 5.90152 3.34538 5.50879 3.77143 5.50879L6.43567 5.50832C6.96502 5.49306 7.43202 5.11033 7.61214 4.54412C7.61688 4.52923 7.62232 4.51087 7.64185 4.44424L7.75665 4.05256C7.8269 3.81241 7.8881 3.60318 7.97375 3.41617C8.31209 2.67736 8.93808 2.16432 9.66147 2.03297C9.84457 1.99972 10.0385 1.99986 10.2611 2.00002H13.7391C13.9617 1.99986 14.1556 1.99972 14.3387 2.03297C15.0621 2.16432 15.6881 2.67736 16.0264 3.41617C16.1121 3.60318 16.1733 3.81241 16.2435 4.05256L16.3583 4.44424C16.3778 4.51087 16.3833 4.52923 16.388 4.54412C16.5682 5.11033 17.1278 5.49353 17.6571 5.50879H20.2286C20.6546 5.50879 21 5.90152 21 6.38597C21 6.87043 20.6546 7.26316 20.2286 7.26316H3.77143C3.34538 7.26316 3 6.87043 3 6.38597Z" fill="currentColor"/>' +
        '<path fill-rule="evenodd" clip-rule="evenodd" d="M11.5956 22.0001H12.4044C15.1871 22.0001 16.5785 22.0001 17.4831 21.1142C18.3878 20.2283 18.4803 18.7751 18.6654 15.8686L18.9321 11.6807C19.0326 10.1037 19.0828 9.31524 18.6289 8.81558C18.1751 8.31592 17.4087 8.31592 15.876 8.31592H8.12404C6.59127 8.31592 5.82488 8.31592 5.37105 8.81558C4.91722 9.31524 4.96744 10.1037 5.06788 11.6807L5.33459 15.8686C5.5197 18.7751 5.61225 20.2283 6.51689 21.1142C7.42153 22.0001 8.81289 22.0001 11.5956 22.0001ZM10.2463 12.1886C10.2051 11.7548 9.83753 11.4382 9.42537 11.4816C9.01321 11.525 8.71251 11.9119 8.75372 12.3457L9.25372 17.6089C9.29494 18.0427 9.66247 18.3593 10.0746 18.3159C10.4868 18.2725 10.7875 17.8856 10.7463 17.4518L10.2463 12.1886ZM14.5746 11.4816C14.9868 11.525 15.2875 11.9119 15.2463 12.3457L14.7463 17.6089C14.7051 18.0427 14.3375 18.3593 13.9254 18.3159C13.5132 18.2725 13.2125 17.8856 13.2537 17.4518L13.7537 12.1886C13.7949 11.7548 14.1625 11.4382 14.5746 11.4816Z" fill="currentColor"/>' +
        '</svg>';
      btn.addEventListener('click', () => {
        filterState = {
          ...filterState,
          domains: filterState.domains.filter((d) => d !== domain),
        };
        persistFilter();
      });

      item.appendChild(name);
      item.appendChild(btn);
      root.appendChild(item);
    });
  }

  function renderAll() {
    renderModePicker();
    renderDomainList();
    renderCurrentTab();
  }

  function persistFilter() {
    if (!window.SoundHubDomainFilter) return;
    window.SoundHubDomainFilter.setFilter(filterState, (saved) => {
      filterState = saved;
      renderAll();
      document.dispatchEvent(
        new CustomEvent('soundhub-domains-change', { detail: saved })
      );
      try {
        chrome.runtime.sendMessage({ type: 'syncDomainFilterNow', filter: saved }, () => {
          void chrome.runtime.lastError;
        });
      } catch (_) {}
    });
  }

  function addDomainFromInput() {
    const input = el('domainInput');
    if (!input || !window.SoundHubDomainFilter) return;

    const normalized = window.SoundHubDomainFilter.normalizeDomain(input.value);
    if (!normalized) {
      input.focus();
      return;
    }
    if (filterState.domains.includes(normalized)) {
      input.value = '';
      return;
    }

    filterState = {
      ...filterState,
      domains: [...filterState.domains, normalized].sort(),
    };
    input.value = '';
    persistFilter();
  }

  function refreshCurrentTab() {
    if (!chrome.tabs || !chrome.tabs.query) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      currentTabUrl = (tabs && tabs[0] && tabs[0].url) || '';
      renderCurrentTab();
    });
  }

  function bindControls() {
    el('domainAddButton')?.addEventListener('click', addDomainFromInput);
    el('domainInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addDomainFromInput();
    });
  }

  function init() {
    if (!window.SoundHubDomainFilter) return;
    bindControls();
    window.SoundHubDomainFilter.getFilter((filter) => {
      filterState = filter;
      renderAll();
      refreshCurrentTab();
    });

    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync' || !changes[window.SoundHubDomainFilter.STORAGE_KEY]) return;
        filterState = window.SoundHubDomainFilter.sanitizeFilter(
          changes[window.SoundHubDomainFilter.STORAGE_KEY].newValue
        );
        renderAll();
      });
    }

    document.getElementById('tab-4')?.addEventListener('change', function onDomainsTab() {
      if (this.checked) refreshCurrentTab();
    });

    document.addEventListener('soundhub-lang-change', () => {
      renderAll();
    });
  }

  window.SoundHubDomains = {
    init,
    refreshCurrentTab,
    getFilterState: () => filterState,
    isCurrentTabAllowed: () => true,
  };

  document.addEventListener('DOMContentLoaded', init);
})();
