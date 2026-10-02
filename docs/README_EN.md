# SoundHub (English)

Parametric EQ for any browser tab (Chrome Manifest V3).

Presets, spectrum visualizer, themes, and English / Russian UI. EQ starts **manually** via the popup button (no site autostart).

Full documentation: [README.md](../README.md).

## Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the project root (folder with `manifest.json`)

## Project layout

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

## Notes

- Page EQ runs in the page’s main world for media elements (fullscreen-safe).
- Tab capture / EQ graph run in an offscreen document.
- The service worker orchestrates tabs and bridges Chrome APIs.
- Security reports: [SECURITY.md](../SECURITY.md) (not public Issues).
- License: [MIT](../LICENSE)
