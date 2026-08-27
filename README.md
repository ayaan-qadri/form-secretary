<div align="center">
  <img src="public/icons/icon128.png" width="100" height="100" alt="Form Secretary Logo"/>
  <br/>
  <strong style="font-size: 2em;">Form Secretary</strong>
  <br/>
  <p>A smart, framework-resilient browser extension to store, manage, and 1-click autofill your custom form fields</p>

  <p>
    <a href="https://chromewebstore.google.com/detail/form-secretary-smart-auto/eplgjnlnamohicplmomfjeibekfdjebm"><img src="https://img.shields.io/badge/Chrome_Web_Store-Form_Secretary-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Web Store"/></a>
    <a href="https://addons.mozilla.org/en-US/firefox/addon/form-secretary/"><img src="https://img.shields.io/badge/Firefox_Add--ons-Form_Secretary-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white" alt="Firefox Add-ons"/></a>
    <a href="https://ayaan-qadri.github.io/form-secretary/"><img src="https://img.shields.io/badge/Website-Live_Site-2563EB?style=for-the-badge&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48bGluZSB4MT0iMiIgeTE9IjEyIiB4Mj0iMjIiIHkyPSIxMiIvPjxwYXRoIGQ9Ik0xMiAyYTE1LjMgMTUuMyAwIDAgMSA0IDEwIDE1LjMgMTUuMyAwIDAgMS00IDEwIDE1LjMgMTUuMyAwIDAgMS00LTEwIDE1LjMgMTUuMyAwIDAgMSA0LTEweiIvPjwvc3ZnPg==" alt="Official Website"/></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge" alt="MIT License"/></a>
  </p>
</div>

---

## Table of Contents

