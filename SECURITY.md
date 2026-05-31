# Security Policy

## Supported versions

Only the latest release of `telegram.user.js` (current `main` branch) is
supported.

## Reporting a vulnerability

If you find a security issue (XSS via crafted Telegram payloads,
content-script escape, ad-blocker bypass that exfiltrates messages, etc.)
please **do not** open a public issue.

Instead, file a private security advisory on GitHub:
<https://github.com/diorhc/telegram-plus/security/advisories/new>

We aim to acknowledge reports within 7 days.

## Threat model — quick notes

The script runs with userscript privileges on `web.telegram.org`,
`webk.telegram.org`, and `webz.telegram.org`. It uses `@grant unsafeWindow`
so it can call the page-native `showSaveFilePicker`. The script:

- never sends any data to a third-party server,
- never imports remote code at runtime,
- stores settings/progress locally (`localStorage`, userscript GM storage fallback, then in-memory fallback),
- talks to the network only via `fetch` to the originating Telegram CDN
  (download streaming).

`unsafeWindow` usage is intentionally limited to the file-picker bridge
(`PAGE_WINDOW.showSaveFilePicker`) and does not evaluate remote code.

JSON read from storage/import files is parsed with key filtering that strips
dangerous prototype keys (`__proto__`, `constructor`, `prototype`) before use.

The blob URLs created for downloads are revoked after at most 30 seconds
(Safari) / 6 seconds (other browsers).
