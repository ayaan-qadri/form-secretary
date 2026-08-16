# Contributing to Form Secretary

First off, thanks for taking the time to contribute! 🎉

Form Secretary is an open-source project and we welcome contributions of all kinds - bug fixes, new heuristic patterns, framework compatibility enhancements, UI/UX polish, documentation improvements, and multi-browser testing.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Testing Guidelines](#testing-guidelines)

---

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold a welcoming, inclusive, and respectful environment for everyone.

---

## How Can I Contribute?

### Reporting Bugs

If you find a bug or unexpected behavior on a specific web form:

1. Search existing [Issues](https://github.com/ayaan-qadri/form-secretary/issues) to ensure it hasn't already been reported.
2. [Open a new issue](https://github.com/ayaan-qadri/form-secretary/issues/new) and include:
   - **Browser & Version** (e.g., Chrome 124, Firefox 125, Edge 124).
   - **Page URL or HTML Snippet** where the issue occurred.
   - **Steps to reproduce**.
   - **Expected behavior** vs. **actual behavior**.
   - **Console logs or screenshots** if available.

### Suggesting Enhancements

Have an idea for a new feature or smart matching rule? [Open a feature request](https://github.com/ayaan-qadri/form-secretary/issues/new) describing:

- The problem or workflow you want to improve.
- Your proposed solution or user experience.
- Any alternative approaches considered.

### Submitting Pull Requests

1. **Fork** the repository and create your branch from `master` (or `main`):
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. **Install dependencies**:
   ```bash
   pnpm install
   ```
3. Make your changes with clear, concise commit messages.
4. Ensure all type checks and tests pass:
   ```bash
   pnpm compile
   pnpm test
   pnpm build
   ```
5. Push to your fork and submit a **Pull Request**.

---

## Development Setup

### Prerequisites
- Node.js (v18+)
- pnpm (`npm install -g pnpm`)

### Key Commands

```bash
# Start development mode with hot reload
pnpm dev

# Build for Chrome MV3
pnpm build

# Build for Firefox
pnpm build:firefox

# Run type checks
pnpm compile

# Run tests
pnpm test

# Generate extension icons
pnpm generate:icons
```

---

## Project Architecture

- **`src/entrypoints/background.ts`**: Manifest V3 background service worker for context menus, tab tracking, and badge updates.
- **`src/entrypoints/content/`**: Content script coordinator and event listeners.
- **`src/entrypoints/popup/`**: Toolbar popup interface for quick field search, categorization, and real-time page scanning.
- **`src/entrypoints/options/`**: Full-screen settings, category management, and field vault manager page.
- **`src/shared/`**:
  - `constants.ts`: Global DOM selectors, default categories, default settings, and storage keys.
  - `field-modal.ts`: Interactive modal dialog for creating and editing saved fields.
  - `matcher.ts`: Heuristic scoring algorithm, ReDoS-protected regex matching, and keyword discovery.
  - `storage.ts`: Strongly-typed `chrome.storage.local` persistence wrapper with backup export/import.
  - `utils.ts`: Safe HTML escaping, clipboard helpers, debounce, visibility checks, and JSON I/O.
  - `icons.ts`: Lucide SVG icons registry.
- **`src/content/`**:
  - `filler.ts`: Framework-resilient native prototype setter and synthetic bubbling event dispatcher.
  - `scanner.ts`: Deep DOM and Shadow DOM form control discovery engine.
  - `ui.ts`: Encapsulated Open Shadow DOM floating trigger button and popover dropdown controller.
- **`src/types/`**:
  - `index.ts`: TypeScript data contracts, interfaces, and messaging protocol definitions.

---

## Testing Guidelines

We use Node's native test runner with custom DOM mocks (`test/helpers/test-dom-helper.js`) to test logic without heavy browser dependencies.

- The repository includes a comprehensive automated test suite covering all modules.
- Add test coverage for any new matcher rules, filler behaviors, or utility functions.
- Run `pnpm test` before committing.
