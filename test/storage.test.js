import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment } from "./helpers/test-dom-helper.js";

const { chrome } = setupTestEnvironment();
import * as storage from "../src/shared/storage.ts";

describe("FormSecretaryStorage", () => {
  beforeEach(async () => {
    // Reset state before every test
    chrome.storage.local.clear();
    await storage.resetToDefaults();
  });

  describe("Properties and Fallbacks", () => {
    it("exposes STORAGE_KEYS, DEFAULT_CATEGORIES, and DEFAULT_SETTINGS getters", () => {
      assert.ok(storage.STORAGE_KEYS);
      assert.strictEqual(storage.STORAGE_KEYS.FIELDS, "fs_fields");
      assert.ok(Array.isArray(storage.DEFAULT_CATEGORIES));
      assert.ok(typeof storage.DEFAULT_SETTINGS === "object");
    });

    it("handles chrome.runtime.lastError during get and set without crashing", async () => {
      chrome.runtime.lastError = { message: "QuotaExceeded" };

      const res = await storage.saveSettings({ theme: "dark" });
      assert.ok(res);

      chrome.runtime.lastError = null;
    });
  });

  describe("Categories API", () => {
    it("returns default categories initially", async () => {
      const categories = await storage.getCategories();
      assert.deepEqual(categories, ["Personal", "Job Apps"]);
    });

    it("adds a new unique category and trims whitespace", async () => {
      const updated = await storage.addCategory("  Finance  ");
      assert.ok(updated.includes("Finance"));
      const fetched = await storage.getCategories();
      assert.ok(fetched.includes("Finance"));
    });

    it("does not duplicate existing categories or add empty strings", async () => {
      await storage.addCategory("Personal");
      const catsAfterDup = await storage.getCategories();
      assert.strictEqual(
        catsAfterDup.filter((c) => c === "Personal").length,
        1,
      );

      await storage.addCategory("");
      await storage.addCategory("   ");
      await storage.addCategory(null);
      const catsAfterEmpty = await storage.getCategories();
      assert.strictEqual(catsAfterEmpty.includes(""), false);
    });

    it("saves clean category list with duplicates and empty items removed", async () => {
      const result = await storage.saveCategories([
        "  Work ",
        "Work",
        "",
        "  ",
        "School",
      ]);
      assert.deepEqual(result, ["Work", "School"]);
    });

    it("deletes a category and reassigns affected fields to the first remaining category", async () => {
      await storage.addCategory("Temporary");

      const createdField = await storage.saveField({
        label: "Temp Field",
        value: "temp_value",
        category: "Temporary",
      });

      assert.strictEqual(createdField.category, "Temporary");

      const remainingCategories = await storage.deleteCategory("Temporary");
      assert.strictEqual(remainingCategories.includes("Temporary"), false);

      const fields = await storage.getFields();
      const updatedField = fields.find((f) => f.id === createdField.id);
      assert.ok(updatedField);
      assert.strictEqual(updatedField.category, remainingCategories[0]);
    });

    it("prevents empty category list on deleting all categories and sets Personal", async () => {
      const categories = await storage.getCategories();
      for (const cat of categories) {
        await storage.deleteCategory(cat);
      }

      const finalCats = await storage.getCategories();
      assert.ok(finalCats.length > 0);
      assert.strictEqual(finalCats[0], "Personal");
    });
  });

  describe("Fields API", () => {
    it("returns empty array initially when no fields are saved", async () => {
      const fields = await storage.getFields();
      assert.ok(Array.isArray(fields));
      assert.strictEqual(fields.length, 0);
    });

    it("throws an error when saving a field without label or value", async () => {
      await assert.rejects(
        async () => storage.saveField({ label: "Only Label" }),
        { message: "Field must have at least a label and value" },
      );

      await assert.rejects(
        async () => storage.saveField({ value: "Only Value" }),
        { message: "Field must have at least a label and value" },
      );

      await assert.rejects(async () => storage.saveField(null), {
        message: "Field must have at least a label and value",
      });
    });

    it("creates a new field with default properties and auto-registers category", async () => {
      const newField = await storage.saveField({
        label: "Cryptocurrency Wallet",
        value: "0x1234567890abcdef",
        category: "Crypto",
        pattern: "wallet, crypto, eth address",
        matchType: "smart",
      });

      assert.ok(newField.id);
      assert.strictEqual(newField.label, "Cryptocurrency Wallet");
      assert.strictEqual(newField.value, "0x1234567890abcdef");
      assert.strictEqual(newField.category, "Crypto");
      assert.strictEqual(newField.enabled, true);
      assert.strictEqual(newField.targetProperty, "all");
      assert.ok(typeof newField.createdAt === "number");

      const categories = await storage.getCategories();
      assert.ok(categories.includes("Crypto"));

      const allFields = await storage.getFields();
      const found = allFields.find((f) => f.id === newField.id);
      assert.ok(found);
    });

    it("updates an existing field when ID is provided", async () => {
      const created = await storage.saveField({
        label: "Initial Label",
        value: "initial_val",
        category: "Personal",
      });

      const updated = await storage.saveField({
        id: created.id,
        label: "Updated Label",
        value: "updated_value",
        category: created.category,
      });

      assert.strictEqual(updated.id, created.id);
      assert.strictEqual(updated.label, "Updated Label");
      assert.strictEqual(updated.value, "updated_value");
      assert.ok(typeof updated.updatedAt === "number");

      const refreshedFields = await storage.getFields();
      const refreshedTarget = refreshedFields.find((f) => f.id === created.id);
      assert.strictEqual(refreshedTarget.label, "Updated Label");
    });

    it("deletes a field by ID", async () => {
      const created = await storage.saveField({
        label: "Field to Delete",
        value: "delete_me",
        category: "Personal",
      });

      const result = await storage.deleteField(created.id);
      assert.strictEqual(result, true);

      const refreshedFields = await storage.getFields();
      const exists = refreshedFields.some((f) => f.id === created.id);
      assert.strictEqual(exists, false);
    });

    it("deletes all fields", async () => {
      await storage.saveField({ label: "Field 1", value: "Val 1" });
      await storage.saveField({ label: "Field 2", value: "Val 2" });

      await storage.deleteAllFields();
      const fields = await storage.getFields();
      assert.deepEqual(fields, []);
    });

    it("toggles field enabled status", async () => {
      const created = await storage.saveField({
        label: "Toggle Field",
        value: "toggle_val",
        category: "Personal",
      });
      const initialStatus = created.enabled;

      const toggled = await storage.toggleField(created.id);
      assert.strictEqual(toggled.enabled, !initialStatus);
      assert.ok(typeof toggled.updatedAt === "number");

      const explicitToggle = await storage.toggleField(created.id, false);
      assert.strictEqual(explicitToggle.enabled, false);

      const invalidToggle = await storage.toggleField("non_existent_id");
      assert.strictEqual(invalidToggle, null);
    });
  });

  describe("Settings API", () => {
    it("returns default settings initially", async () => {
      const settings = await storage.getSettings();
      assert.deepEqual(settings, storage.DEFAULT_SETTINGS);
    });

    it("updates and persists settings changes", async () => {
      const updated = await storage.saveSettings({
        showFloatingBar: true,
        maxCharsToHideTrigger: 5,
      });

      assert.strictEqual(updated.showFloatingBar, true);
      assert.strictEqual(updated.maxCharsToHideTrigger, 5);
      assert.strictEqual(updated.enabled, true); // preserved default

      const fetched = await storage.getSettings();
      assert.strictEqual(fetched.showFloatingBar, true);
      assert.strictEqual(fetched.maxCharsToHideTrigger, 5);
    });

    it("resets all storage state back to factory defaults", async () => {
      await storage.saveField({ label: "Reset Test", value: "val" });
      await storage.addCategory("Custom Cat");
      await storage.saveSettings({ enabled: false });

      const res = await storage.resetToDefaults();
      assert.deepEqual(res.fields, []);
      assert.deepEqual(res.categories, ["Personal", "Job Apps"]);
      assert.strictEqual(res.settings.enabled, true);

      const fields = await storage.getFields();
      assert.strictEqual(fields.length, 0);
    });
  });

  describe("Import & Export API", () => {
    it("exports all application state in standard backup format", async () => {
      await storage.saveField({ label: "Export Test", value: "secret" });
      const exported = await storage.exportData();

      assert.strictEqual(exported.version, "1.0.0");
      assert.ok(exported.exportedAt);
      assert.ok(Array.isArray(exported.categories));
      assert.ok(Array.isArray(exported.fields));
      assert.strictEqual(exported.fields.length, 1);
      assert.ok(typeof exported.settings === "object");
    });

    it("imports backup configuration successfully with fields, categories, and settings", async () => {
      const backupPayload = {
        version: "1.0.0",
        categories: ["Work", "Personal"],
        fields: [
          {
            id: "field_custom_1",
            label: "Tax ID",
            value: "12-3456789",
            category: "Work",
            pattern: "tax id, ein",
            matchType: "exact",
            enabled: true,
          },
        ],
        settings: {
          showFloatingBar: true,
          theme: "dark",
        },
      };

      const result = await storage.importData(backupPayload);
      assert.deepEqual(result.categories, ["Work", "Personal"]);
      assert.strictEqual(result.fields.length, 1);
      assert.strictEqual(result.fields[0].label, "Tax ID");
      assert.strictEqual(result.settings.showFloatingBar, true);
      assert.strictEqual(result.settings.theme, "dark");
    });

    it("throws error when importing invalid non-object payload", async () => {
      await assert.rejects(async () => storage.importData(null), {
        message: "Invalid backup file",
      });

      await assert.rejects(async () => storage.importData("invalid string"), {
        message: "Invalid backup file",
      });

      await assert.rejects(async () => storage.importData(123), {
        message: "Invalid backup file",
      });
    });
  });
});
