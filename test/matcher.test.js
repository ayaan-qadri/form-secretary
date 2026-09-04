import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  setupTestEnvironment,
  MockElement,
} from "./helpers/test-dom-helper.js";

setupTestEnvironment();
import * as matcher from "../src/shared/matcher.ts";

describe("FormSecretaryMatcher", () => {
  describe("cleanString", () => {
    it("returns empty string for null, undefined, or non-string inputs", () => {
      assert.strictEqual(matcher.cleanString(null), "");
      assert.strictEqual(matcher.cleanString(undefined), "");
      assert.strictEqual(matcher.cleanString(123), "");
      assert.strictEqual(matcher.cleanString({}), "");
    });

    it("converts text to lowercase", () => {
      assert.strictEqual(matcher.cleanString("FirstName"), "firstname");
      assert.strictEqual(matcher.cleanString("EMAIL ADDRESS"), "email address");
    });

    it("replaces punctuation and delimiters with single spaces", () => {
      assert.strictEqual(
        matcher.cleanString("user_first-name:input#1/test*value"),
        "user first name input 1 test value",
      );
    });

    it("normalizes multiple whitespaces and trims leading/trailing spaces", () => {
      assert.strictEqual(
        matcher.cleanString("   first    middle    last   "),
        "first middle last",
      );
    });
  });

  describe("findLabelForElement", () => {
    it("returns empty string when element is null or undefined", () => {
      assert.strictEqual(matcher.findLabelForElement(null), "");
      assert.strictEqual(matcher.findLabelForElement(undefined), "");
    });

    it("finds label from native element.labels collection", () => {
      const input = new MockElement("input");
      const label1 = new MockElement("label");
      label1.innerText = "Primary Label";
      input.labels = [label1];

      const found = matcher.findLabelForElement(input);
      assert.strictEqual(found, "Primary Label");
    });

    it('finds label via matching label[for="id"]', () => {
      const form = new MockElement("form");
      const label = new MockElement("label");
      label.setAttribute("for", "user_email_id");
      label.innerText = "Email Address";

      const input = new MockElement("input");
      input.id = "user_email_id";

      form.appendChild(label);
      form.appendChild(input);
      globalThis.document.documentElement.appendChild(form);

      const found = matcher.findLabelForElement(input);
      assert.strictEqual(found, "Email Address");
    });

    it("finds label via aria-labelledby referencing single and multiple IDs", () => {
      const labelEl1 = new MockElement("span");
      labelEl1.id = "lbl_first";
      labelEl1.innerText = "Billing";

      const labelEl2 = new MockElement("span");
      labelEl2.id = "lbl_second";
      labelEl2.innerText = "Zip Code";

      const input = new MockElement("input");
      input.setAttribute("aria-labelledby", "lbl_first lbl_second");

      globalThis.document.documentElement.appendChild(labelEl1);
      globalThis.document.documentElement.appendChild(labelEl2);
      globalThis.document.documentElement.appendChild(input);

      const found = matcher.findLabelForElement(input);
      assert.strictEqual(found, "Billing Zip Code");
    });

    it("finds label from closest enclosing <label> element ignoring inner inputs", () => {
      const parentLabel = new MockElement("label");
      parentLabel.innerText = "Accept Terms & Conditions";

      const input = new MockElement("input");
      input.type = "checkbox";
      parentLabel.appendChild(input);

      const found = matcher.findLabelForElement(input);
      assert.strictEqual(found, "Accept Terms & Conditions");
    });

    it("finds container label / legend / heading across parent hierarchy", () => {
      const section = new MockElement("div");
      const legend = new MockElement("legend");
      legend.innerText = "Shipping Address Details";

      const row = new MockElement("div");
      const input = new MockElement("input");

      section.appendChild(legend);
      section.appendChild(row);
      row.appendChild(input);

      const found = matcher.findLabelForElement(input);
      assert.strictEqual(found, "Shipping Address Details");
    });

    it("finds preceding sibling label / span element", () => {
      const group = new MockElement("div");
      const spanLabel = new MockElement("span");
      spanLabel.className = "label";
      spanLabel.innerText = "Tax Identification Number";

      const input = new MockElement("input");

      group.appendChild(spanLabel);
      group.appendChild(input);

      const found = matcher.findLabelForElement(input);
      assert.strictEqual(found, "Tax Identification Number");
    });

    it("does not treat H1 document title as a form field label", () => {
      const mainContainer = new MockElement("div");
      const h1Title = new MockElement("h1");
      h1Title.className = "_title_dea4p_33 _large_dea4p_66 ashby-job-posting-heading";
      h1Title.innerText = "Software Engineer, Frontend / Full Stack (Trading)";

      const formContainer = new MockElement("div");
      const textarea = new MockElement("textarea");

      mainContainer.appendChild(h1Title);
      mainContainer.appendChild(formContainer);
      formContainer.appendChild(textarea);

      const found = matcher.findLabelForElement(textarea);
      assert.strictEqual(found, "");
    });

    it("correctly extracts label from Ashby-style input container wrapper", () => {
      const fieldEntry = new MockElement("div");
      fieldEntry.className = "_fieldEntry_1e3gg_28 ashby-application-form-field-entry";

      const label = new MockElement("label");
      label.className = "_heading_f7cvd_52 _label_1e3gg_42 ashby-application-form-question-title";
      label.setAttribute("for", "_systemfield_location");
      label.innerText = "Anticipated Work Location (City, Country)";

      const inputContainer = new MockElement("div");
      inputContainer.className = "_inputContainer_d7ago_28";

      const comboboxInput = new MockElement("input");
      comboboxInput.setAttribute("role", "combobox");
      comboboxInput.setAttribute("placeholder", "Start typing...");

      inputContainer.appendChild(comboboxInput);
      fieldEntry.appendChild(label);
      fieldEntry.appendChild(inputContainer);

      const found = matcher.findLabelForElement(comboboxInput);
      assert.strictEqual(found, "Anticipated Work Location (City, Country)");
    });
  });


  describe("extractFieldMetadata", () => {
    it("returns null for non-form elements without contentEditable", () => {
      const div = new MockElement("div");
      div.isContentEditable = false;
      assert.strictEqual(matcher.extractFieldMetadata(div), null);
      assert.strictEqual(matcher.extractFieldMetadata(null), null);
    });

    it("extracts and normalizes metadata from input element", () => {
      const input = new MockElement("input");
      input.type = "text";
      input.setAttribute("name", "applicant_email");
      input.setAttribute("id", "contact-email");
      input.setAttribute("placeholder", "name@example.com");
      input.setAttribute("aria-label", "Your Email");
      input.setAttribute("autocomplete", "email");
      input.setAttribute("title", "Work Email");
      input.dataset = { testid: "email-input-field" };
      input.value = "john@example.com";

      const meta = matcher.extractFieldMetadata(input);
      assert.ok(meta);
      assert.strictEqual(meta.tag, "input");
      assert.strictEqual(meta.type, "text");
      assert.strictEqual(meta.name, "applicant email");
      assert.strictEqual(meta.rawName, "applicant_email");
      assert.strictEqual(meta.id, "contact email");
      assert.strictEqual(meta.rawId, "contact-email");
      assert.strictEqual(meta.placeholder, "name@example.com");
      assert.strictEqual(meta.ariaLabel, "your email");
      assert.strictEqual(meta.autocomplete, "email");
      assert.strictEqual(meta.title, "work email");
      assert.strictEqual(meta.dataAttributes, "email input field");
      assert.strictEqual(meta.value, "john@example.com");
      assert.ok(meta.combinedText.includes("applicant email"));
      assert.ok(meta.combinedText.includes("your email"));
    });

    it("extracts metadata from select and textarea elements", () => {
      const select = new MockElement("select");
      select.setAttribute("name", "country_code");
      select.setAttribute("id", "country");

      const selectMeta = matcher.extractFieldMetadata(select);
      assert.ok(selectMeta);
      assert.strictEqual(selectMeta.tag, "select");
      assert.strictEqual(selectMeta.type, "select");

      const textarea = new MockElement("textarea");
      textarea.setAttribute("name", "cover_letter");
      textarea.setAttribute("placeholder", "Write your story...");

      const textareaMeta = matcher.extractFieldMetadata(textarea);
      assert.ok(textareaMeta);
      assert.strictEqual(textareaMeta.tag, "textarea");
      assert.strictEqual(textareaMeta.type, "textarea");
      assert.strictEqual(textareaMeta.placeholder, "write your story...");
    });

    it("handles contenteditable elements", () => {
      const editable = new MockElement("div");
      editable.isContentEditable = true;
      editable.innerText = "Rich document text";
      editable.setAttribute("role", "textbox");
      editable.setAttribute("aria-label", "Document Editor");

      const meta = matcher.extractFieldMetadata(editable);
      assert.ok(meta);
      assert.strictEqual(meta.ariaLabel, "document editor");
      assert.strictEqual(meta.value, "Rich document text");
    });

    it("extracts radio group question, options, and current selection", () => {
      const fieldEntry = new MockElement("div");
      fieldEntry.setAttribute("data-field-path", "remote-locations");

      const fieldset = new MockElement("fieldset");
      fieldset.className = "_container_1258i_28 _fieldEntry_1e3gg_28";

      const questionLabel = new MockElement("label");
      questionLabel.className = "_heading_f7cvd_52 _label_1e3gg_42 ashby-application-form-question-title";
      questionLabel.innerText = "Which of these three locations will you be working from?";
      fieldset.appendChild(questionLabel);

      const options = ["North America", "South America", "Europe", "Other"];
      const radios = [];

      options.forEach((optText, idx) => {
        const optionDiv = new MockElement("div");
        optionDiv.className = "_option_1258i_34";

        const radio = new MockElement("input");
        radio.type = "radio";
        radio.id = `radio-${idx}`;
        radio.name = "remote-locations";
        if (idx === 0) radio.checked = true;

        const label = new MockElement("label");
        label.setAttribute("for", `radio-${idx}`);
        label.innerText = optText;

        optionDiv.appendChild(radio);
        optionDiv.appendChild(label);
        fieldset.appendChild(optionDiv);
        radios.push(radio);
      });

      fieldEntry.appendChild(fieldset);

      const meta = matcher.extractFieldMetadata(radios[0]);
      assert.ok(meta);
      assert.strictEqual(meta.type, "radio");
      assert.strictEqual(meta.label, "which of these three locations will you be working from?");
      assert.strictEqual(meta.value, "North America");
      assert.deepEqual(meta.options, options);
      assert.ok(meta.combinedText.includes("north america"));
      assert.ok(meta.combinedText.includes("europe"));
    });

    it("extracts metadata from Ashby Yes/No checkbox toggle", () => {
      const fieldEntry = new MockElement("div");
      fieldEntry.className = "_fieldEntry_1e3gg_28 ashby-application-form-field-entry";

      const questionLabel = new MockElement("label");
      questionLabel.className = "_heading_f7cvd_52 _label_1e3gg_42 ashby-application-form-question-title";
      questionLabel.innerText = "Are you authorized to work in your intended work location?";

      const yesNoContainer = new MockElement("div");
      yesNoContainer.className = "_container_1svni_28 _yesno_1e3gg_148";

      const btnYes = new MockElement("button");
      btnYes.className = "_container_pjyt6_1 _option_1svni_32 active";
      btnYes.innerText = "Yes";

      const btnNo = new MockElement("button");
      btnNo.className = "_container_pjyt6_1 _option_1svni_32";
      btnNo.innerText = "No";

      const checkbox = new MockElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "work_auth";
      checkbox.checked = true;

      yesNoContainer.appendChild(btnYes);
      yesNoContainer.appendChild(btnNo);
      yesNoContainer.appendChild(checkbox);

      fieldEntry.appendChild(questionLabel);
      fieldEntry.appendChild(yesNoContainer);

      const meta = matcher.extractFieldMetadata(checkbox);
      assert.ok(meta);
      assert.strictEqual(meta.type, "checkbox");
      assert.strictEqual(meta.label, "are you authorized to work in your intended work location?");
      assert.strictEqual(meta.value, "Yes");
      assert.deepEqual(meta.options, ["Yes", "No"]);
    });

    it("extracts label and options from exact Ashby Yes/No fieldEntry with data-field-path", () => {
      const fieldEntry = new MockElement("div");
      fieldEntry.className = "_fieldEntry_1e3gg_28 ashby-application-form-field-entry";
      fieldEntry.setAttribute("data-field-path", "5dce49e5-2bce-455c-9e15-1a880b3ba91d");
      fieldEntry.setAttribute("data-field-entry-id", "a444491b-a659-4d9e-9236-2f23f8d81df9_5dce49e5-2bce-455c-9e15-1a880b3ba91d");

      const questionLabel = new MockElement("label");
      questionLabel.className = "_heading_f7cvd_52 _required_f7cvd_91 _label_1e3gg_42 ashby-application-form-question-title";
      questionLabel.setAttribute("for", "5dce49e5-2bce-455c-9e15-1a880b3ba91d");
      questionLabel.innerText = "Are you authorized to work in your intended work location, stated above?";

      const yesNoContainer = new MockElement("div");
      yesNoContainer.className = "_container_1svni_28 _yesno_1e3gg_148";

      const btnYes = new MockElement("button");
      btnYes.className = "_container_pjyt6_1 _option_1svni_32";
      btnYes.innerText = "Yes";

      const btnNo = new MockElement("button");
      btnNo.className = "_container_pjyt6_1 _option_1svni_32";
      btnNo.innerText = "No";

      const checkbox = new MockElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "_input_1svni_78";
      checkbox.setAttribute("tabindex", "-1");
      checkbox.setAttribute("name", "5dce49e5-2bce-455c-9e15-1a880b3ba91d");
      checkbox.style.display = "none";

      yesNoContainer.appendChild(btnYes);
      yesNoContainer.appendChild(btnNo);
      yesNoContainer.appendChild(checkbox);

      fieldEntry.appendChild(questionLabel);
      fieldEntry.appendChild(yesNoContainer);

      document.body.appendChild(fieldEntry);

      const meta = matcher.extractFieldMetadata(checkbox);
      assert.ok(meta);
      assert.strictEqual(
        meta.label,
        "are you authorized to work in your intended work location, stated above?",
      );
      assert.strictEqual(
        meta.rawLabel,
        "Are you authorized to work in your intended work location, stated above?",
      );
      assert.deepEqual(meta.options, ["Yes", "No"]);
    });

  });



  describe("evaluateFieldMatch", () => {
    const mockFieldMeta = {
      tag: "input",
      type: "text",
      label: "phone number",
      name: "user phone",
      id: "tel input",
      placeholder: "+1 555 0100",
      ariaLabel: "phone input",
      autocomplete: "tel",
      combinedText: "phone number +1 555 0100 user phone tel input tel",
    };

    it("returns matched=false when field or fieldMeta is null or field is disabled", () => {
      assert.deepEqual(
        matcher.evaluateFieldMatch(null, { enabled: true, pattern: "phone" }),
        {
          matched: false,
          score: 0,
          matchedBy: "",
        },
      );

      assert.deepEqual(matcher.evaluateFieldMatch(mockFieldMeta, null), {
        matched: false,
        score: 0,
        matchedBy: "",
      });

      assert.deepEqual(
        matcher.evaluateFieldMatch(mockFieldMeta, {
          enabled: false,
          pattern: "phone",
        }),
        {
          matched: false,
          score: 0,
          matchedBy: "",
        },
      );
    });

    it("returns matched=false when pattern and label are empty", () => {
      const result = matcher.evaluateFieldMatch(mockFieldMeta, {
        enabled: true,
        pattern: "",
        label: "",
      });
      assert.strictEqual(result.matched, false);
      assert.strictEqual(result.score, 0);
    });

    describe("Smart Match", () => {
      it("matches exact label or name with score 100", () => {
        const field = {
          enabled: true,
          matchType: "smart",
          pattern: "phone number",
          targetProperty: "all",
        };
        const result = matcher.evaluateFieldMatch(mockFieldMeta, field);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.score, 100);
      });

      it("matches word token in label with score 90", () => {
        const fieldMeta = {
          ...mockFieldMeta,
          label: "mobile phone number for verification",
        };
        const field = {
          enabled: true,
          matchType: "smart",
          pattern: "phone",
          targetProperty: "all",
        };
        const result = matcher.evaluateFieldMatch(fieldMeta, field);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.score, 90);
      });

      it("matches substring in label with score 80", () => {
        const fieldMeta = {
          ...mockFieldMeta,
          label: "telephonenumber",
        };
        const field = {
          enabled: true,
          matchType: "smart",
          pattern: "phone",
          targetProperty: "all",
        };
        const result = matcher.evaluateFieldMatch(fieldMeta, field);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.score, 80);
      });

      it("matches word in placeholder or aria-label with score 75", () => {
        const fieldMeta = {
          tag: "input",
          type: "text",
          label: "",
          name: "",
          id: "",
          placeholder: "enter telephone now",
          ariaLabel: "",
          autocomplete: "",
          combinedText: "enter telephone now",
        };
        const field = {
          enabled: true,
          matchType: "smart",
          pattern: "telephone",
          targetProperty: "all",
        };
        const result = matcher.evaluateFieldMatch(fieldMeta, field);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.score, 75);
      });

      it("matches word in name/id/autocomplete with score 70", () => {
        const fieldMeta = {
          tag: "input",
          type: "text",
          label: "",
          name: "billing zipcode code",
          id: "",
          placeholder: "",
          ariaLabel: "",
          autocomplete: "",
          combinedText: "billing zipcode code",
        };
        const field = {
          enabled: true,
          matchType: "smart",
          pattern: "zipcode",
          targetProperty: "all",
        };
        const result = matcher.evaluateFieldMatch(fieldMeta, field);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.score, 70);
      });

      it("matches partial name/id with score 65", () => {
        const fieldMeta = {
          tag: "input",
          type: "text",
          label: "",
          name: "user_zipcode_input",
          id: "",
          placeholder: "",
          ariaLabel: "",
          autocomplete: "",
          combinedText: "user_zipcode_input",
        };
        const field = {
          enabled: true,
          matchType: "smart",
          pattern: "zipcode",
          targetProperty: "all",
        };
        const result = matcher.evaluateFieldMatch(fieldMeta, field);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.score, 65);
      });

      it("matches combined text general match with score 50", () => {
        const fieldMeta = {
          tag: "input",
          type: "text",
          label: "",
          name: "",
          id: "",
          placeholder: "",
          ariaLabel: "",
          autocomplete: "",
          combinedText: "custom data attribute token match",
        };
        const field = {
          enabled: true,
          matchType: "smart",
          pattern: "attribute",
          targetProperty: "all",
        };
        const result = matcher.evaluateFieldMatch(fieldMeta, field);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.score, 50);
      });
    });

    describe("Exact Match", () => {
      it("matches when target property exactly equals pattern", () => {
        const field = {
          enabled: true,
          matchType: "exact",
          pattern: "phone number",
          targetProperty: "label",
        };
        const result = matcher.evaluateFieldMatch(mockFieldMeta, field);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.score, 100);
      });

      it("tests exact matching across target properties (name, id, placeholder, aria)", () => {
        const nameField = {
          enabled: true,
          matchType: "exact",
          pattern: "user phone",
          targetProperty: "name",
        };
        assert.strictEqual(
          matcher.evaluateFieldMatch(mockFieldMeta, nameField).matched,
          true,
        );

        const idField = {
          enabled: true,
          matchType: "exact",
          pattern: "tel input",
          targetProperty: "id",
        };
        assert.strictEqual(
          matcher.evaluateFieldMatch(mockFieldMeta, idField).matched,
          true,
        );

        const ariaField = {
          enabled: true,
          matchType: "exact",
          pattern: "phone input",
          targetProperty: "aria",
        };
        assert.strictEqual(
          matcher.evaluateFieldMatch(mockFieldMeta, ariaField).matched,
          true,
        );
      });

      it("does not match partial text in exact mode", () => {
        const field = {
          enabled: true,
          matchType: "exact",
          pattern: "phone",
          targetProperty: "label",
        };
        assert.strictEqual(
          matcher.evaluateFieldMatch(mockFieldMeta, field).matched,
          false,
        );
      });
    });

    describe("Contains Match", () => {
      it("matches when target property contains pattern substring", () => {
        const field = {
          enabled: true,
          matchType: "contains",
          pattern: "phone",
          targetProperty: "label",
        };
        const result = matcher.evaluateFieldMatch(mockFieldMeta, field);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.score, 85);
      });

      it("does not match when substring is absent", () => {
        const field = {
          enabled: true,
          matchType: "contains",
          pattern: "email",
          targetProperty: "label",
        };
        assert.strictEqual(
          matcher.evaluateFieldMatch(mockFieldMeta, field).matched,
          false,
        );
      });
    });

    describe("Regex Match & Safety", () => {
      it("matches valid regex patterns against target property with score 95", () => {
        const field = {
          enabled: true,
          matchType: "regex",
          pattern: "^(phone|mobile|tel)",
          targetProperty: "label",
        };
        const result = matcher.evaluateFieldMatch(mockFieldMeta, field);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.score, 95);
      });

      it("handles syntactically invalid regex patterns gracefully without throwing", () => {
        const field = {
          enabled: true,
          matchType: "regex",
          pattern: "[unclosed(bracket",
          targetProperty: "all",
        };
        const result = matcher.evaluateFieldMatch(mockFieldMeta, field);
        assert.strictEqual(result.matched, false);
        assert.strictEqual(result.matchedBy, "invalid regex");
      });

      it("rejects nested quantifier patterns flagged as unsafe", () => {
        const field = {
          enabled: true,
          matchType: "regex",
          pattern: "^(a+)+$",
          targetProperty: "all",
        };
        const result = matcher.evaluateFieldMatch(mockFieldMeta, field);
        assert.strictEqual(result.matched, false);
        assert.strictEqual(result.matchedBy, "unsafe regex");
      });

      it("rejects patterns exceeding max allowed length", () => {
        const oversizedPattern = "a".repeat(300);
        const field = {
          enabled: true,
          matchType: "regex",
          pattern: oversizedPattern,
          targetProperty: "all",
        };
        const result = matcher.evaluateFieldMatch(mockFieldMeta, field);
        assert.strictEqual(result.matched, false);
        assert.strictEqual(result.matchedBy, "unsafe regex");
      });
    });
  });

  describe("findMatchingFields", () => {
    it("returns empty array when fieldMeta is null or fields array is empty", () => {
      assert.deepEqual(matcher.findMatchingFields(null, [{ id: "1" }]), []);
      assert.deepEqual(matcher.findMatchingFields({ label: "test" }, []), []);
      assert.deepEqual(matcher.findMatchingFields({ label: "test" }, null), []);
    });

    it("returns matching fields sorted in descending order of score with field property", () => {
      const fieldMeta = {
        label: "first name",
        name: "fname",
        combinedText: "first name fname",
      };

      const fields = [
        {
          id: "field_general_name",
          label: "Name",
          pattern: "name",
          matchType: "smart",
          enabled: true,
        },
        {
          id: "field_exact_fname",
          label: "First Name",
          pattern: "first name",
          matchType: "smart",
          enabled: true,
        },
        {
          id: "field_disabled",
          label: "First Name (Disabled)",
          pattern: "first name",
          matchType: "smart",
          enabled: false,
        },
      ];

      const matches = matcher.findMatchingFields(fieldMeta, fields);
      assert.strictEqual(matches.length, 2);
      assert.strictEqual(matches[0].field.id, "field_exact_fname");
      assert.strictEqual(matches[0].score, 100);
      assert.strictEqual(matches[1].field.id, "field_general_name");
      assert.ok(matches[0].score >= matches[1].score);
    });

    it("handles invalid regex patterns gracefully without throwing", () => {
      const fieldMeta = {
        label: "Email",
        name: "email",
        id: "email",
        placeholder: "Enter email",
        ariaLabel: "",
        combinedText: "Email email Enter email",
      };

      const result = matcher.evaluateFieldMatch(fieldMeta, {
        id: "invalid_reg",
        label: "Broken Regex",
        pattern: "[a-z(", // Invalid regex syntax
        matchType: "regex",
        enabled: true,
      });

      assert.strictEqual(result.matched, false);
      assert.strictEqual(result.matchedBy, "invalid regex");
    });

    it("evaluates matches against specific targetProperty options", () => {
      const fieldMeta = {
        label: "Primary Phone",
        name: "contact_cell",
        id: "input_phone_id",
        placeholder: "e.g. +1 555 0199",
        ariaLabel: "Phone number input",
        combinedText: "Primary Phone contact_cell input_phone_id e.g. +1 555 0199 Phone number input",
      };

      // Match specifically on placeholder
      const placeholderMatch = matcher.evaluateFieldMatch(fieldMeta, {
        id: "f_placeholder",
        label: "Sample Number",
        pattern: "555 0199",
        matchType: "contains",
        targetProperty: "placeholder",
        enabled: true,
      });
      assert.strictEqual(placeholderMatch.matched, true);

      // Match specifically on id
      const idMatch = matcher.evaluateFieldMatch(fieldMeta, {
        id: "f_id",
        label: "Phone Field ID",
        pattern: "input_phone_id",
        matchType: "exact",
        targetProperty: "id",
        enabled: true,
      });
      assert.strictEqual(idMatch.matched, true);

      // Match specifically on aria
      const ariaMatch = matcher.evaluateFieldMatch(fieldMeta, {
        id: "f_aria",
        label: "Aria Match",
        pattern: "Phone number input",
        matchType: "exact",
        targetProperty: "aria",
        enabled: true,
      });
      assert.strictEqual(ariaMatch.matched, true);
    });

    it("extracts metadata from contenteditable elements and select elements with options", () => {
      const divEditable = new MockElement("div");
      divEditable.isContentEditable = true;
      divEditable.setAttribute("aria-label", "Write your bio snippet");
      divEditable.textContent = "My intro";

      const editableMeta = matcher.extractFieldMetadata(divEditable);
      assert.ok(editableMeta);
      assert.strictEqual(editableMeta.tag, "div");
      assert.strictEqual(editableMeta.value, "My intro");

      const selectEl = new MockElement("select");
      selectEl.setAttribute("name", "country_code");
      const opt1 = new MockElement("option");
      opt1.value = "US";
      opt1.text = "United States";
      const opt2 = new MockElement("option");
      opt2.value = "CA";
      opt2.text = "Canada";
      selectEl.appendChild(opt1);
      selectEl.appendChild(opt2);

      const selectMeta = matcher.extractFieldMetadata(selectEl);
      assert.ok(selectMeta);
      assert.strictEqual(selectMeta.type, "select");
      assert.strictEqual(selectMeta.options?.length, 2);
    });

    it("extracts labels from table th and cleans tooltip question marks like Mozilla Add-on Hub", () => {
      const table = new MockElement("table");
      const tbody = new MockElement("tbody");
      const tr = new MockElement("tr");
      const th = new MockElement("th");
      const labelSpan = new MockElement("span");
      labelSpan.className = "label";
      labelSpan.innerText = "Add-on URL";
      const tooltipSpan = new MockElement("span");
      tooltipSpan.className = "tip tooltip";
      tooltipSpan.innerText = "?";
      th.appendChild(labelSpan);
      th.appendChild(tooltipSpan);

      const td = new MockElement("td");
      const divWrapper = new MockElement("div");
      divWrapper.className = "edit_with_prefix";
      const prefixSpan = new MockElement("span");
      prefixSpan.innerText = "https://addons.mozilla.org/…/";
      const input = new MockElement("input");
      input.type = "text";
      input.name = "slug";
      input.id = "id_slug";
      input.value = "form-secretary";
      divWrapper.appendChild(prefixSpan);
      divWrapper.appendChild(input);
      td.appendChild(divWrapper);

      tr.appendChild(th);
      tr.appendChild(td);
      tbody.appendChild(tr);
      table.appendChild(tbody);
      globalThis.document.documentElement.appendChild(table);

      const extractedLabel = matcher.findLabelForElement(input);
      assert.strictEqual(extractedLabel, "Add-on URL");

      const meta = matcher.extractFieldMetadata(input);
      assert.ok(meta);
      assert.strictEqual(meta.rawLabel, "Add-on URL");
      assert.strictEqual(meta.name, "slug");
    });

    it("extracts question title for Greenhouse EEOC radio inputs inside field container", () => {
      const container = new MockElement("div");
      container.className = "field";
      container.id =
        "9348dde4-b215-4690-add7-2547832d0e4b__systemfield_eeoc_disability_status_container";

      const questionLabel = new MockElement("label");
      questionLabel.id =
        "9348dde4-b215-4690-add7-2547832d0e4b__systemfield_eeoc_disability_status_label";
      questionLabel.innerText = "Voluntary Self-Identification of Disability";

      const radio = new MockElement("input");
      radio.type = "radio";
      radio.name =
        "9348dde4-b215-4690-add7-2547832d0e4b__systemfield_eeoc_disability_status";
      radio.id =
        "9348dde4-b215-4690-add7-2547832d0e4b__systemfield_eeoc_disability_status-labeled-radio-0";
      radio.value = "Yes";

      container.appendChild(questionLabel);
      container.appendChild(radio);
      globalThis.document.documentElement.appendChild(container);

      const foundLabel = matcher.findLabelForElement(radio);
      assert.strictEqual(
        foundLabel,
        "Voluntary Self-Identification of Disability",
      );
    });
  });

  describe("cleanFieldIdentifier", () => {
    it("strips UUIDs and ATS prefixes/suffixes from field names", () => {
      const name =
        "9348dde4-b215-4690-add7-2547832d0e4b__systemfield_eeoc_disability_status";
      assert.strictEqual(
        matcher.cleanFieldIdentifier(name),
        "EEOC Disability Status",
      );

      const radioId =
        "9348dde4-b215-4690-add7-2547832d0e4b__systemfield_eeoc_disability_status-labeled-radio-0";
      assert.strictEqual(
        matcher.cleanFieldIdentifier(radioId),
        "EEOC Disability Status",
      );
    });

    it("handles hex hashes, customfield prefixes, and camelCase", () => {
      assert.strictEqual(
        matcher.cleanFieldIdentifier("customfield_10025_phone_number"),
        "Phone Number",
      );
      assert.strictEqual(
        matcher.cleanFieldIdentifier(
          "c8f12a4b-1234-5678-9abc-def012345678_first_name",
        ),
        "First Name",
      );
      assert.strictEqual(
        matcher.cleanFieldIdentifier("user[profile_attributes][ssn]"),
        "User Profile Attributes SSN",
      );
    });

    it("handles empty or invalid values safely", () => {
      assert.strictEqual(matcher.cleanFieldIdentifier(""), "");
      assert.strictEqual(matcher.cleanFieldIdentifier(null), "");
      assert.strictEqual(matcher.cleanFieldIdentifier(undefined), "");
    });
  });

  describe("extractSuggestedKeywords", () => {
    it("excludes raw DOM IDs and terms matching display name", () => {
      const field = {
        name: "9348dde4-b215-4690-add7-2547832d0e4b__systemfield_eeoc_disability_status",
        id: "9348dde4-b215-4690-add7-2547832d0e4b__systemfield_eeoc_disability_status-labeled-radio-0",
        label: "EEOC Disability Status",
      };
      // When display name already matches the cleaned name/label, returns empty
      const keywords = matcher.extractSuggestedKeywords(
        field,
        "EEOC Disability Status",
      );
      assert.strictEqual(keywords, "");
    });

    it("provides cleaned keywords when name offers distinct informative words", () => {
      const field = {
        name: "9348dde4-b215-4690-add7-2547832d0e4b__systemfield_eeoc_disability_status",
        id: "9348dde4-b215-4690-add7-2547832d0e4b__systemfield_eeoc_disability_status-labeled-radio-0",
      };
      const keywords = matcher.extractSuggestedKeywords(
        field,
        "Disability Status",
      );
      // Cleaned name is "EEOC Disability Status", which provides extra keyword "EEOC Disability Status"
      assert.strictEqual(keywords, "EEOC Disability Status");
    });
  });
});
