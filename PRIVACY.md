# Privacy Policy for Form Secretary

**Last Updated:** August 17, 2026

Form Secretary ("the Extension", "we", "us", or "our") is committed to protecting your privacy. This Privacy Policy outlines how Form Secretary handles data when you use our browser extension and associated services.

---

## 1. Zero Remote Data Collection

Form Secretary operates on a **100% client-side, local-first architecture**:

- **No Remote Servers**: We do not operate remote tracking servers, databases, or analytics endpoints.
- **No Personal Data Collection**: We do not collect, transmit, sell, or monitor your personal information, contact details, credentials, or form input values.
- **No Browsing History Tracking**: We do not track, log, or store the websites, URLs, or web pages you visit.
- **No Third-Party Analytics**: Form Secretary contains zero third-party analytics SDKs, advertising trackers, or telemetry beacons.

---

## 2. Local Data Storage

All data you create and manage within Form Secretary is stored **exclusively on your local device**:

- **Stored Data**: User-defined form fields (labels, values, match heuristics, categories) and extension configuration preferences.
- **Storage Mechanism**: Data is persisted using the browser's built-in, sandboxed `chrome.storage.local` API.
- **Data Retention & Control**: Your data stays on your machine until you delete individual fields, clear the extension data, or uninstall the extension. You have full control to export and import your vault as JSON backups at any time.

---

## 3. Permissions & Justification

Form Secretary only requests browser permissions that are strictly necessary to provide its core form-filling functionality:

| Permission | Purpose & Scope |
| :--- | :--- |
| **`storage`** | Persists your custom form fields, match rules, categories, and settings locally on your machine. |
| **`activeTab`** | Allows the extension to interact with the current tab when you open the popup or initiate autofill. |
| **`scripting`** | Injects form scanning routines and floating trigger UI directly into the active webpage DOM upon user interaction. |
| **`tabs`** | Enables communication between the extension popup and active webpage tabs, and opens settings/documentation tabs. |
| **`clipboardWrite`** | Enables the user-initiated "Copy" button to copy a saved field value to your clipboard. |
| **`contextMenus`** | Provides optional right-click context menu options to quickly autofill or save detected form fields. |
| **`<all_urls>`** (Host Permission) | Enables the extension to inspect and autofill form inputs across any website you choose to visit. |

---

## 4. Third-Party Websites & Services

When you use Form Secretary to autofill fields on external websites, the interaction occurs entirely within your local browser session. Form Secretary is not responsible for the privacy practices, cookies, or data handling policies of third-party websites where you submit forms.

---

## 5. Changes to This Policy

We may update this Privacy Policy periodically to reflect changes in our extension features or applicable browser store requirements. Any changes will be posted to this repository with an updated revision date.

---

## 6. Contact & Support

If you have questions, feedback, or security inquiries regarding this Privacy Policy, please reach out via:

- **GitHub Repository**: [https://github.com/ayaan-qadri/form-secretary](https://github.com/ayaan-qadri/form-secretary)
- **Issue Tracker**: [https://github.com/ayaan-qadri/form-secretary/issues](https://github.com/ayaan-qadri/form-secretary/issues)
- **Security Inquiries**: [https://github.com/ayaan-qadri/form-secretary/security](https://github.com/ayaan-qadri/form-secretary/security)
