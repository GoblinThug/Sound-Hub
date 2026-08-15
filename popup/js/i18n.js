/**
 * UI language — English / Russian.
 */
(function (global) {
  const LANG_KEY = 'UI_LANG';
  const LANGS = [
    { id: 'en', label: 'English', short: 'EN' },
    { id: 'ru', label: 'Русский', short: 'RU' },
  ];

  const STRINGS = {
    en: {
      spectrum: 'Visualizer',
      spectrumTitle: 'Toggle visualizer',
      eqStart: 'EQ This Tab',
      eqStop: 'Stop EQ',
      eqStartTitle: 'Start EQ on this tab',
      eqStopTitle: 'Stop EQ on this tab',
      eqWait: 'Please wait…',
      tabControls: 'Controls',
      tabGuide: 'Guide',
      tabActive: 'Active Tabs',
      tabAutostart: 'Autostart',
      workspaceAria: 'Main workspace',
      masterVolume: 'Master volume',
      equalizer: 'Equalizer',
      presetsDock: 'Presets and tools',
      presetName: 'Preset name',
      save: 'Save',
      saveTitle: 'Save preset',
      deleteTitle: 'Delete preset',
      reset: 'Reset',
      resetTitle: 'Reset all filters',
      exportTitle: 'Export presets',
      importTitle: 'Import presets',
      fullscreen: 'Fullscreen',
      settings: 'Settings',
      settingsHead: 'Settings',
      spectrumToggle: 'Visualizer',
      colorTheme: 'Color theme',
      language: 'Language',
      openGuide: 'Open guide',
      presets: 'Presets',
      bassBoost: 'Bass Boost',
      bassBoostTitle: 'Apply bass boost preset',
      savedPresets: 'Saved presets',
      stopEqTab: 'Stop EQ',
      noActiveTabs: "No tabs active. Click 'EQ This Tab' above to activate this tab.",
      domainsLead:
        'Choose how EQ starts. You can always turn it on with the button; autostart follows the mode below.',
      domainsModeAria: 'EQ autostart mode',
      domainInputAria: 'Domain for the list',
      domainAdd: 'Add',
      domainListAria: 'Domain list',
      domainListEmpty: 'List is empty. Add a domain, e.g. youtube.com',
      domainRemove: 'Remove domain',
      domainRemoveNamed: 'Remove {name}',
      currentTabUnavailable: 'Current tab: unavailable',
      currentTabLine: 'Current tab: {host} — {status}',
      statusManualOnly: 'manual only',
      statusAutostart: 'autostart',
      statusInList: 'in list',
      statusNotInList: 'not in list — manual',
      statusManual: 'manual',
      modeManual: 'Manual',
      modeManualHint: 'EQ turns on only with the button',
      modeAutoAll: 'Auto on all sites',
      modeAutoAllHint: 'EQ starts automatically on any site',
      modeAutoList: 'Auto from list',
      modeAutoListHint: 'EQ starts automatically only on domains below',
      guideHtml: `
<p><strong>SoundHub</strong> equalizes audio from any browser tab in real time.</p>

<h3>Quick start</h3>
<p>Open a tab with sound (YouTube, music, etc.) and click <strong>EQ This Tab</strong>. Click again to stop. You can EQ several tabs at once — switch to another tab and press the button again. Managed tabs are listed under <strong>Active Tabs</strong>.</p>

<h3>Equalizer</h3>
<p>Each movable dot is a filter. Edge dots (usually purple) are shelf filters for bass and treble; the middle dots (cyan) are peaking filters for narrower bands.</p>
<ul>
<li>Drag left / right — frequency</li>
<li>Drag up / down — boost or cut</li>
<li>Shift + drag up / down — change Q (filter width)</li>
<li>The left <strong>vol</strong> slider is master volume</li>
</ul>
<p>Double-click a filter to reset it. <strong>Reset</strong> restores the whole EQ curve.</p>

<h3>Visualizer</h3>
<p>The visualizer overlay shows what you hear after EQ: lows on the left, highs on the right, height is level. Toggle it with <strong>Visualizer</strong> or in Settings. It only runs while EQ is active on the current tab.</p>

<h3>Presets</h3>
<p>Type a name and press <strong>Save</strong> (or Enter). Click a chip to apply a preset. <strong>Bass Boost</strong> is a built-in curve. Export / Import work with SoundHub/Ears JSON and Airs-style configs (<code>nodeGainValues</code> / <code>nodeFrequencyValues</code>).</p>

<h3>Autostart</h3>
<p>On the <strong>Autostart</strong> tab you choose how EQ turns on:</p>
<ul>
<li><strong>Manual</strong> — only with the button</li>
<li><strong>Auto on all sites</strong> — starts when you open any site</li>
<li><strong>Auto from list</strong> — only for domains you add (e.g. youtube.com)</li>
</ul>
<p>You can always stop EQ manually. After a stop on a site, it stays off there until you leave that domain (or start it again yourself).</p>

<h3>Settings</h3>
<p>Open the gear icon for visualizer toggle, color themes, language (English / Russian), and a link to this guide. Fullscreen opens the mixer in a larger window.</p>
`,
    },
    ru: {
      spectrum: 'Визуалайзер',
      spectrumTitle: 'Включить / выключить визуалайзер',
      eqStart: 'EQ вкладки',
      eqStop: 'Стоп EQ',
      eqStartTitle: 'Включить EQ на этой вкладке',
      eqStopTitle: 'Остановить EQ на этой вкладке',
      eqWait: 'Подождите…',
      tabControls: 'Эквалайзер',
      tabGuide: 'Справка',
      tabActive: 'Вкладки',
      tabAutostart: 'Автозапуск',
      workspaceAria: 'Рабочая область',
      masterVolume: 'Громкость',
      equalizer: 'Эквалайзер',
      presetsDock: 'Пресеты и инструменты',
      presetName: 'Имя пресета',
      save: 'Сохранить',
      saveTitle: 'Сохранить пресет',
      deleteTitle: 'Удалить пресет',
      reset: 'Сброс',
      resetTitle: 'Сбросить все фильтры',
      exportTitle: 'Экспорт пресетов',
      importTitle: 'Импорт пресетов',
      fullscreen: 'На весь экран',
      settings: 'Настройки',
      settingsHead: 'Настройки',
      spectrumToggle: 'Визуалайзер',
      colorTheme: 'Цветовая тема',
      language: 'Язык',
      openGuide: 'Открыть справку',
      presets: 'Пресеты',
      bassBoost: 'Bass Boost',
      bassBoostTitle: 'Применить бас-буст',
      savedPresets: 'Сохранённые пресеты',
      stopEqTab: 'Стоп EQ',
      noActiveTabs: 'Нет активных вкладок. Нажмите «EQ вкладки» выше.',
      domainsLead:
        'Выберите, как включать EQ. Кнопкой можно включить всегда; автозапуск — по выбранному режиму.',
      domainsModeAria: 'Режим автозапуска EQ',
      domainInputAria: 'Домен для списка',
      domainAdd: 'Добавить',
      domainListAria: 'Список доменов',
      domainListEmpty: 'Список пуст. Добавьте домен, например youtube.com',
      domainRemove: 'Удалить домен',
      domainRemoveNamed: 'Удалить {name}',
      currentTabUnavailable: 'Текущая вкладка: недоступна',
      currentTabLine: 'Текущая вкладка: {host} — {status}',
      statusManualOnly: 'только вручную',
      statusAutostart: 'автозапуск',
      statusInList: 'в списке',
      statusNotInList: 'не в списке — вручную',
      statusManual: 'вручную',
      modeManual: 'Вручную',
      modeManualHint: 'EQ включается только кнопкой',
      modeAutoAll: 'Авто на всех',
      modeAutoAllHint: 'EQ сам включается на любом сайте',
      modeAutoList: 'Авто из списка',
      modeAutoListHint: 'EQ сам включается только на доменах ниже',
      guideHtml: `
<p><strong>SoundHub</strong> — эквалайзер для звука любой вкладки браузера в реальном времени.</p>

<h3>Быстрый старт</h3>
<p>Откройте вкладку со звуком (YouTube, музыка и т.п.) и нажмите <strong>EQ вкладки</strong>. Повторный клик останавливает EQ. Можно обрабатывать несколько вкладок: перейдите на другую и снова нажмите кнопку. Список активных вкладок — во вкладке <strong>Вкладки</strong>.</p>

<h3>Эквалайзер</h3>
<p>Каждая точка — фильтр. Крайние (обычно фиолетовые) — shelf для баса и верха; средние (голубые) — peaking для узких полос.</p>
<ul>
<li>Влево / вправо — частота</li>
<li>Вверх / вниз — усиление или ослабление</li>
<li>Shift + вверх / вниз — ширина фильтра (Q)</li>
<li>Слайдер <strong>vol</strong> слева — общая громкость</li>
</ul>
<p>Двойной клик по фильтру сбрасывает его. <strong>Сброс</strong> возвращает всю кривую к нулю.</p>

<h3>Визуалайзер</h3>
<p>Визуалайзер показывает, что вы слышите после EQ: низ слева, верх справа, высота — уровень. Включается кнопкой <strong>Визуалайзер</strong> или в настройках. Работает только пока EQ активен на текущей вкладке.</p>

<h3>Пресеты</h3>
<p>Введите имя и нажмите <strong>Сохранить</strong> (или Enter). Клик по чипу применяет пресет. <strong>Bass Boost</strong> — встроенная кривая. Экспорт / импорт поддерживают JSON SoundHub/Ears и конфиги Airs (<code>nodeGainValues</code> / <code>nodeFrequencyValues</code>).</p>

<h3>Автозапуск</h3>
<p>Во вкладке <strong>Автозапуск</strong> выберите, как включать EQ:</p>
<ul>
<li><strong>Вручную</strong> — только кнопкой</li>
<li><strong>Авто на всех</strong> — сам включается на любом сайте</li>
<li><strong>Авто из списка</strong> — только на добавленных доменах (например youtube.com)</li>
</ul>
<p>В любой момент EQ можно остановить вручную. После стопа на сайте он не включится снова, пока вы не уйдёте с этого домена (или не запустите сами).</p>

<h3>Настройки</h3>
<p>В шестерёнке: визуалайзер, цветовые темы, язык (English / Русский) и переход к этой справке. Кнопка полноэкранного режима открывает микшер в большом окне.</p>
`,
    },
  };

  function detectLang() {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored === 'en' || stored === 'ru') return stored;
    } catch (_) {}
    let ui = '';
    try {
      ui = (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || '';
    } catch (_) {}
    if (!ui && typeof navigator !== 'undefined') ui = navigator.language || '';
    return String(ui).toLowerCase().startsWith('ru') ? 'ru' : 'en';
  }

  let currentLang = detectLang();

  function t(key, vars) {
    const table = STRINGS[currentLang] || STRINGS.en;
    let value = table[key];
    if (value == null) value = STRINGS.en[key];
    if (value == null) return key;
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach((k) => {
        value = String(value).replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return value;
  }

  function getLang() {
    return currentLang;
  }

  function setLang(id) {
    if (id !== 'en' && id !== 'ru') return currentLang;
    currentLang = id;
    try {
      localStorage.setItem(LANG_KEY, id);
    } catch (_) {}
    applyDom();
    document.documentElement.lang = id;
    document.dispatchEvent(new CustomEvent('soundhub-lang-change', { detail: { lang: id } }));
    return currentLang;
  }

  function applyAttr(el, attr, key) {
    if (!key) return;
    const value = t(key);
    if (attr === 'text') {
      el.textContent = value;
    } else if (attr === 'html') {
      el.innerHTML = value;
    } else {
      el.setAttribute(attr, value);
    }
  }

  function applyDom(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      applyAttr(el, 'text', el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      applyAttr(el, 'html', el.getAttribute('data-i18n-html'));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      applyAttr(el, 'title', el.getAttribute('data-i18n-title'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      applyAttr(el, 'placeholder', el.getAttribute('data-i18n-placeholder'));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      applyAttr(el, 'aria-label', el.getAttribute('data-i18n-aria'));
    });
  }

  function init() {
    document.documentElement.lang = currentLang;
    applyDom();
  }

  global.SoundHubI18n = {
    LANG_KEY,
    LANGS,
    t,
    getLang,
    setLang,
    applyDom,
    init,
  };
})(typeof window !== 'undefined' ? window : self);
