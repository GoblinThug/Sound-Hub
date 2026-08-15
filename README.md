# SoundHub

<p align="center">
  <img src="assets/icons/icon128.png" alt="SoundHub" width="96" height="96">
</p>

<p align="center">
  <strong>Параметрический EQ для любой вкладки Chrome</strong><br>
  Пресеты · визуалайзер · автозапуск на сайтах · темы
</p>

<p align="center">
  <a href="#-русский">Русский</a> · <a href="#-english">English</a>
</p>

<p align="center">
  <a href="https://github.com/GoblinThug/SoundHub/issues/new/choose">🐞 Сообщить о проблеме</a>
  ·
  <a href="CONTRIBUTING.md">🤝 Contributing</a>
  ·
  <a href="LICENSE">MIT</a>
</p>

---

# 🇷🇺 Русский

## ✨ Что это

**SoundHub** — расширение Chrome (Manifest V3): параметрический эквалайзер для звука выбранной вкладки. Пресеты, спектр (Visualizer), автозапуск по доменам, темы и интерфейс на русском и английском.

| | Возможность |
|---|---|
| 🎚️ | Параметрический EQ с плавными переходами |
| 💾 | Пресеты (в т.ч. Bass Boost) и импорт (Ears / Airs) |
| 📊 | Visualizer спектра в popup |
| 🌐 | Автозапуск по доменам (whitelist / blacklist) |
| 🎨 | Цветовые темы |
| 🌍 | Русский / English |
| 🔇 | Старт/стоп EQ для активной вкладки |

Текущая версия: **`1.0.0`** (`manifest.json`).

---

## ⬇️ Установка (Load unpacked)

**Готовый архив:** [Releases](https://github.com/GoblinThug/SoundHub/releases/latest) → скачайте `SoundHub-….zip`, распакуйте.

Или склонируйте репозиторий / ZIP с кнопки Code.

1. Откройте `chrome://extensions`
2. Включите **Режим разработчика**
3. **Загрузить распакованное расширение** → папка с `manifest.json` (внутри архива — `SoundHub/`)

> При пуше в `main` (или тега `v*`) GitHub Actions собирает ZIP и публикует Release. Версия берётся из `manifest.json`.

> Работает в Chromium-браузерах с поддержкой MV3 и `tabCapture` (Chrome, Edge и аналоги). Страницы `chrome://` захватить нельзя — ограничение браузера.

Подробнее: [docs/README_RU.md](docs/README_RU.md).

---

## 📁 Структура

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
│   └── js/…
├── assets/icons/
├── docs/
├── LICENSE · LICENSE.ru
├── SECURITY.md
├── CONTRIBUTING.md
└── CODE_OF_CONDUCT.md
```

---

## 🔐 Безопасность

- Звук обрабатывается **локально** (offscreen + Web Audio API).
- Настройки и пресеты — в `chrome.storage` на вашем устройстве.
- Уязвимости **не** публикуйте в обычных Issues — см. [SECURITY.md](SECURITY.md).

---

## 🤝 Участие

Как внести правки и оформить PR: [CONTRIBUTING.md](CONTRIBUTING.md).  
Правила общения: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## 📄 Лицензия

[MIT](LICENSE) · неофициальный перевод: [LICENSE.ru](LICENSE.ru)

Автор: [Goblin Thug](https://github.com/GoblinThug)

---

# 🇬🇧 English

## ✨ What it is

**SoundHub** is a Chrome extension (Manifest V3): a parametric EQ for the audio of the selected tab. Presets, spectrum visualizer, domain autostart, themes, and English/Russian UI.

| | Feature |
|---|---|
| 🎚️ | Parametric EQ with smooth transitions |
| 💾 | Presets (incl. Bass Boost) and import (Ears / Airs) |
| 📊 | Spectrum visualizer in the popup |
| 🌐 | Domain autostart (whitelist / blacklist) |
| 🎨 | Color themes |
| 🌍 | English / Russian |
| 🔇 | Start/stop EQ for the active tab |

Current version: **`1.0.0`** (`manifest.json`).

---

## ⬇️ Install (Load unpacked)

**Ready ZIP:** [Releases](https://github.com/GoblinThug/SoundHub/releases/latest) → download `SoundHub-….zip` and extract.

Or clone the repo / use Code → Download ZIP.

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → folder with `manifest.json` (inside the archive: `SoundHub/`)

> A push to `main` (or a `v*` tag) runs GitHub Actions: packs a ZIP and publishes a Release. Version comes from `manifest.json`.

> Works in Chromium browsers with MV3 and `tabCapture` (Chrome, Edge, and similar). `chrome://` pages cannot be captured — a browser limitation.

More detail: [docs/README_EN.md](docs/README_EN.md).

---

## 📁 Layout

Same tree as above — see the Russian section.

---

## 🔐 Security

- Audio is processed **locally** (offscreen + Web Audio API).
- Settings and presets stay in `chrome.storage` on your device.
- Do **not** report vulnerabilities in public Issues — see [SECURITY.md](SECURITY.md).

---

## 🤝 Contributing

How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md).  
Community norms: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## 📄 License

[MIT](LICENSE) · Russian translation: [LICENSE.ru](LICENSE.ru)

Author: [Goblin Thug](https://github.com/GoblinThug)
