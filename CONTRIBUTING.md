# Contributing to SoundHub

**English** · [Русский](#-русский)

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
5. Refresh open site tabs (F5) so content scripts pick up changes

To debug the audio engine: DevTools on the offscreen document (via the service worker → Inspect views).

## Layout

| Path | Purpose |
|---|---|
| `manifest.json` | MV3 manifest |
| `background/` | Service worker: tabs, page EQ orchestration, API bridge |
| `content/` | In-page EQ (main + isolated worlds) |
| `offscreen/` | Hidden audio host + Chrome API shim |
| `audio/` | EQ engine and tab capture |
| `shared/` | Hostname helpers |
| `popup/` | UI: HTML, CSS, JS modules |
| `assets/icons/` | Extension icons |
| `docs/` | Short READMEs (EN / RU) |
| `.github/` | Issues / security / release workflow |

## Releases

Version lives in `manifest.json`. After a merge to `main`, [`.github/workflows/release.yml`](.github/workflows/release.yml) packs `SoundHub-X.Y.Z.zip` and publishes a [GitHub Release](https://github.com/GoblinThug/SoundHub/releases) tagged `vX.Y.Z`.

To ship a new version: bump `"version"` in the manifest → push to `main` (or push tag `vX.Y.Z`).

## Guidelines

- Never commit secrets, `.env`, or personal presets with sensitive data.
- Keep PRs focused: one concern per PR.
- Add UI strings in `popup/js/i18n.js` (**en** and **ru**). Prefer English copy first, then Russian.
- For bugs: include OS, Chrome version, extension version, and reproduction steps.
- For UI: before/after screenshots when helpful.
- EQ starts only from the popup button — do not reintroduce site autostart unless it is an explicit, reviewed feature request.

## Security

Do **not** report vulnerabilities in public Issues. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree your work is licensed under [MIT](LICENSE) (Russian translation: [LICENSE.ru](LICENSE.ru)).

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
5. Обновите открытые сайты (F5), чтобы подтянуть content scripts

Для отладки audio-движка: DevTools у offscreen-документа (через service worker → Inspect views).

## Структура

| Путь | Назначение |
|---|---|
| `manifest.json` | MV3-манифест |
| `background/` | Service worker: вкладки, page EQ, bridge |
| `content/` | In-page EQ (main + isolated) |
| `offscreen/` | Скрытый audio-host + shim Chrome API |
| `audio/` | EQ-движок и захват вкладок |
| `shared/` | Хелперы hostname |
| `popup/` | UI: HTML, CSS, JS-модули |
| `assets/icons/` | Иконки расширения |
| `docs/` | Краткие README (EN / RU) |
| `.github/` | Issues / security / шаблоны |

## Релизы

Версия живёт в `manifest.json`. После мержа в `main` workflow [`.github/workflows/release.yml`](.github/workflows/release.yml) собирает `SoundHub-X.Y.Z.zip` и публикует [GitHub Release](https://github.com/GoblinThug/SoundHub/releases) с тегом `vX.Y.Z`.

Чтобы выпустить новую версию: поднимите `"version"` в манифесте → push в `main` (или запушьте тег `vX.Y.Z`).

## Что желательно соблюдать

- Не коммитьте секреты, `.env`, личные пресеты с чувствительными данными.
- Держите PR сфокусированным: одна задача — один PR.
- UI-строки добавляйте в `popup/js/i18n.js` (**en** и **ru**). Сначала английский текст, затем русский.
- Для багов приложите ОС, версию Chrome, версию расширения и шаги воспроизведения.
- Для UI — скриншот «до/после», если уместно.
- EQ включается только кнопкой в popup — не возвращайте автозапуск по сайтам без явного согласованного feature request.

## Безопасность

Уязвимости **не** публикуйте в обычных Issues. См. [SECURITY.md](SECURITY.md).

## Лицензия

Внося вклад, вы соглашаетесь, что ваш код распространяется под [MIT](LICENSE) (русский перевод: [LICENSE.ru](LICENSE.ru)).
