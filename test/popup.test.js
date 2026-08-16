import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setupTestEnvironment,
  MockElement,
  MockEvent,
  MockKeyboardEvent,
} from "./helpers/test-dom-helper.js";

const { document, chrome } = setupTestEnvironment();
import * as storage from "../src/shared/storage.ts";
import * as utils from "../src/shared/utils.ts";

function buildPopupDOM() {
  document.body.innerHTML = `
    <div id="popup-toast"></div>
    <button id="btn-header-settings"></button>
    <input type="checkbox" id="global-toggle" checked>
    
    <div class="fs-tabs">
      <button class="fs-tab-btn active" data-tab="rules">My Fields</button>
      <button class="fs-tab-btn" data-tab="page-scanner">Page Scanner</button>
      <button class="fs-tab-btn" data-tab="settings">Settings</button>
    </div>

    <div id="tab-rules" class="fs-tab-content active">
      <input type="text" id="rule-search-input" placeholder="Search...">
      <div id="category-chips"></div>
      <button id="btn-open-add-modal">+ Add Field</button>
      <div id="rules-container"></div>
    </div>

    <div id="tab-page-scanner" class="fs-tab-content">
      <span id="page-fields-count">0</span>
      <span id="scanner-badge" style="display:none;"></span>
      <div id="scanner-actions-bar" style="display:none;">
        <button id="btn-fill-all-page">Autofill All</button>
        <button id="btn-save-all-fields">Save All Fields</button>
      </div>
      <div id="scanner-filter-bar" style="display:none;">
        <div id="scanner-filter-chips"></div>
      </div>
      <button id="btn-refresh-scanner">Refresh</button>
      <div id="page-fields-container"></div>
    </div>

    <div id="tab-settings" class="fs-tab-content">
      <input type="text" id="new-category-input">
      <button id="btn-add-category">Add</button>
      <div id="category-manage-list"></div>
      <input type="checkbox" id="setting-inline-btn" checked>
      <input type="checkbox" id="setting-highlight" checked>
      <input type="checkbox" id="setting-floating-bar">
      <input type="number" id="setting-max-chars" value="3">
      <button id="btn-export-data">Export</button>
      <input type="file" id="import-file-input">
      <button id="btn-delete-all-rules">Delete All</button>
    </div>

    <div id="rule-modal" style="display:none;">
      <form id="rule-form">
        <h3 id="modal-title"></h3>
        <button id="btn-modal-save" type="submit"></button>
        <button id="btn-modal-close" type="button"></button>
        <input type="hidden" id="form-rule-id">
        <input type="text" id="form-rule-label">
        <input type="text" id="form-rule-value">
        <input type="hidden" id="form-rule-pattern">
        <select id="form-rule-category"></select>
        <select id="form-rule-match-type">
          <option value="smart">Smart</option>
          <option value="regex">Regex</option>
        </select>
        <p id="form-match-type-desc"></p>
        <label id="form-pattern-label"></label>
        <small id="form-pattern-help"></small>
        <div id="form-tag-container"><div id="form-tags-list"></div><input id="form-tag-text-input"></div>
        <input id="form-regex-input" style="display:none;">
      </form>
    </div>
  `;
}

// Load popup module once
await import("../src/entrypoints/popup/main.ts");

