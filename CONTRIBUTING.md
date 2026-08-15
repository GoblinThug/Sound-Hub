# Contributing to SoundHub

Русский · [English](#-english)

---

# 🇷🇺 Русский

Спасибо за интерес к проекту. Ниже — как быстро войти в разработку и оформить изменения.

## С чего начать

1. Найдите или создайте [Issue](https://github.com/GoblinThug/SoundHub/issues) с описанием бага или идеи.
2. Сделайте fork и ветку от `main` (например `fix/eq-fade` или `feat/preset-export`).
3. Внесите изменения, проверьте локально в Chrome (Load unpacked), откройте Pull Request.

Небольшие правки (опечатки, README, стили) можно присылать сразу — отдельный issue не обязателен.

## Локальный запуск

Сборка не нужна: это Chrome-расширение (Manifest V3).

```bash
git clone https://github.com/GoblinThug/SoundHub.git
cd SoundHub
```

1. Откройте `chrome://extensions`
2. Включите **Режим разработчика**
3. **Загрузить распакованное расширение** → корень репозитория (папка с `manifest.json`)
4. После правок нажмите **Обновить** на карточке расширения; popup переоткройте

Для отладки audio-движка: DevTools у offscreen-документа (через service worker → Inspect views).

## Структура

| Путь | Назначение |
|---|---|
| `manifest.json` | MV3-манифест |
| `background/` | Service worker: вкладки, автозапуск, bridge |
| `offscreen/` | Скрытый audio-host + shim Chrome API |
| `audio/` | EQ-движок и захват вкладок |
| `shared/` | Фильтр доменов / автозапуск |
| `popup/` | UI: HTML, CSS, JS-модули |
| `assets/icons/` | Иконки расширения |
| `docs/` | Доп. README (EN / RU) |
| `.github/` | Issues / security / шаблоны |

## Что желательно соблюдать

- Не коммитьте секреты, `.env`, личные пресеты с чувствительными данными.
- Держите PR сфокусированным: одна задача — один PR.
- UI-строки добавляйте в `popup/js/i18n.js` (**en** и **ru**).
- Для багов приложите ОС, версию Chrome, версию расширения и шаги воспроизведения.
- Для UI — скриншот «до/после», если уместно.

## Безопасность

Уязвимости **не** публикуйте в обычных Issues. См. [SECURITY.md](SECURITY.md).

## Лицензия

Внося вклад, вы соглашаетесь, что ваш код распространяется под [MIT](LICENSE) (русский перевод: [LICENSE.ru](LICENSE.ru)).

---

# 🇬🇧 English

Thanks for your interest. Here’s how to get started and submit changes.

## Getting started

1. Find or open an [Issue](https://github.com/GoblinThug/SoundHub/issues) describing the bug or idea.
2. Fork and branch from `main` (e.g. `fix/eq-fade` or `feat/preset-export`).
3. Make your changes, test locally in Chrome (Load unpacked), open a Pull Request.

Tiny fixes (typos, README, styling) can skip a separate issue.

## Local setup

No build step: this is a Chrome extension (Manifest V3).

```bash
git clone https://github.com/GoblinThug/SoundHub.git
cd SoundHub
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → repo root (folder with `manifest.json`)
4. After edits, click **Reload** on the extension card; reopen the popup

To debug the audio engine: DevTools on the offscreen document (via the service worker → Inspect views).

## Layout

| Path | Purpose |
|---|---|
| `manifest.json` | MV3 manifest |
| `background/` | Service worker: tabs, autostart, bridge |
| `offscreen/` | Hidden audio host + Chrome API shim |
| `audio/` | EQ engine and tab capture |
| `shared/` | Domain filter / autostart |
| `popup/` | UI: HTML, CSS, JS modules |
| `assets/icons/` | Extension icons |
| `docs/` | Extra READMEs (EN / RU) |
| `.github/` | Issues / security / templates |

## Guidelines

- Never commit secrets, `.env`, or personal presets with sensitive data.
- Keep PRs focused: one concern per PR.
- Add UI strings in `popup/js/i18n.js` (**en** and **ru**).
- For bugs: include OS, Chrome version, extension version, and reproduction steps.
- For UI: before/after screenshots when helpful.

## Security

Do **not** report vulnerabilities in public Issues. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree your work is licensed under [MIT](LICENSE) (Russian translation: [LICENSE.ru](LICENSE.ru)).
