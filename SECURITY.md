# Security Policy

Русский · [English](#-english)

---

# 🇷🇺 Русский

SoundHub — расширение Chrome: обработка звука идёт локально во вкладке / offscreen-документе. Настройки и пресеты хранятся в `chrome.storage`. Сообщения о уязвимостях принимаем всерьёз.

## Как сообщить об уязвимости

**Не** создавайте публичный Issue с деталями эксплойта.

Предпочтительный способ — [GitHub Security Advisory](https://github.com/GoblinThug/SoundHub/security/advisories/new) (приватный отчёт).

Если advisory недоступен, напишите автору через GitHub ([@GoblinThug](https://github.com/GoblinThug)) **без** публикации PoC в открытом issue.

В отчёте по возможности укажите:

- версию расширения и браузера (Chrome / Edge и номер);
- тип проблемы (утечка данных, XSS в popup, обход ограничений доменов, злоупотребление `tabCapture` и т.п.);
- шаги воспроизведения;
- влияние и, если есть, предложенный фикс.

## Что считается в приоритете

- Утечка или неожиданный доступ к данным из `chrome.storage`.
- XSS / injection в popup или offscreen-документе.
- Захват или обработка аудио вкладок вне ожидаемого сценария пользователя.
- Обход фильтра доменов / автозапуска с нежелательными последствиями.

## Что обычно не является уязвимостью

- Ограничения Chrome Manifest V3 / `tabCapture` (например, `chrome://` страницы).
- Проблемы на стороне сайтов или драйверов аудио пользователя.
- Вопросы удобства UI без влияния на безопасность.

## Сроки ответа

Постараемся ответить в разумный срок (обычно в течение нескольких дней). Пожалуйста, дайте время на проверку и выпуск исправления до публичного раскрытия.

## Безопасное использование

Кратко для пользователей: см. раздел «Безопасность» в [README](README.md#-безопасность).

---

# 🇬🇧 English

SoundHub is a Chrome extension: audio runs locally in the tab / offscreen document. Settings and presets live in `chrome.storage`. We take vulnerability reports seriously.

## How to report

Do **not** open a public Issue with exploit details.

Preferred channel: a private [GitHub Security Advisory](https://github.com/GoblinThug/SoundHub/security/advisories/new).

If that isn’t available, contact the maintainer via GitHub ([@GoblinThug](https://github.com/GoblinThug)) **without** posting a PoC in a public issue.

Please include when possible:

- extension version and browser (Chrome / Edge and build);
- issue type (data leakage, popup XSS, domain-filter bypass, unexpected `tabCapture` use, etc.);
- reproduction steps;
- impact and, if you have one, a suggested fix.

## High priority

- Leakage or unexpected access to `chrome.storage` data.
- XSS / injection in the popup or offscreen document.
- Capturing or processing tab audio outside the user’s expected flow.
- Bypassing domain / autostart filters with unwanted effects.

## Usually not vulnerabilities

- Chrome Manifest V3 / `tabCapture` limits (e.g. `chrome://` pages).
- Issues on the user’s sites or audio drivers.
- Pure UX requests with no security impact.

## Response

We’ll aim to reply within a reasonable time (typically a few days). Please allow time to investigate and ship a fix before public disclosure.

## Safe usage

For end users, see the Security section in the [README](README.md#-security).
