import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setupTestEnvironment,
  MockElement,
} from "./helpers/test-dom-helper.js";

const { document } = setupTestEnvironment();
import * as matcher from "../src/shared/matcher.ts";
import * as filler from "../src/content/filler.ts";
import * as scanner from "../src/content/scanner.ts";

describe("FormSecretaryScanner", () => {
  beforeEach(() => {
    document.documentElement.children = [];
    document.documentElement.appendChild(document.head);
    document.documentElement.appendChild(document.body);
    document.body.children = [];
  });

  describe("findAllInputControls", () => {
    it("returns empty array when rootNode is null or depth exceeds maxDepth", () => {
      assert.deepEqual(scanner.findAllInputControls(null), []);
      assert.deepEqual(scanner.findAllInputControls(document, 10, 5), []);
    });

    it("finds standard inputs, textareas, selects, and contenteditable elements while excluding buttons and hidden inputs", () => {
      const form = new MockElement("form");

      const textInput = new MockElement("input");
      textInput.type = "text";

      const hiddenInput = new MockElement("input");
      hiddenInput.type = "hidden";

      const submitBtn = new MockElement("input");
      submitBtn.type = "submit";

      const textarea = new MockElement("textarea");
      const select = new MockElement("select");

      const editable = new MockElement("div");
      editable.setAttribute("contenteditable", "true");

      form.appendChild(textInput);
      form.appendChild(hiddenInput);
      form.appendChild(submitBtn);
      form.appendChild(textarea);
      form.appendChild(select);
      form.appendChild(editable);

      document.body.appendChild(form);

      const found = scanner.findAllInputControls(document.body);
      assert.strictEqual(found.length, 4);
      assert.ok(found.includes(textInput));
      assert.ok(found.includes(textarea));
      assert.ok(found.includes(select));
      assert.ok(found.includes(editable));
      assert.strictEqual(found.includes(hiddenInput), false);
      assert.strictEqual(found.includes(submitBtn), false);
    });

    it("recursively traverses through custom Shadow DOM roots while ignoring #form-secretary-root", () => {
      const webComponent = new MockElement("custom-form-field");
      const shadowRoot = webComponent.attachShadow({ mode: "open" });

      const shadowInput = new MockElement("input");
      shadowInput.type = "text";
      shadowRoot.appendChild(shadowInput);

      // Secretary's own UI root
      const secretaryRoot = new MockElement("div");
      secretaryRoot.id = "form-secretary-root";
      const secretaryShadow = secretaryRoot.attachShadow({ mode: "open" });
      const internalPillInput = new MockElement("input");
      secretaryShadow.appendChild(internalPillInput);

      document.body.appendChild(webComponent);
      document.body.appendChild(secretaryRoot);

      const found = scanner.findAllInputControls(document.body);
      assert.strictEqual(found.length, 1);
      assert.ok(found.includes(shadowInput));
      assert.strictEqual(found.includes(internalPillInput), false);
    });
  });

  describe("scanPageFields", () => {
    it("returns empty array when matcher is missing", () => {
      assert.deepEqual(scanner.scanPageFields([], null), []);
    });

    it("scans page fields and accurately returns detected metadata and match details", () => {
      const input1 = new MockElement("input");
      input1.type = "text";
      input1.setAttribute("name", "user_email");
      input1.setAttribute("placeholder", "Enter email");
      input1.value = "current@example.com";

      const input2 = new MockElement("input");
      input2.type = "text";
      input2.setAttribute("name", "unmatched_field");

      const disabledInput = new MockElement("input");
      disabledInput.disabled = true;

      const readOnlyInput = new MockElement("input");
      readOnlyInput.readOnly = true;

      document.body.appendChild(input1);
      document.body.appendChild(input2);
      document.body.appendChild(disabledInput);
      document.body.appendChild(readOnlyInput);

      const savedFields = [
        {
          id: "field_email_1",
          label: "Email",
          value: "saved@company.com",
          pattern: "email",
          matchType: "smart",
          enabled: true,
        },
      ];

      const detected = scanner.scanPageFields(savedFields, matcher);
      assert.strictEqual(detected.length, 2); // skips disabled & readonly

      assert.strictEqual(detected[0].name, "user_email");
      assert.strictEqual(detected[0].matchesCount, 1);
      assert.ok(detected[0].topMatch);
      assert.strictEqual(detected[0].topMatch.fieldId, "field_email_1");
      assert.strictEqual(detected[0].topMatch.value, "saved@company.com");

      assert.strictEqual(detected[1].name, "unmatched_field");
      assert.strictEqual(detected[1].matchesCount, 0);
      assert.strictEqual(detected[1].topMatch, null);
    });

    it("filters out invisible/hidden textareas and prevents H1 job title from being scanned", () => {
      // Container with H1 heading
      const mainContainer = new MockElement("div");
      const titleWrapper = new MockElement("div");
      const h1 = new MockElement("h1");
      h1.className = "_title_dea4p_33 _large_dea4p_66 ashby-job-posting-heading";
      h1.innerText = "Software Engineer, Frontend / Full Stack (Trading)";
      titleWrapper.appendChild(h1);
      mainContainer.appendChild(titleWrapper);

      // Hidden textarea (e.g. utility / clipboard / inactive tab)
      const hiddenTextarea = new MockElement("textarea");
      hiddenTextarea.style.display = "none";
      mainContainer.appendChild(hiddenTextarea);

      // Visible text input
      const visibleFieldEntry = new MockElement("div");
      visibleFieldEntry.className = "_fieldEntry_1e3gg_28";
      const label = new MockElement("label");
      label.setAttribute("for", "_systemfield_name");
      label.innerText = "Name";
      const nameInput = new MockElement("input");
      nameInput.id = "_systemfield_name";
      nameInput.type = "text";
      visibleFieldEntry.appendChild(label);
      visibleFieldEntry.appendChild(nameInput);
      mainContainer.appendChild(visibleFieldEntry);

      document.body.appendChild(mainContainer);

      const detected = scanner.scanPageFields([], matcher);
      assert.strictEqual(detected.length, 1);
      assert.strictEqual(detected[0].label, "Name");
      assert.strictEqual(detected[0].tag, "input");
      // Verify no field has the H1 title
      assert.strictEqual(
        detected.some((f) => f.label.includes("Software Engineer")),
        false,
      );
    });
  });


  describe("fillAllMatchedFieldsOnPage", () => {
    it("returns 0 if matcher or filler is missing", () => {
      assert.strictEqual(
        scanner.fillAllMatchedFieldsOnPage([], null, filler),
        0,
      );
      assert.strictEqual(
        scanner.fillAllMatchedFieldsOnPage([], matcher, null),
        0,
      );
    });

    it("mass fills all matched fields and returns total filled count", () => {
      const emailInput = new MockElement("input");
      emailInput.setAttribute("name", "email");

      const phoneInput = new MockElement("input");
      phoneInput.setAttribute("name", "phone");

      const noMatchInput = new MockElement("input");
      noMatchInput.setAttribute("name", "unrelated");

      document.body.appendChild(emailInput);
      document.body.appendChild(phoneInput);
      document.body.appendChild(noMatchInput);

      const savedFields = [
        {
          id: "1",
          label: "Email",
          value: "test@company.com",
          matchType: "smart",
          pattern: "email",
          enabled: true,
        },
        {
          id: "2",
          label: "Phone",
          value: "+1 555-0199",
          matchType: "smart",
          pattern: "phone",
          enabled: true,
        },
      ];

      const filled = scanner.fillAllMatchedFieldsOnPage(
        savedFields,
        matcher,
        filler,
      );
      assert.strictEqual(filled, 2);
      assert.strictEqual(emailInput.value, "test@company.com");
      assert.strictEqual(phoneInput.value, "+1 555-0199");
      assert.strictEqual(noMatchInput.value, "");
    });

    it("scans and fills radio groups and custom Yes/No toggle buttons", () => {
      // 1. Ashby Yes/No toggle
      const yesNoEntry = new MockElement("div");
      yesNoEntry.className = "_fieldEntry_1e3gg_28";
      const ynLabel = new MockElement("label");
      ynLabel.innerText = "Are you authorized to work in your intended work location?";
      const ynContainer = new MockElement("div");
      ynContainer.className = "_yesno";
      const btnYes = new MockElement("button");
      btnYes.innerText = "Yes";
      const btnNo = new MockElement("button");
      btnNo.innerText = "No";
      const ynCheckbox = new MockElement("input");
      ynCheckbox.type = "checkbox";
      ynCheckbox.name = "work_auth";
      ynContainer.appendChild(btnYes);
      ynContainer.appendChild(btnNo);
      ynContainer.appendChild(ynCheckbox);
      yesNoEntry.appendChild(ynLabel);
      yesNoEntry.appendChild(ynContainer);

      // 2. Ashby 4-option radio group
      const radioEntry = new MockElement("div");
      const fieldset = new MockElement("fieldset");
      const radioLabel = new MockElement("label");
      radioLabel.innerText = "Which of these three locations will you be working from?";
      fieldset.appendChild(radioLabel);

      const r0 = new MockElement("input");
      r0.type = "radio";
      r0.name = "work_location";
      r0.id = "r0";
      const l0 = new MockElement("label");
      l0.setAttribute("for", "r0");
      l0.innerText = "North America";

      const r1 = new MockElement("input");
      r1.type = "radio";
      r1.name = "work_location";
      r1.id = "r1";
      const l1 = new MockElement("label");
      l1.setAttribute("for", "r1");
      l1.innerText = "South America";

      fieldset.appendChild(r0);
      fieldset.appendChild(l0);
      fieldset.appendChild(r1);
      fieldset.appendChild(l1);
      radioEntry.appendChild(fieldset);

      document.body.appendChild(yesNoEntry);
      document.body.appendChild(radioEntry);

      // Scan
      const detected = scanner.scanPageFields([], matcher);
      const radioDetected = detected.filter((d) => d.type === "radio");
      const checkDetected = detected.filter((d) => d.type === "checkbox");

      // Verify radio group is grouped as 1 single entry
      assert.strictEqual(radioDetected.length, 1);
      assert.strictEqual(
        radioDetected[0].label,
        "Which of these three locations will you be working from?",
      );
      assert.strictEqual(checkDetected.length, 1);
      assert.strictEqual(
        checkDetected[0].label,
        "Are you authorized to work in your intended work location?",
      );

      // Fill
      const saved = [
        {
          id: "f1",
          label: "Work Authorization",
          value: "Yes",
          pattern: "authorized to work",
          matchType: "smart",
          enabled: true,
        },
        {
          id: "f2",
          label: "Work Location",
          value: "North America",
          pattern: "locations will you be working from",
          matchType: "smart",
          enabled: true,
        },
      ];

      const filledCount = scanner.fillAllMatchedFieldsOnPage(
        saved,
        matcher,
        filler,
      );
      assert.strictEqual(filledCount, 2);
      assert.strictEqual(ynCheckbox.checked, true);
      assert.strictEqual(r0.checked, true);
      assert.strictEqual(r1.checked, false);
    });
  });
});


