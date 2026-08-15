# SoundHub

Параметрический EQ для любой вкладки браузера (Chrome Manifest V3).

Пресеты, спектр, автозапуск, темы, русский и английский интерфейс.

Полная двуязычная документация, лицензия и гайды — в корне репозитория: [README.md](../README.md).

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
│       ├── domains.js
│       ├── eq-canvas.js
│       └── preset-import.js
├── assets/icons/icon*.png
└── docs/
```

## Примечания

- Обработка звука идёт в offscreen-документе.
- Service worker отвечает за вкладки, автозапуск и bridge к Chrome API.
- Уязвимости: [SECURITY.md](../SECURITY.md) (не в публичных Issues).
- Лицензия: [MIT](../LICENSE)