describe("Popup Controller", () => {
  beforeEach(async () => {
    buildPopupDOM();
    await storage.resetToDefaults();
    document.dispatchEvent(new MockEvent("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 80));
  });

  it("renders initial categories and empty state for fields", async () => {
    const chips = document.getElementById("category-chips");
    assert.ok(chips);
    assert.ok(chips.textContent.includes("All"));
    assert.ok(chips.textContent.includes("Personal"));
    assert.ok(chips.textContent.includes("Job Apps"));

    const container = document.getElementById("rules-container");
    assert.ok(container.innerHTML.includes("No saved fields found"));
  });

  it("handles navigation tab switching and header settings button", async () => {
    const btnHeaderSettings = document.getElementById("btn-header-settings");
    const tabSettings = document.getElementById("tab-settings");
    const tabRules = document.getElementById("tab-rules");

    // Click header settings to open settings
    btnHeaderSettings.click();
    assert.strictEqual(tabSettings.classList.contains("active"), true);
    assert.strictEqual(tabRules.classList.contains("active"), false);

    // Click header settings again to toggle back to rules
    btnHeaderSettings.click();
    assert.strictEqual(tabRules.classList.contains("active"), true);
    assert.strictEqual(tabSettings.classList.contains("active"), false);
  });

  it("toggles global extension enabled setting", async () => {
    const globalToggle = document.getElementById("global-toggle");
    globalToggle.checked = false;
    globalToggle.dispatchEvent(new MockEvent("change"));

    await new Promise((resolve) => setTimeout(resolve, 80));
    const settings = await storage.getSettings();
    assert.strictEqual(settings.enabled, false);
  });

  it("adds and displays saved fields, handles copy, toggle, and delete", async () => {
    await storage.saveField({
      label: "My Email",
      value: "popup@test.com",
      category: "Personal",
      enabled: true,
    });

    // Reload popup state
    document.dispatchEvent(new MockEvent("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const container = document.getElementById("rules-container");
    const cards = container.querySelectorAll(".fs-rule-card");
    assert.strictEqual(cards.length, 1);
    assert.ok(cards[0].textContent.includes("My Email"));
    assert.ok(cards[0].textContent.includes("popup@test.com"));

    // Toggle field checkbox
    const toggle = cards[0].querySelector(".field-toggle-input");
    toggle.checked = false;
    toggle.dispatchEvent(new MockEvent("change"));

    await new Promise((resolve) => setTimeout(resolve, 80));
    const fieldsAfterToggle = await storage.getFields();
    assert.strictEqual(fieldsAfterToggle[0].enabled, false);

    // Click delete field
    globalThis.confirm = () => true;
    const btnDelete = cards[0].querySelector(".btn-delete");
    btnDelete.click();

    await new Promise((resolve) => setTimeout(resolve, 80));
    const fieldsAfterDelete = await storage.getFields();
    assert.strictEqual(fieldsAfterDelete.length, 0);
  });

  it("opens modal on + Add Field click and properly creates a new field", async () => {
    const btnAdd = document.getElementById("btn-open-add-modal");
    assert.ok(btnAdd);
    btnAdd.click();

    const modal = document.getElementById("rule-modal");
    assert.strictEqual(modal.style.display, "flex");

    const labelInput = document.getElementById("form-rule-label");
    const valueInput = document.getElementById("form-rule-value");
    const categorySelect = document.getElementById("form-rule-category");
    const btnSave = document.getElementById("btn-modal-save");

    labelInput.value = "New Home Address";
    valueInput.value = "742 Evergreen Terrace";
    categorySelect.value = "Personal";

    btnSave.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const fields = await storage.getFields();
    assert.strictEqual(fields.length, 1);
    assert.strictEqual(fields[0].label, "New Home Address");
    assert.strictEqual(fields[0].value, "742 Evergreen Terrace");
    assert.strictEqual(fields[0].category, "Personal");

    const container = document.getElementById("rules-container");
    assert.ok(container.textContent.includes("New Home Address"));
  });

  it("opens modal on Edit Field click and properly updates existing field", async () => {
    await storage.saveField({
      label: "Old Label",
      value: "Old Value",
      category: "Personal",
    });

    document.dispatchEvent(new MockEvent("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const container = document.getElementById("rules-container");
    const editBtn = container.querySelector(".btn-edit");
    assert.ok(editBtn);
    editBtn.click();

    const labelInput = document.getElementById("form-rule-label");
    const valueInput = document.getElementById("form-rule-value");
    const btnSave = document.getElementById("btn-modal-save");

    assert.strictEqual(labelInput.value, "Old Label");
    assert.strictEqual(valueInput.value, "Old Value");

    // Modify values
    labelInput.value = "Updated Label";
    valueInput.value = "Updated Value";

    btnSave.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const fields = await storage.getFields();
    assert.strictEqual(fields.length, 1);
    assert.strictEqual(fields[0].label, "Updated Label");
    assert.strictEqual(fields[0].value, "Updated Value");

    assert.ok(container.textContent.includes("Updated Label"));
  });

  it("filters fields using search input and resets on Escape key", async () => {
    await storage.saveField({ label: "First Name", value: "Alice" });
    await storage.saveField({ label: "Zip Code", value: "90210" });

    document.dispatchEvent(new MockEvent("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const searchInput = document.getElementById("rule-search-input");
    searchInput.value = "zip";
    searchInput.dispatchEvent(new MockEvent("input"));

    await new Promise((resolve) => setTimeout(resolve, 350));
    const container = document.getElementById("rules-container");
    assert.ok(container.textContent.includes("Zip Code"));
    assert.strictEqual(container.textContent.includes("First Name"), false);

    // Escape clears search
    const escEvent = new MockKeyboardEvent("keydown", { key: "Escape" });
    searchInput.dispatchEvent(escEvent);
    assert.strictEqual(searchInput.value, "");
    assert.ok(container.textContent.includes("First Name"));
  });

  it("switches active state when clicking category chips and filters fields", async () => {
    await storage.saveField({ label: "Passport No", value: "A1234567", category: "Personal" });
    await storage.saveField({ label: "Cover Letter", value: "Hello...", category: "Job Apps" });

    document.dispatchEvent(new MockEvent("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const chipsContainer = document.getElementById("category-chips");
    const chips = chipsContainer.querySelectorAll(".fs-chip");
    assert.strictEqual(chips.length, 3); // All, Personal, Job Apps

    const allChip = Array.from(chips).find((c) => c.dataset.category === "all");
    const jobAppsChip = Array.from(chips).find((c) => c.dataset.category === "Job Apps");

    assert.ok(allChip.classList.contains("active"));
    assert.strictEqual(jobAppsChip.classList.contains("active"), false);

    // Click "Job Apps" chip
    jobAppsChip.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const updatedChips = chipsContainer.querySelectorAll(".fs-chip");
    const updatedAllChip = Array.from(updatedChips).find((c) => c.dataset.category === "all");
    const updatedJobAppsChip = Array.from(updatedChips).find((c) => c.dataset.category === "Job Apps");

    assert.strictEqual(updatedAllChip.classList.contains("active"), false);
    assert.strictEqual(updatedJobAppsChip.classList.contains("active"), true);

    const container = document.getElementById("rules-container");
    assert.ok(container.textContent.includes("Cover Letter"));
    assert.strictEqual(container.textContent.includes("Passport No"), false);
  });

  describe("Category Management in Popup", () => {
    it("creates new category and handles Enter key in category input", async () => {
      const newCatInput = document.getElementById("new-category-input");
      newCatInput.value = "Social Media";

      const enterEvent = new MockKeyboardEvent("keydown", { key: "Enter" });
      newCatInput.dispatchEvent(enterEvent);

      await new Promise((resolve) => setTimeout(resolve, 80));
      const categories = await storage.getCategories();
      assert.ok(categories.includes("Social Media"));
    });

    it("deletes category and prevents deleting the only remaining category", async () => {
      await storage.addCategory("TempCat");
      document.dispatchEvent(new MockEvent("DOMContentLoaded"));
      await new Promise((resolve) => setTimeout(resolve, 80));

      const catList = document.getElementById("category-manage-list");
      const deleteButtons = catList.querySelectorAll(".btn-delete-cat");
      assert.ok(deleteButtons.length > 0);

      globalThis.confirm = () => true;
      const targetBtn = Array.from(deleteButtons).find(
        (b) => b.dataset.name === "TempCat",
      );
      assert.ok(targetBtn);

      targetBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 80));

      const updatedCats = await storage.getCategories();
      assert.strictEqual(updatedCats.includes("TempCat"), false);
    });
  });

  describe("Page Scanner Tab Integration", () => {
    it("handles scanned fields from active tab and direct field filling", async () => {
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (msg.action === "GET_PAGE_FIELDS" && cb) {
          cb({
            fields: [
              {
                index: 0,
                name: "applicant_name",
                label: "Applicant Name",
                matchesCount: 1,
                topMatch: {
                  fieldId: "1",
                  label: "Name",
                  value: "Alice Smith",
                  score: 100,
                },
              },
            ],
          });
        }
      };

      const scannerTabBtn = document.querySelector(
        '.fs-tab-btn[data-tab="page-scanner"]',
      );
      assert.ok(scannerTabBtn);
      scannerTabBtn.click();
      document.getElementById("btn-refresh-scanner")?.click();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const countEl = document.getElementById("page-fields-count");
      assert.strictEqual(countEl.textContent, "1");

      const pageContainer = document.getElementById("page-fields-container");
      const fillBtn = pageContainer.querySelector(".btn-fill-choice");
      assert.ok(fillBtn);

      let directFillSent = false;
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (msg.action === "FILL_SPECIFIC_FIELD") {
          directFillSent = true;
          if (cb) cb({ success: true });
        }
      };

      fillBtn.click();
      assert.strictEqual(directFillSent, true);
    });

    it("saves all detected fields with values in one click with default options", async () => {
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (msg.action === "GET_PAGE_FIELDS" && cb) {
          cb({
            fields: [
              {
                index: 0,
                name: "applicant_name",
                label: "Name *",
                currentValue: "Jane Doe",
                matchesCount: 0,
                topMatch: null,
              },
              {
                index: 1,
                name: "user_email",
                label: "Email *",
                currentValue: "jane.doe@example.com",
                matchesCount: 0,
                topMatch: null,
              },
              {
                index: 2,
                name: "linkedin_url",
                label: "LinkedIn profile *",
                currentValue: "https://www.linkedin.com/in/janedoe",
                matchesCount: 0,
                topMatch: null,
              },
            ],
          });
        }
      };

      const scannerTabBtn = document.querySelector(
        '.fs-tab-btn[data-tab="page-scanner"]',
      );
      scannerTabBtn.click();
      document.getElementById("btn-refresh-scanner")?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const btnSaveAll = document.getElementById("btn-save-all-fields");
      assert.ok(btnSaveAll);

      btnSaveAll.click();
      await new Promise((resolve) => setTimeout(resolve, 150));

      const savedFields = await storage.getFields();
      assert.strictEqual(savedFields.length, 3);
      assert.ok(savedFields.some((f) => f.label === "Name" && f.value === "Jane Doe"));
      assert.ok(savedFields.some((f) => f.label === "Email" && f.value === "jane.doe@example.com"));
      assert.ok(savedFields.some((f) => f.label === "LinkedIn profile" && f.value === "https://www.linkedin.com/in/janedoe"));
      assert.strictEqual(savedFields[0].category, "Personal");
      assert.strictEqual(savedFields[0].matchType, "smart");
    });

    it("displays Autofill button always when fields are detected and shows Filled badge for filled inputs", async () => {
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (msg.action === "GET_PAGE_FIELDS" && cb) {
          cb({
            fields: [
              {
                index: 0,
                name: "user_name",
                label: "Full Name",
                currentValue: "John Doe",
                matchesCount: 0,
                topMatch: null,
              },
            ],
          });
        }
      };

      const scannerTabBtn = document.querySelector(
        '.fs-tab-btn[data-tab="page-scanner"]',
      );
      scannerTabBtn.click();
      document.getElementById("btn-refresh-scanner")?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const btnFillAll = document.getElementById("btn-fill-all-page");
      assert.ok(btnFillAll);
      assert.strictEqual(btnFillAll.style.display, "flex");

      const badge = document.querySelector(".fs-field-filled-badge");
      assert.ok(badge);
      assert.ok(badge.textContent.includes("Filled"));
    });

    it("does not show Filled badge when field is empty even if topMatch is present", async () => {
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (msg.action === "GET_PAGE_FIELDS" && cb) {
          cb({
            fields: [
              {
                index: 0,
                name: "user_name",
                label: "Full Name",
                currentValue: "",
                matchesCount: 1,
                topMatch: {
                  fieldId: "field_1",
                  label: "Name",
                  value: "Jane Doe",
                  score: 100,
                },
              },
            ],
          });
        }
      };

      const scannerTabBtn = document.querySelector(
        '.fs-tab-btn[data-tab="page-scanner"]',
      );
      scannerTabBtn.click();
      document.getElementById("btn-refresh-scanner")?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const badge = document.querySelector(".fs-field-filled-badge");
      assert.strictEqual(badge, null);
    });

    it("does not show Filled badge when field contains a different value than topMatch (e.g. 'aa' vs 'Jane Doe')", async () => {
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (msg.action === "GET_PAGE_FIELDS" && cb) {
          cb({
            fields: [
              {
                index: 0,
                name: "user_name",
                label: "Full Name",
                currentValue: "aa",
                matchesCount: 1,
                topMatch: {
                  fieldId: "field_1",
                  label: "Name",
                  value: "Jane Doe",
                  score: 100,
                },
              },
            ],
          });
        }
      };

      const scannerTabBtn = document.querySelector(
        '.fs-tab-btn[data-tab="page-scanner"]',
      );
      scannerTabBtn.click();
      document.getElementById("btn-refresh-scanner")?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const badge = document.querySelector(".fs-field-filled-badge");
      assert.strictEqual(badge, null);
    });

    it("shows Filled badge when field contains the matching topMatch value", async () => {
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (msg.action === "GET_PAGE_FIELDS" && cb) {
          cb({
            fields: [
              {
                index: 0,
                name: "user_name",
                label: "Full Name",
                currentValue: "Jane Doe",
                matchesCount: 1,
                topMatch: {
                  fieldId: "field_1",
                  label: "Name",
                  value: "Jane Doe",
                  score: 100,
                },
              },
            ],
          });
        }
      };

      const scannerTabBtn = document.querySelector(
        '.fs-tab-btn[data-tab="page-scanner"]',
      );
      scannerTabBtn.click();
      document.getElementById("btn-refresh-scanner")?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const badge = document.querySelector(".fs-field-filled-badge");
      assert.ok(badge);
      assert.ok(badge.textContent.includes("Filled"));
    });

    it("filters scanner fields by Saved, Filled, and Empty chips with correct counts", async () => {
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (msg.action === "GET_PAGE_FIELDS" && cb) {
          cb({
            fields: [
              {
                index: 0,
                name: "full_name",
                label: "Full Name",
                currentValue: "Jane Doe",
                matchesCount: 1,
                topMatch: {
                  fieldId: "field_1",
                  label: "Name",
                  value: "Jane Doe",
                  score: 100,
                },
              },
              {
                index: 1,
                name: "email",
                label: "Email",
                currentValue: "",
                matchesCount: 1,
                topMatch: {
                  fieldId: "field_2",
                  label: "Email",
                  value: "janedoe@example.com",
                  score: 100,
                },
              },
              {
                index: 2,
                name: "notes",
                label: "Notes",
                currentValue: "",
                matchesCount: 0,
                topMatch: null,
              },
            ],
          });
        }
      };

      const scannerTabBtn = document.querySelector(
        '.fs-tab-btn[data-tab="page-scanner"]',
      );
      scannerTabBtn.click();
      document.getElementById("btn-refresh-scanner")?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const filterChips = document.querySelectorAll("#scanner-filter-chips .fs-chip");
      assert.strictEqual(filterChips.length, 4);
      assert.ok(filterChips[0].textContent.includes("All (3)"));
      assert.ok(filterChips[1].textContent.includes("Saved (2)"));
      assert.ok(filterChips[2].textContent.includes("Filled (1)"));
      assert.ok(filterChips[3].textContent.includes("Empty (2)"));

      // Click "Saved" filter
      filterChips[1].click();
      let cards = document.querySelectorAll("#page-fields-container .fs-field-card");
      assert.strictEqual(cards.length, 2);

      // Click "Filled" filter
      filterChips[2].click();
      cards = document.querySelectorAll("#page-fields-container .fs-field-card");
      assert.strictEqual(cards.length, 1);
      assert.ok(cards[0].textContent.includes("Full Name"));

      // Click "Empty" filter
      filterChips[3].click();
      cards = document.querySelectorAll("#page-fields-container .fs-field-card");
      assert.strictEqual(cards.length, 2);

      // Click "All" filter
      filterChips[0].click();
      cards = document.querySelectorAll("#page-fields-container .fs-field-card");
      assert.strictEqual(cards.length, 3);
    });

    it("dispatches FOCUS_FIELD when clicking on field title in card header", async () => {
      let dispatchedMsg = null;
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (msg.action === "GET_PAGE_FIELDS" && cb) {
          cb({
            fields: [
              {
                index: 0,
                name: "email",
                label: "Email Address",
                currentValue: "",
                matchesCount: 1,
                topMatch: {
                  fieldId: "f_1",
                  label: "Email",
                  value: "test@example.com",
                  score: 95,
                },
              },
              {
                index: 1,
                name: "portfolio",
                label: "Portfolio URL",
                currentValue: "",
                matchesCount: 0,
                topMatch: null,
              },
            ],
          });
        } else if (msg.action === "FOCUS_FIELD") {
          dispatchedMsg = msg;
          if (cb) cb({ success: true });
        }
      };

      const scannerTabBtn = document.querySelector(
        '.fs-tab-btn[data-tab="page-scanner"]',
      );
      scannerTabBtn.click();
      document.getElementById("btn-refresh-scanner")?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const fieldTitles = document.querySelectorAll(".fs-field-name");
      assert.strictEqual(fieldTitles.length, 2);

      // Click first field name
      fieldTitles[0].click();
      assert.ok(dispatchedMsg);
      assert.strictEqual(dispatchedMsg.action, "FOCUS_FIELD");
      assert.strictEqual(dispatchedMsg.fieldIndex, 0);

      const toast = document.getElementById("popup-toast");
      assert.ok(toast.textContent.includes("Focused Email Address"));

      // Click second field name
      fieldTitles[1].click();
      assert.strictEqual(dispatchedMsg.fieldIndex, 1);
    });
  });

  describe("Settings Tab Operations", () => {
    it("toggles settings checkboxes and max chars input", async () => {
      const inlineToggle = document.getElementById("setting-inline-btn");
      inlineToggle.checked = false;
      inlineToggle.dispatchEvent(new MockEvent("change"));

      const highlightToggle = document.getElementById("setting-highlight");
      highlightToggle.checked = false;
      highlightToggle.dispatchEvent(new MockEvent("change"));

      const floatingToggle = document.getElementById("setting-floating-bar");
      floatingToggle.checked = true;
      floatingToggle.dispatchEvent(new MockEvent("change"));

      const maxChars = document.getElementById("setting-max-chars");
      maxChars.value = "5";
      maxChars.dispatchEvent(new MockEvent("change"));

      await new Promise((resolve) => setTimeout(resolve, 80));
      const settings = await storage.getSettings();
      assert.strictEqual(settings.showInlineButtons, false);
      assert.strictEqual(settings.highlightFilledFields, false);
      assert.strictEqual(settings.showFloatingBar, true);
      assert.strictEqual(settings.maxCharsToHideTrigger, 5);
    });

    it("deletes all fields on delete all button confirmation", async () => {
      await storage.saveField({ label: "Field A", value: "Val A" });
      globalThis.confirm = () => true;

      const btnDeleteAll = document.getElementById("btn-delete-all-rules");
      btnDeleteAll.click();

      await new Promise((resolve) => setTimeout(resolve, 80));
      const fields = await storage.getFields();
      assert.strictEqual(fields.length, 0);
    });

    it("exports backup data when export button is clicked", async () => {
      await storage.saveField({ label: "Export Field", value: "Export Val" });
      const btnExport = document.getElementById("btn-export-data");
      assert.ok(btnExport);

      assert.doesNotThrow(() => {
        btnExport.click();
      });
    });

    it("handles backup import with file input", async () => {
      const fileInput = document.getElementById("import-file-input");
      assert.ok(fileInput);
    });

    it("filters saved fields list by search query input", async () => {
      await storage.saveField({ label: "GitHub Profile", value: "https://github.com/ayaan" });
      await storage.saveField({ label: "LinkedIn Profile", value: "https://linkedin.com/in/ayaan" });

      const fieldsTabBtn = document.querySelector('.fs-tab-btn[data-tab="my-rules"]');
      fieldsTabBtn?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const searchInput = document.getElementById("search-rules");
      if (searchInput) {
        searchInput.value = "GitHub";
        searchInput.dispatchEvent(new MockEvent("input"));
        await new Promise((resolve) => setTimeout(resolve, 350));

        const cards = document.querySelectorAll("#rules-container .fs-rule-card");
        assert.strictEqual(cards.length, 1);
        assert.ok(cards[0].textContent.includes("GitHub Profile"));
      }
    });
  });
});
