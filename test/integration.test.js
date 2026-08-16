import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setupTestEnvironment,
  MockElement,
  MockEvent,
} from "./helpers/test-dom-helper.js";

const { document, chrome } = setupTestEnvironment();
import * as storage from "../src/shared/storage.ts";
import * as matcher from "../src/shared/matcher.ts";
import * as filler from "../src/content/filler.ts";
import * as scanner from "../src/content/scanner.ts";
import * as ui from "../src/content/ui.ts";

describe("Form Secretary - End-to-End Integration Suite", () => {
  beforeEach(async () => {
    document.documentElement.children = [];
    document.documentElement.appendChild(document.head);
    document.documentElement.appendChild(document.body);
    document.body.children = [];
    await storage.resetToDefaults();
  });

  it("performs end-to-end form scanning, scoring, and mass autofill across diverse form controls", async () => {
    // 1. Setup simulated complex form in DOM
    const form = new MockElement("form");

    const fnameInput = new MockElement("input");
    fnameInput.type = "text";
    fnameInput.id = "user_first_name";
    fnameInput.setAttribute("name", "firstName");
    fnameInput.setAttribute("placeholder", "First Name");

    const emailInput = new MockElement("input");
    emailInput.type = "email";
    emailInput.id = "user_email";
    emailInput.setAttribute("name", "emailAddress");
    emailInput.setAttribute("aria-label", "Email Address");

    const coverLetter = new MockElement("textarea");
    coverLetter.id = "cover_letter";
    coverLetter.setAttribute("placeholder", "Paste your cover letter...");

    const visaSelect = new MockElement("select");
    visaSelect.id = "visa_sponsorship";
    const optNone = new MockElement("option");
    optNone.value = "";
    optNone.text = "Select...";
    const optYes = new MockElement("option");
    optYes.value = "yes";
    optYes.text = "Yes";
    const optNo = new MockElement("option");
    optNo.value = "no";
    optNo.text = "No";
    visaSelect.appendChild(optNone);
    visaSelect.appendChild(optYes);
    visaSelect.appendChild(optNo);

    form.appendChild(fnameInput);
    form.appendChild(emailInput);
    form.appendChild(coverLetter);
    form.appendChild(visaSelect);
    document.body.appendChild(form);

    // 2. Populate user fields in storage with multiple match types
    await storage.saveField({
      label: "First Name",
      value: "Alexander",
      pattern: "first name, fname",
      matchType: "smart",
      category: "Personal",
    });

    await storage.saveField({
      label: "Personal Email",
      value: "alex@example.org",
      pattern: "email, email address",
      matchType: "smart",
      category: "Personal",
    });

    await storage.saveField({
      label: "Cover Letter",
      value: "Dear Hiring Manager,\nI am thrilled to apply...",
      pattern: "cover letter",
      matchType: "contains",
      category: "Job Apps",
    });

    await storage.saveField({
      label: "Visa Sponsorship",
      value: "No",
      pattern: "visa, sponsorship",
      matchType: "smart",
      category: "Job Apps",
    });

    const savedFields = await storage.getFields();
    assert.strictEqual(savedFields.length, 4);

    // 3. Scan DOM
    const scannedFields = scanner.scanPageFields(savedFields, matcher);
    assert.strictEqual(scannedFields.length, 4);
    assert.strictEqual(
      scannedFields.every((f) => f.matchesCount > 0),
      true,
    );

    // 4. Perform Mass Autofill
    const filledCount = scanner.fillAllMatchedFieldsOnPage(
      savedFields,
      matcher,
      filler,
      { highlightFilledFields: false },
    );
    assert.strictEqual(filledCount, 4);

    // 5. Verify all controls filled accurately
    assert.strictEqual(fnameInput.value, "Alexander");
    assert.strictEqual(emailInput.value, "alex@example.org");
    assert.strictEqual(
      coverLetter.value,
      "Dear Hiring Manager,\nI am thrilled to apply...",
    );
    assert.strictEqual(visaSelect.selectedIndex, 2); // 'No' option
  });

  it("executes full interactive user flow: focus -> pill trigger -> click autofill -> in-situ success confirmation", async () => {
    let onTriggerCallback = null;
    const uiHandles = ui.initShadowHost({
      onTriggerClick: () => {
        if (onTriggerCallback) onTriggerCallback();
      },
    });

    const targetInput = new MockElement("input");
    targetInput.setAttribute("name", "phone");
    targetInput.setAttribute("placeholder", "Mobile Phone Number");
    document.body.appendChild(targetInput);

    const savedField = {
      id: "phone_field_1",
      label: "Phone Number",
      value: "+1 (555) 234-5678",
      matchType: "smart",
      enabled: true,
    };

    // User focuses field
    const meta = matcher.extractFieldMetadata(targetInput);
    const matches = matcher.findMatchingFields(meta, [savedField]);
    assert.strictEqual(matches.length, 1);

    ui.updatePillContent(matches);
    ui.positionTriggerPill(targetInput);

    assert.strictEqual(uiHandles.triggerContainer.style.display, "flex");
    const pillText = uiHandles.triggerContainer.querySelector(".fs-pill-text");
    assert.strictEqual(pillText.textContent, "Fill: Phone Number");

    // User clicks the trigger pill
    onTriggerCallback = () => {
      filler.fillElement(targetInput, matches[0].field.value);
      ui.showSuccessState(matches[0].field.label);
    };

    uiHandles.triggerContainer.dispatchEvent(new MockEvent("mousedown"));

    assert.strictEqual(targetInput.value, "+1 (555) 234-5678");
    assert.strictEqual(
      uiHandles.triggerContainer.classList.contains("fs-pill-success"),
      true,
    );
    assert.strictEqual(pillText.textContent, "Filled Phone Number");
  });

  it("handles multi-match ambiguity flow: focus -> dropdown menu -> option selection -> field filled", async () => {
    const uiHandles = ui.initShadowHost();

    const emailInput = new MockElement("input");
    emailInput.setAttribute("name", "email");
    document.body.appendChild(emailInput);

    const savedFields = [
      {
        id: "1",
        label: "Work Email",
        pattern: "work email, email",
        value: "work@enterprise.com",
        category: "Work",
        enabled: true,
      },
      {
        id: "2",
        label: "Personal Email",
        pattern: "personal email, email",
        value: "me@gmail.com",
        category: "Personal",
        enabled: true,
      },
    ];

    const meta = matcher.extractFieldMetadata(emailInput);
    const matches = matcher.findMatchingFields(meta, savedFields);
    assert.strictEqual(matches.length, 2);

    ui.updatePillContent(matches);
    const badgeEl = uiHandles.triggerContainer.querySelector(".fs-pill-badge");
    assert.strictEqual(badgeEl.textContent, "+1");

    // Open dropdown and render options
    let selectedField = null;
    ui.renderDropdown(matches, (selected) => {
      selectedField = selected;
      filler.fillElement(emailInput, selected.field.value);
      ui.showSuccessState(selected.field.label);
    });
    ui.positionDropdown();

    assert.strictEqual(ui.isDropdownOpen(), true);
    const items =
      uiHandles.dropdownContainer.querySelectorAll(".fs-dropdown-item");
    assert.strictEqual(items.length, 2);

    // User selects second item (Personal Email)
    items[1].dispatchEvent(new MockEvent("mousedown"));

    assert.strictEqual(selectedField.field.label, "Personal Email");
    assert.strictEqual(emailInput.value, "me@gmail.com");
  });

  it("completes full backup export, storage reset, and restore import roundtrip", async () => {
    // 1. Save complex application state
    await storage.addCategory("Freelance");
    await storage.saveField({
      label: "Crypto Wallet",
      value: "0xABCDEF123456",
      category: "Freelance",
      matchType: "exact",
      pattern: "eth, wallet",
    });
    await storage.saveSettings({
      theme: "dark",
      maxCharsToHideTrigger: 7,
    });

    // 2. Export
    const exportedData = await storage.exportData();
    assert.strictEqual(exportedData.version, "1.0.0");
    assert.ok(exportedData.categories.includes("Freelance"));
    assert.strictEqual(exportedData.fields.length, 1);
    assert.strictEqual(exportedData.settings.maxCharsToHideTrigger, 7);

    // 3. Reset storage
    await storage.resetToDefaults();
    const resetFields = await storage.getFields();
    const resetCats = await storage.getCategories();
    const resetSettings = await storage.getSettings();
    assert.strictEqual(resetFields.length, 0);
    assert.strictEqual(resetCats.includes("Freelance"), false);
    assert.strictEqual(resetSettings.maxCharsToHideTrigger, 3);

    // 4. Import backup
    const restored = await storage.importData(exportedData);
    assert.ok(restored.categories.includes("Freelance"));
    assert.strictEqual(restored.fields.length, 1);
    assert.strictEqual(restored.fields[0].label, "Crypto Wallet");
    assert.strictEqual(restored.fields[0].value, "0xABCDEF123456");
    assert.strictEqual(restored.settings.maxCharsToHideTrigger, 7);
  });
});