- [Install](#install)
- [What is Form Secretary?](#what-is-form-secretary)
- [Features](#features)
- [How It Works & Framework Resilience](#how-it-works--framework-resilience)
- [How the Idea Came About](#how-the-idea-came-about)
- [How It Was Built](#how-it-was-built)
- [Platform Support](#platform-support)
- [Getting Started (Development)](#getting-started-development)
- [Testing the Extension](#testing-the-extension)
- [Contributing](#contributing)
- [Security & Privacy](#security--privacy)
- [License](#license)

---

## Install

Form Secretary is officially available on the Chrome Web Store and Firefox Add-ons:

| Browser / Store | Supported Browsers | One-Click Install |
| :--- | :--- | :---: |
| **Chrome Web Store** | Google Chrome, Brave, Microsoft Edge, Arc, Opera, Vivaldi | [**Add to Chrome**](https://chromewebstore.google.com/detail/form-secretary-smart-auto/eplgjnlnamohicplmomfjeibekfdjebm) |
| **Firefox Add-ons (AMO)** | Mozilla Firefox, Zen Browser, Floorp, LibreWolf | [**Add to Firefox**](https://addons.mozilla.org/en-US/firefox/addon/form-secretary/) |

---

## What is Form Secretary?

If you've ever found yourself repeatedly copying and pasting the same contact info, URLs, credentials, or custom testing values into web forms over and over again, Form Secretary was built for that exact frustration.

Unlike browser-default autofills that are rigid, tied to specific personal profile schemas, and frequently fail to trigger modern JavaScript framework events, Form Secretary gives you complete control:

- Define any custom field (e.g. `Portfolio URL`, `Test Email`, `Staging API Key`, `Bio Snippet`).
- Match fields using flexible heuristics (exact labels, visual placeholder names, regex patterns, or smart fuzzy keywords).
- Injects a non-intrusive floating trigger button right next to focused inputs.
- Inspects and fills entire forms with a single click from the toolbar popup.
- Runs **100% locally** in your browser - zero telemetry, zero accounts, zero remote servers.

---

## Features

- **Smart Scoring Heuristics**: Automatically detects input relevance by visual `<label>` text, `aria-label`, placeholder, input `name`, `id`, and autocomplete hints.
- **Framework-Resilient Autofill**: Dispatches native prototype setter value changes and synthetic bubbling events (`input`, `change`, `blur`), ensuring instant reactivity in **React (16-19)**, **Vue (2/3)**, **Angular**, **Svelte**, and vanilla forms.
- **Encapsulated Open Shadow DOM**: Injected floating trigger buttons, dropdown menus, and toasts live inside an isolated Shadow DOM container so host page CSS (Tailwind resets, Bootstrap, styled-components) never breaks the extension UI.
- **Active Page Scanner**: Open the popup on any webpage to scan all detectable form inputs in real time. Fill individual fields, save detected inputs directly into your library with 1 click, or click **"Autofill All Matched"** to fill the whole page at once.
- **Multi-Match Selector**: When multiple saved items match the same form control (e.g. Work Email vs. Personal Email), a clean popover menu lets you pick the right value instantly.
- **Categorization & Filtering**: Organize saved fields by categories (e.g. *Personal*, *Job Search*, *Developer*, *Testing*), toggle fields on/off, or search with instant debounced filtering.
- **Local Backup & Restore**: Export and import your entire field vault as a JSON backup at any time.

---

## How It Works & Framework Resilience

Modern frontend frameworks like React and Vue hijack standard `HTMLInputElement.value` setters and track internal virtual DOM state through synthetic event listeners. Simply setting `input.value = "something"` directly from a browser extension often causes the UI to revert as soon as the user submits or blurs.

Form Secretary solves this under the hood:

```text
[Form Secretary Autofill Engine]
       │
       ├─► 1. Retrieve Native Property Descriptor (HTMLInputElement.prototype)
       │      └─ Calls original native `value` setter to bypass React 16-19 / Vue tracker
       │
       ├─► 2. Dispatch Bubbling Input Event (`new Event('input', { bubbles: true })`)
       │      └─ Updates React internal fiber state & Vue reactive bindings
       │
       ├─► 3. Dispatch Change & Blur Events (`change`, `blur`)
       │      └─ Triggers validation schemas (e.g. Formik, React Hook Form, VeeValidate)
       │
       └─► 4. Visual Feedback
              └─ In-trigger success checkmark and subtle glowing input pulse
```

---

## How the Idea Came About

Filling repetitive forms is a daily chore for almost every developer, tester, and job seeker:

1. **Job Applications**: Every company uses a different ATS (Workday, Greenhouse, Lever, Ashby), asking for the exact same portfolio link, GitHub profile, notice period, and cover letter snippets in slightly different form layouts.
2. **QA & Local Testing**: Developers constantly create dummy user accounts, fill checkout flows, and test form validation errors.
3. **Broken Browser Autofill**: Standard browser autofill only understands a handful of standard address fields and regularly fails to trigger modern SPA state bindings.

Form Secretary was designed to bridge that gap - a lightweight, distraction-free assistant that feels like a natural extension of your browser.

---

## How It Was Built

Form Secretary is built with modern web extension tooling:

- **[WXT (Next-Gen Web Extension Framework)](https://wxt.dev/)**: Fast Vite-powered development, instant Hot Module Replacement (HMR), and clean multi-browser bundle compilation.
- **[TypeScript](https://www.typescriptlang.org/)**: Full strict typing across all background scripts, content scripts, popup state, and storage contracts.
- **[Tailwind CSS v4](https://tailwindcss.com/)**: Clean, minimal, utility-first styling with zero runtime CSS overhead.

---

## Platform Support

Form Secretary is built on Manifest V3 and WebExtension standards:

| Browser | Status | Store / Install Link | Engine |
| :--- | :---: | :---: | :--- |
| **Google Chrome** | **Live** | [**Chrome Web Store**](https://chromewebstore.google.com/detail/form-secretary-smart-auto/eplgjnlnamohicplmomfjeibekfdjebm) | Chromium (MV3) |
| **Brave** | Supported | [**Chrome Web Store**](https://chromewebstore.google.com/detail/form-secretary-smart-auto/eplgjnlnamohicplmomfjeibekfdjebm) | Chromium (MV3) |
| **Microsoft Edge** | Supported | [**Chrome Web Store**](https://chromewebstore.google.com/detail/form-secretary-smart-auto/eplgjnlnamohicplmomfjeibekfdjebm) | Chromium (MV3) |
| **Opera / Vivaldi / Arc** | Supported | [**Chrome Web Store**](https://chromewebstore.google.com/detail/form-secretary-smart-auto/eplgjnlnamohicplmomfjeibekfdjebm) | Chromium (MV3) |
| **Mozilla Firefox** | **Live** | [**Firefox Add-ons (AMO)**](https://addons.mozilla.org/en-US/firefox/addon/form-secretary/) | Gecko (MV2/MV3) |

---

## Getting Started (Development)

### Prerequisites
- **Node.js** (v18 or higher recommended): [nodejs.org](https://nodejs.org/)
- **pnpm** (Fast, disk space efficient package manager): [pnpm.io](https://pnpm.io/)

```bash
# Install pnpm if not already installed
npm install -g pnpm
```

### Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ayaan-qadri/form-secretary.git
   cd form-secretary
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Start the development server with live reload**:
   ```bash
   pnpm dev
   ```

4. **Build production bundles**:
   ```bash
   # Build for Chromium (Chrome, Brave, Edge) -> outputs to .output/chrome-mv3
   pnpm build

   # Build for Firefox -> outputs to .output/firefox-mv2
   pnpm build:firefox
   ```

5. **Run tests and type checks**:
   ```bash
   # Run type checks
   pnpm compile

   # Run test suite
   pnpm test
   ```

---

## Testing the Extension

### Loading in Google Chrome / Brave / Edge
1. Build the project with `pnpm build`.
2. Navigate to `chrome://extensions` in your browser.
3. Turn on **Developer mode** (top right switch).
4. Click **Load unpacked** and select the `.output/chrome-mv3` directory.
5. *(Optional for local files)*: In `chrome://extensions`, click **Details** on Form Secretary and enable **"Allow access to file URLs"**.
6. Open [`test/sample-form.html`](test/sample-form.html) in your browser to test interactive multi-framework autofill triggers and page scanning!

### Loading in Mozilla Firefox
1. Build the project with `pnpm build:firefox`.
2. Navigate to `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on...** and select `.output/firefox-mv2/manifest.json`.

---

## Contributing

Contributions are warmly welcome! Whether fixing a bug, adding heuristic patterns, improving documentation, or optimizing performance:

1. Check out the [Contributing Guidelines](CONTRIBUTING.md).
2. Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).
3. If you run into an issue or have a feature idea, feel free to [open an issue](https://github.com/ayaan-qadri/form-secretary/issues).

---

## Security & Privacy

- **100% Local Storage**: All fields, categories, and settings are saved in your browser's local `chrome.storage.local`.
- **Zero Tracking**: Form Secretary does not collect analytics, logs, telemetry, or network requests.
- **ReDoS Protected**: Regex input patterns are validated with safety limits to avoid catastrophic backtracking.
- For complete details, see our [Privacy Policy](PRIVACY.md) and [Security Policy](SECURITY.md).

---

## License

Distributed under the [MIT License](LICENSE). Feel free to use, modify, and distribute as you see fit.
