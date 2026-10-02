# SoundHub

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)](https://developer.chrome.com/docs/extensions/mv3/)

**English** · [Русский](#-русский)

Parametric equalizer for any browser tab. Chrome / Edge extension (Manifest V3).

Presets, spectrum visualizer, color themes, and English / Russian UI. EQ starts **manually** with the toolbar button — no site autostart.

> Inspired by [Ears Audio Toolkit](https://github.com/Ivanich69/Ears-Audio-Toolkit-with-manifest-3). SoundHub is an independent project, not an official Ears release.

## Features

- Parametric EQ on any `http` / `https` tab
- In-page EQ for HTML5 `<video>` / `<audio>` (keeps native fullscreen on players like YouTube)
- Tab capture fallback for pages without media elements
- Multiple tabs at once (see **Active Tabs**)
- Presets: save, apply, export / import (SoundHub / Ears / Airs-style JSON)
- Real-time spectrum visualizer
- Themes and bilingual UI (EN / RU)

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository root (the folder that contains `manifest.json`)
5. Open a tab with audio → click the SoundHub icon → **EQ This Tab**

After code changes: **Reload** the extension card, then refresh open pages (F5) so content scripts update.

## Releases

Packaged builds are published on [GitHub Releases](https://github.com/GoblinThug/Sound-Hub/releases) as `SoundHub-X.Y.Z.zip`.

Download → unpack → **Load unpacked**, or install from the zip contents as described above.

Version is defined in [`manifest.json`](manifest.json).

## Quick start

1. Play audio or video in a normal website tab
2. Open the SoundHub popup
3. Press **EQ This Tab** to start, again to stop
4. Drag EQ nodes to shape the curve; use **vol** for master gain
5. Save presets from the dock; manage live tabs under **Active Tabs**

## Project layout

```
SoundHub/
├── manifest.json
├── background/service-worker.js   # Tabs, page EQ orchestration, MV3 bridge
├── content/
│   ├── page-eq-main.js            # Main-world media EQ (fullscreen-safe)
│   └── page-eq.js                 # Isolated bridge to the main-world engine
├── offscreen/
│   ├── offscreen.html             # Hidden audio host
│   └── mv3-bridge.js
├── audio/eq-engine.js             # EQ graph + tabCapture
├── shared/domain-filter.js        # Hostname helpers (manual EQ only)
├── popup/
│   ├── popup.html
│   ├── styles/popup.css
│   └── js/                        # app, i18n, themes, canvas, preset import
├── assets/icons/
├── docs/                          # Short EN / RU READMEs
└── .github/                       # Issues, PR template, release workflow
```

## How EQ works

| Path | When | Notes |
|---|---|---|
| **Page EQ** | Tab has `<video>` / `<audio>` | Hooks the media element in-page — fullscreen stays intact |
| **Tab capture** | No HTML5 media (or page EQ fails) | Captures tab audio via `tabCapture` / offscreen host |

Chrome may require a user gesture for tab capture on some pages. Use the popup button on that tab once if capture does not attach.

## Security

- Audio is processed **locally** in the tab and/or offscreen document
- Settings and presets live in `chrome.storage`
- Report vulnerabilities privately — see [SECURITY.md](SECURITY.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) · Russian translation: [LICENSE.ru](LICENSE.ru)

---

# 🇷🇺 Русский

Параметрический эквалайзер для любой вкладки браузера. Расширение Chrome / Edge (Manifest V3).

Пресеты, спектр, цветовые темы, интерфейс на английском и русском. EQ включается **только вручную** кнопкой — автозапуска по сайтам нет.

> Вдохновлено [Ears Audio Toolkit](https://github.com/Ivanich69/Ears-Audio-Toolkit-with-manifest-3). SoundHub — самостоятельный проект, не официальный релиз Ears.

## Возможности

- Параметрический EQ на любой вкладке `http` / `https`
- In-page EQ для HTML5 `<video>` / `<audio>` (нативный fullscreen на YouTube и похожих плеерах)
- Fallback через tab capture, если на странице нет медиаэлементов
- Несколько вкладок одновременно (вкладка **Вкладки**)
- Пресеты: сохранение, применение, экспорт / импорт
- Спектр в реальном времени
- Темы и двуязычный UI

## Установка (распакованное)

1. Откройте `chrome://extensions` (или `edge://extensions`)
2. Включите **Режим разработчика**
3. **Загрузить распакованное расширение**
4. Выберите корень репозитория (папка с `manifest.json`)
5. Откройте вкладку со звуком → иконка SoundHub → **EQ вкладки**

После правок кода: **Обновить** карточку расширения, затем F5 на открытых страницах.

## Релизы

Сборки: [GitHub Releases](https://github.com/GoblinThug/Sound-Hub/releases) (`SoundHub-X.Y.Z.zip`).

Версия задаётся в [`manifest.json`](manifest.json).

## Как работает EQ

| Путь | Когда | Заметка |
|---|---|---|
| **Page EQ** | Есть `<video>` / `<audio>` | Подключение к медиаэлементу — fullscreen не ломается |
| **Tab capture** | Нет HTML5-медиа (или page EQ не сработал) | Захват звука вкладки через offscreen |

Chrome иногда требует жест пользователя для tab capture — один клик по кнопке в popup обычно достаточно.

## Безопасность

Звук обрабатывается локально. Уязвимости — только приватно: [SECURITY.md](SECURITY.md).

## Участие

[CONTRIBUTING.md](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md)

## Лицензия

[MIT](LICENSE) · [LICENSE.ru](LICENSE.ru)
