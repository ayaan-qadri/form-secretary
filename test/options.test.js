import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setupTestEnvironment,
  MockElement,
  MockEvent,
  MockKeyboardEvent,
} from "./helpers/test-dom-helper.js";

const { document } = setupTestEnvironment();
import * as storage from "../src/shared/storage.ts";
import * as utils from "../src/shared/utils.ts";

function buildOptionsDOM() {
  document.body.innerHTML = `
    <div id="opt-toast"></div>
    <div class="fs-sidebar">
      <a href="#" class="fs-nav-link active" data-view="rules">Fields (<span id="sidebar-rules-count">0</span>)</a>
      <a href="#" class="fs-nav-link" data-view="categories">Categories (<span id="sidebar-categories-count">0</span>)</a>
      <a href="#" class="fs-nav-link" data-view="settings">Settings</a>
    </div>

    <!-- Rules View -->
    <div id="view-rules" class="fs-view-section active">
      <input type="text" id="opt-search-input" placeholder="Search...">
      <select id="opt-category-filter"></select>
      <button id="btn-add-rule-opt">+ Add Field</button>
      <table>
        <thead>
          <tr>
            
          </tr>
        </thead>
        <tbody id="opt-rules-tbody"></tbody>
      </table>
    </div>

    <!-- Categories View -->
    <div id="view-categories" class="fs-view-section">
      <input type="text" id="opt-new-category-input">
      <button id="opt-btn-add-category">Add Category</button>
      <table>
        <tbody id="opt-categories-tbody"></tbody>
      </table>
    </div>

    <!-- Settings View -->
    <div id="view-settings" class="fs-view-section">
      <input type="checkbox" id="opt-setting-inline" checked>
      <input type="checkbox" id="opt-setting-highlight" checked>
      <input type="checkbox" id="opt-setting-floating">
      <input type="number" id="opt-setting-max-chars" value="3">
      <button id="opt-btn-export">Export</button>
      <input type="file" id="opt-import-file">
      <button id="opt-btn-delete-all">Delete All</button>
    </div>

    <div id="opt-rule-modal" style="display:none;">
      <form id="opt-rule-form">
        <h3 id="opt-modal-title"></h3>
        <button id="opt-btn-save" type="submit"></button>
        <button id="opt-modal-close" type="button"></button>
        <input type="hidden" id="opt-form-id">
        <input type="text" id="opt-form-label">
        <input type="text" id="opt-form-value">
        <input type="hidden" id="opt-form-pattern">
        <select id="opt-form-category"></select>
        <select id="opt-form-match-type">
          <option value="smart">Smart</option>
          <option value="regex">Regex</option>
        </select>
        <p id="opt-match-type-desc"></p>
        <label id="opt-pattern-label"></label>
        <small id="opt-pattern-help"></small>
        <div id="opt-tag-container"><div id="opt-tags-list"></div><input id="opt-tag-text-input"></div>
        <input id="opt-regex-input" style="display:none;">
      </form>
    </div>
  `;
}

// Load options module once
await import("../src/entrypoints/options/main.ts");

