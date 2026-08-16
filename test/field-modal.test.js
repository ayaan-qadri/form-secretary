import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setupTestEnvironment,
  MockElement,
  MockKeyboardEvent,
  MockEvent,
} from "./helpers/test-dom-helper.js";

const { document } = setupTestEnvironment();
import { FieldModal } from "../src/shared/field-modal.ts";

describe("FormSecretaryFieldModal", () => {
  let modalInstance;
  let savedData = null;
  let elements;

  beforeEach(() => {
    savedData = null;
    elements = {
      modal: new MockElement("div"),
      title: new MockElement("h3"),
      form: new MockElement("form"),
      formId: new MockElement("input"),
      formLabel: new MockElement("input"),
      formValue: new MockElement("input"),
      formPattern: new MockElement("input"),
      formCategory: new MockElement("select"),
      formMatchType: new MockElement("select"),
      matchDesc: new MockElement("p"),
      patternLabel: new MockElement("label"),
      patternHelp: new MockElement("small"),
      tagContainer: new MockElement("div"),
      tagsList: new MockElement("div"),
      tagTextInput: new MockElement("input"),
      regexInput: new MockElement("input"),
      btnSave: new MockElement("button"),
      btnClose: new MockElement("button"),
      btnCancel: new MockElement("button"),
    };

    modalInstance = new FieldModal(elements, {
      onSave: async (data) => {
        savedData = data;
      },
    });
  });

  describe("Modal Open & Close", () => {
    it("opens in Add New Field mode with empty values and sets default category", () => {
      modalInstance.open(null, ["Personal", "Work"], "Work");

      assert.strictEqual(elements.title.textContent, "Add New Field");
      assert.strictEqual(elements.formId.value, "");
      assert.strictEqual(elements.formLabel.value, "");
      assert.strictEqual(elements.formValue.value, "");
      assert.strictEqual(elements.formCategory.value, "Work");
      assert.strictEqual(elements.modal.style.display, "flex");
    });

    it("opens in Edit Field mode with pre-populated values", () => {
      const existingField = {
        id: "field_123",
        label: "My Phone",
        value: "+1 234 5678",
        pattern: "phone, mobile, tel",
        category: "Personal",
        matchType: "smart",
      };

      modalInstance.open(existingField, ["Personal", "Work"]);

      assert.strictEqual(elements.title.textContent, "Edit Field");
      assert.strictEqual(elements.formId.value, "field_123");
      assert.strictEqual(elements.formLabel.value, "My Phone");
      assert.strictEqual(elements.formValue.value, "+1 234 5678");
      assert.strictEqual(elements.formCategory.value, "Personal");
      assert.deepEqual(modalInstance.tags, ["phone", "mobile", "tel"]);
    });

    it("closes modal on close button click and cancel button click", async () => {
      modalInstance.open();
      assert.strictEqual(elements.modal.style.display, "flex");

      elements.btnClose.click();
      assert.strictEqual(elements.modal.classList.contains("closing"), true);

      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.strictEqual(elements.modal.style.display, "none");
    });

    it("closes modal on backdrop click", () => {
      modalInstance.open();
      const mousedownEvent = new MockEvent("mousedown");
      mousedownEvent.target = elements.modal;

      elements.modal.dispatchEvent(mousedownEvent);
      assert.strictEqual(elements.modal.classList.contains("closing"), true);
    });

    it("closes modal on Escape keydown", () => {
      modalInstance.open();
      const escapeEvent = new MockKeyboardEvent("keydown", { key: "Escape" });
      document.dispatchEvent(escapeEvent);

      assert.strictEqual(elements.modal.classList.contains("closing"), true);
    });
  });

  describe("Tag Chips and Pattern Synchronization", () => {
    it("adds tags on Enter or comma in tagTextInput and trims/deduplicates", () => {
      modalInstance.open();
      elements.tagTextInput.value = "first_tag";

      const enterEvent = new MockKeyboardEvent("keydown", { key: "Enter" });
      elements.tagTextInput.dispatchEvent(enterEvent);

      assert.strictEqual(modalInstance.tags.includes("first_tag"), true);
      assert.strictEqual(elements.formPattern.value, "first_tag");

      // Attempt duplicate tag
      elements.tagTextInput.value = "FIRST_TAG";
      elements.tagTextInput.dispatchEvent(enterEvent);
      assert.strictEqual(modalInstance.tags.length, 1);

      // Add comma-separated tag
      elements.tagTextInput.value = "second_tag";
      const commaEvent = new MockKeyboardEvent("keydown", { key: "," });
      elements.tagTextInput.dispatchEvent(commaEvent);
      assert.strictEqual(modalInstance.tags.length, 2);
      assert.strictEqual(elements.formPattern.value, "first_tag, second_tag");
    });

    it("removes last tag when Backspace is pressed on empty tag input", () => {
      modalInstance.setTagsFromPattern("alpha, beta, gamma");
      assert.strictEqual(modalInstance.tags.length, 3);

      elements.tagTextInput.value = "";
      const backspaceEvent = new MockKeyboardEvent("keydown", {
        key: "Backspace",
      });
      elements.tagTextInput.dispatchEvent(backspaceEvent);

      assert.strictEqual(modalInstance.tags.length, 2);
      assert.deepEqual(modalInstance.tags, ["alpha", "beta"]);
    });

    it("removes tag when chip remove button is clicked", () => {
      modalInstance.setTagsFromPattern("red, green, blue");
      const removeBtns = elements.tagsList.querySelectorAll(".fs-tag-remove");
      assert.strictEqual(removeBtns.length, 3);

      // Remove 'green' (index 1)
      removeBtns[1].click();
      assert.deepEqual(modalInstance.tags, ["red", "blue"]);
      assert.strictEqual(elements.formPattern.value, "red, blue");
    });
  });

  describe("Mode view switching", () => {
    it("switches between tag container and regex input on match mode change", () => {
      modalInstance.updateFieldModeView("smart");
      assert.strictEqual(elements.tagContainer.style.display, "flex");
      assert.strictEqual(elements.regexInput.style.display, "none");

      modalInstance.updateFieldModeView("regex");
      assert.strictEqual(elements.tagContainer.style.display, "none");
      assert.strictEqual(elements.regexInput.style.display, "block");
    });

    it("syncs pattern value when typing in regexInput", () => {
      elements.regexInput.value = "^[a-z0-9]+$";
      elements.regexInput.dispatchEvent(new MockEvent("input"));

      assert.strictEqual(elements.formPattern.value, "^[a-z0-9]+$");
    });
  });

  describe("Form submission and onSave callback", () => {
    it("gathers all field data, falls back pattern to label if empty, and triggers onSave callback", async () => {
      modalInstance.open(null, ["Personal"]);
      elements.formLabel.value = "Home City";
      elements.formValue.value = "San Francisco";
      elements.formMatchType.value = "smart";
      elements.formCategory.value = "Personal";

      // Submit form
      const submitEvent = new MockEvent("submit");
      elements.form.dispatchEvent(submitEvent);

      assert.ok(savedData);
      assert.strictEqual(savedData.label, "Home City");
      assert.strictEqual(savedData.value, "San Francisco");
      assert.strictEqual(savedData.pattern, "Home City"); // fallback to label
      assert.strictEqual(savedData.category, "Personal");
      assert.strictEqual(savedData.matchType, "smart");
    });

    it("triggers save when btnSave button is clicked", async () => {
      modalInstance.open(null, ["Work"]);
      elements.formLabel.value = "Work Phone";
      elements.formValue.value = "+1 987 654 3210";
      elements.formMatchType.value = "smart";
      elements.formCategory.value = "Work";

      // Click btnSave (with non-submit fallback click triggering submit event)
      elements.btnSave.click();

      assert.ok(savedData);
      assert.strictEqual(savedData.label, "Work Phone");
      assert.strictEqual(savedData.value, "+1 987 654 3210");
    });
  });
});
