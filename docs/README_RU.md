# SoundHub (Русский)

Параметрический EQ для любой вкладки браузера (Chrome Manifest V3).

Пресеты, спектр, темы, русский и английский интерфейс. EQ включается **вручную** кнопкой в popup (автозапуска по сайтам нет).

Полная документация: [README.md](../README.md).

## Установка

1. Откройте `chrome://extensions`
2. Включите **Режим разработчика**
3. **Загрузить распакованное расширение**
4. Выберите корень проекта (папка с `manifest.json`)

## Структура

```
SoundHub/
├── manifest.json
├── background/service-worker.js
├── content/
│   ├── page-eq-main.js
│   └── page-eq.js
├── offscreen/
│   ├── offscreen.html
│   └── mv3-bridge.js
├── audio/eq-engine.js
├── shared/domain-filter.js
├── popup/
│   ├── popup.html
│   ├── styles/popup.css
│   └── js/
│       ├── app.js
│       ├── i18n.js
│       ├── themes.js
│       ├── eq-canvas.js
│       └── preset-import.js
├── assets/icons/icon*.png
└── docs/
```

## Примечания

- Page EQ работает в main world страницы (fullscreen на плеерах).
- Tab capture и граф EQ — в offscreen-документе.
- Service worker управляет вкладками и bridge к Chrome API.
- Уязвимости: [SECURITY.md](../SECURITY.md) (не в публичных Issues).
- Лицензия: [MIT](../LICENSE)