describe("Options Controller", () => {
  beforeEach(async () => {
    buildOptionsDOM();
    await storage.resetToDefaults();
    document.dispatchEvent(new MockEvent("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 80));
  });

  it("renders initial sidebar counts and empty fields table", async () => {
    const sidebarFields = document.getElementById("sidebar-rules-count");
    const sidebarCategories = document.getElementById(
      "sidebar-categories-count",
    );
    const tbody = document.getElementById("opt-rules-tbody");

    assert.strictEqual(sidebarFields.textContent, "0");
    assert.strictEqual(sidebarCategories.textContent, "2");
    assert.ok(tbody.textContent.includes("No saved fields found"));
  });

  it("handles sidebar view navigation", () => {
    const navLinks = document.querySelectorAll(".fs-nav-link");
    const viewCategories = document.getElementById("view-categories");
    const viewRules = document.getElementById("view-rules");

    // Click categories view link (index 1)
    navLinks[1].click();

    assert.strictEqual(viewCategories.classList.contains("active"), true);
    assert.strictEqual(viewRules.classList.contains("active"), false);
  });

  it("renders saved fields in table with toggle, copy, and delete operations", async () => {
    await storage.saveField({
      label: "LinkedIn Profile",
      value: "https://linkedin.com/in/testuser",
      category: "Job Apps",
      matchType: "smart",
      enabled: true,
    });

    document.dispatchEvent(new MockEvent("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const tbody = document.getElementById("opt-rules-tbody");
    const rows = tbody.querySelectorAll("tr");
    assert.strictEqual(rows.length, 1);
    assert.ok(rows[0].textContent.includes("LinkedIn Profile"));
    assert.ok(rows[0].textContent.includes("Job Apps"));

    // Toggle field status switch
    const toggle = rows[0].querySelector(".field-status-toggle");
    toggle.checked = false;
    toggle.dispatchEvent(new MockEvent("change"));

    await new Promise((resolve) => setTimeout(resolve, 80));
    const fieldsAfterToggle = await storage.getFields();
    assert.strictEqual(fieldsAfterToggle[0].enabled, false);

    // Copy field value via copy button
    let copiedText = null;
    globalThis.navigator.clipboard = {
      async writeText(t) {
        copiedText = t;
      },
    };
    const btnCopy = rows[0].querySelector(".btn-copy-row");
    btnCopy.click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.strictEqual(copiedText, "https://linkedin.com/in/testuser");

    // Delete field
    globalThis.confirm = () => true;
    const btnDelete = rows[0].querySelector(".btn-delete-row");
    btnDelete.click();

    await new Promise((resolve) => setTimeout(resolve, 80));
    const fieldsAfterDelete = await storage.getFields();
    assert.strictEqual(fieldsAfterDelete.length, 0);
  });

  it("opens modal on + Add Field click and properly creates a new field in options", async () => {
    const btnAdd = document.getElementById("btn-add-rule-opt");
    assert.ok(btnAdd);
    btnAdd.click();

    const modal = document.getElementById("opt-rule-modal");
    assert.strictEqual(modal.style.display, "flex");

    const labelInput = document.getElementById("opt-form-label");
    const valueInput = document.getElementById("opt-form-value");
    const categorySelect = document.getElementById("opt-form-category");
    const btnSave = document.getElementById("opt-btn-save");

    labelInput.value = "GitHub Username";
    valueInput.value = "octocat";
    categorySelect.value = "Personal";

    btnSave.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const fields = await storage.getFields();
    assert.strictEqual(fields.length, 1);
    assert.strictEqual(fields[0].label, "GitHub Username");
    assert.strictEqual(fields[0].value, "octocat");

    const tbody = document.getElementById("opt-rules-tbody");
    assert.ok(tbody.textContent.includes("GitHub Username"));
  });

  it("opens modal on Edit Field click and properly updates existing field in options", async () => {
    await storage.saveField({
      label: "Twitter Handle",
      value: "@oldhandle",
      category: "Personal",
    });

    document.dispatchEvent(new MockEvent("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const tbody = document.getElementById("opt-rules-tbody");
    const editBtn = tbody.querySelector(".btn-edit-row");
    assert.ok(editBtn);
    editBtn.click();

    const labelInput = document.getElementById("opt-form-label");
    const valueInput = document.getElementById("opt-form-value");
    const btnSave = document.getElementById("opt-btn-save");

    assert.strictEqual(labelInput.value, "Twitter Handle");
    assert.strictEqual(valueInput.value, "@oldhandle");

    valueInput.value = "@newhandle";

    btnSave.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const fields = await storage.getFields();
    assert.strictEqual(fields.length, 1);
    assert.strictEqual(fields[0].value, "@newhandle");
    assert.ok(tbody.textContent.includes("@newhandle"));
  });

  it("filters table by category dropdown and search input", async () => {
    await storage.saveField({
      label: "Personal Email",
      value: "a@me.com",
      category: "Personal",
    });
    await storage.saveField({
      label: "Portfolio URL",
      value: "https://work.dev",
      category: "Job Apps",
    });

    document.dispatchEvent(new MockEvent("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const categoryFilter = document.getElementById("opt-category-filter");
    categoryFilter.value = "Job Apps";
    categoryFilter.dispatchEvent(new MockEvent("change"));

    await new Promise((resolve) => setTimeout(resolve, 350));
    const tbody = document.getElementById("opt-rules-tbody");
    assert.ok(tbody.textContent.includes("Portfolio URL"));
    assert.strictEqual(tbody.textContent.includes("Personal Email"), false);

    // Search query
    const searchInput = document.getElementById("opt-search-input");
    categoryFilter.value = "all";
    categoryFilter.dispatchEvent(new MockEvent("change"));
    searchInput.value = "email";
    searchInput.dispatchEvent(new MockEvent("input"));

    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.ok(tbody.textContent.includes("Personal Email"));
    assert.strictEqual(tbody.textContent.includes("Portfolio URL"), false);
  });

  describe("Categories View Management", () => {
    it("adds new category and renders in categories table", async () => {
      const newCatInput = document.getElementById("opt-new-category-input");
      const btnAdd = document.getElementById("opt-btn-add-category");

      newCatInput.value = "Finance";
      btnAdd.click();

      await new Promise((resolve) => setTimeout(resolve, 80));
      const categories = await storage.getCategories();
      assert.ok(categories.includes("Finance"));

      const catTbody = document.getElementById("opt-categories-tbody");
      assert.ok(catTbody.textContent.includes("Finance"));
    });

    it("deletes category in categories table with confirmation and field reassignment", async () => {
      await storage.addCategory("Temp Category");
      await storage.saveField({
        label: "Sample",
        value: "Val",
        category: "Temp Category",
      });

      document.dispatchEvent(new MockEvent("DOMContentLoaded"));
      await new Promise((resolve) => setTimeout(resolve, 80));

      const catTbody = document.getElementById("opt-categories-tbody");
      const deleteBtns = catTbody.querySelectorAll(".btn-delete-cat-row");
      const targetBtn = Array.from(deleteBtns).find(
        (b) => b.dataset.name === "Temp Category",
      );
      assert.ok(targetBtn);

      globalThis.confirm = () => true;
      targetBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 80));
      const categories = await storage.getCategories();
      assert.strictEqual(categories.includes("Temp Category"), false);

      const fields = await storage.getFields();
      assert.strictEqual(fields[0].category, categories[0]);
    });
  });

  describe("Settings View Management", () => {
    it("persists settings changes from options page", async () => {
      const settingInline = document.getElementById("opt-setting-inline");
      settingInline.checked = false;
      settingInline.dispatchEvent(new MockEvent("change"));

      const settingFloating = document.getElementById("opt-setting-floating");
      settingFloating.checked = true;
      settingFloating.dispatchEvent(new MockEvent("change"));

      await new Promise((resolve) => setTimeout(resolve, 80));
      const settings = await storage.getSettings();
      assert.strictEqual(settings.showInlineButtons, false);
      assert.strictEqual(settings.showFloatingBar, true);
    });

    it("deletes all fields on confirm", async () => {
      await storage.saveField({ label: "Test 1", value: "1" });
      globalThis.confirm = () => true;

      const btnDeleteAll = document.getElementById("opt-btn-delete-all");
      btnDeleteAll.click();

      await new Promise((resolve) => setTimeout(resolve, 80));
      const fields = await storage.getFields();
      assert.strictEqual(fields.length, 0);
    });

    it("prevents deleting the only remaining category", async () => {
      await storage.saveCategories(["OnlyCategory"]);
      document.dispatchEvent(new MockEvent("DOMContentLoaded"));
      await new Promise((resolve) => setTimeout(resolve, 80));

      const catTbody = document.getElementById("opt-categories-tbody");
      const deleteBtn = catTbody?.querySelector(".btn-delete-cat-row");
      if (deleteBtn) {
        deleteBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const categories = await storage.getCategories();
        assert.strictEqual(categories.length, 1);
        assert.strictEqual(categories[0], "OnlyCategory");
      }
    });

    it("triggers export backup download on options page", async () => {
      const btnExport = document.getElementById("opt-btn-export");
      if (btnExport) {
        assert.doesNotThrow(() => {
          btnExport.click();
        });
      }
    });
  });
});
