# SoundHub

Parametric EQ for any browser tab (Chrome Manifest V3).

Presets, spectrum visualizer, site autostart, themes, and English/Russian UI.

Full bilingual docs, license, and contribution guides live in the repo root: [README.md](../README.md).

## Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the project root (the folder with `manifest.json`)

## Project layout

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

## Notes

- Audio processing runs in an offscreen document.
- The service worker handles tab events, autostart, and API bridging.
- Security reports: [SECURITY.md](../SECURITY.md) (not public Issues).
- License: [MIT](../LICENSE)
