# Security Policy

## Privacy & Data Handling

Form Secretary is designed with a **privacy-first, client-only architecture**:

- **100% Local Storage**: All saved fields, custom values, and preferences are stored locally in your browser via `chrome.storage.local`.
- **Zero External Requests**: Form Secretary does not send your data, form inputs, or browsing history to any remote server or third-party service.
- **No Analytics / Telemetry**: No tracking scripts, analytics cookies, or usage monitoring are included.

---

## Security Safeguards

- **Isolated Shadow DOM**: All injected UI components (floating trigger buttons, multi-match popover menus) live within an encapsulated Shadow DOM tree to prevent CSS bleed and protect against host-page script tampering.
- **ReDoS Protection**: All custom regular expressions entered in field matchers are verified against catastrophic backtracking limits before execution.
- **Safe HTML Escaping**: Dynamic values rendered in popup cards or dropdown previews are sanitized with strict character escaping.

---

## Reporting a Vulnerability

If you discover a potential security vulnerability within Form Secretary:

1. Please do **not** open a public issue on GitHub.
2. Submit a private security advisory via [GitHub Security Advisories](https://github.com/ayaan-qadri/form-secretary/security/advisories/new) or contact the maintainer directly.
3. Please provide a detailed description of the vulnerability, reproduction steps, and potential impact.
4. We will acknowledge receipt within 48 hours and work on a patch release promptly.
