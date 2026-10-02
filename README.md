# Ears Audio Toolkit (Manifest V3)

Неофициальный порт [Ears Audio Toolkit MV3](https://github.com/Ivanich69/Ears-Audio-Toolkit-with-manifest-3) — функционально идентичен оригиналу, исходники разложены по папкам. 

## Структура

```
audioPlugin/
├── manifest.json          # Манифест расширения
├── background/
│   └── sw.js              # Service worker (MV3-мост)
├── audio/
│   ├── bg.js              # EQ-движок Ears
│   ├── mixer-graph.js     # 8-канальный микшер
│   └── mixer-integration.js
├── offscreen/
│   └── offscreen.html     # Offscreen host (подключает bg.js)
├── popup/
│   ├── popup.html         # UI popup
│   ├── popup.js
│   └── popup.css
├── vendor/
│   └── snap.svg-min.js    # Snap.svg для графика EQ
└── assets/icons/
    └── ears*.png          # Иконки расширения
```

## Установка

1. Откройте `chrome://extensions`
2. Включите **Developer mode**
3. **Load unpacked** → выберите папку `audioPlugin`
4. Откройте вкладку с аудио/видео → нажмите иконку Ears → **EQ Current Tab**

## Примечание

Это порт для совместимости с Manifest V3, не официальный релиз автора Ears. Перед публикацией проверьте лицензию оригинального расширения.
