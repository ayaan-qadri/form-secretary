import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setupTestEnvironment,
  MockElement,
} from "./helpers/test-dom-helper.js";

setupTestEnvironment();
import * as filler from "../src/content/filler.ts";

describe("FormSecretaryFiller", () => {
  it("returns false for null element or undefined value", () => {
    assert.strictEqual(filler.fillElement(null, "test"), false);
    assert.strictEqual(
      filler.fillElement(new MockElement("input"), undefined),
      false,
    );
    assert.strictEqual(
      filler.fillElement(new MockElement("input"), null),
      false,
    );
  });

  describe("fillElement on Input & Textarea", () => {
    it("sets value and updates React _valueTracker when present", () => {
      const input = new MockElement("input");
      let trackerUpdatedValue = null;
      input._valueTracker = {
        setValue(val) {
          trackerUpdatedValue = val;
        },
      };

      const success = filler.fillElement(input, "jane.doe@example.com");
      assert.strictEqual(success, true);
      assert.strictEqual(input.value, "jane.doe@example.com");
      assert.strictEqual(trackerUpdatedValue, "jane.doe@example.com");
    });

    it("fills textarea element correctly", () => {
      const textarea = new MockElement("textarea");
      const success = filler.fillElement(
        textarea,
        "Multi-line\ncover letter content",
      );
      assert.strictEqual(success, true);
      assert.strictEqual(textarea.value, "Multi-line\ncover letter content");
    });
  });

  describe("fillElement on Select element", () => {
    it("matches select option by exact value", () => {
      const select = new MockElement("select");
      const opt1 = new MockElement("option");
      opt1.value = "US";
      opt1.text = "United States";
      const opt2 = new MockElement("option");
      opt2.value = "CA";
      opt2.text = "Canada";

      select.appendChild(opt1);
      select.appendChild(opt2);

      const success = filler.fillElement(select, "CA");
      assert.strictEqual(success, true);
      assert.strictEqual(select.selectedIndex, 1);
    });

    it("matches select option by option text and case-insensitively", () => {
      const select = new MockElement("select");
      const opt1 = new MockElement("option");
      opt1.value = "full_time";
      opt1.text = "Full-Time Employment";
      const opt2 = new MockElement("option");
      opt2.value = "contract";
      opt2.text = "Contractor / Freelance";

      select.appendChild(opt1);
      select.appendChild(opt2);

      const success = filler.fillElement(select, "contractor");
      assert.strictEqual(success, true);
      assert.strictEqual(select.selectedIndex, 1);
    });
  });

  describe("fillElement on Radio Button Groups", () => {
    it("selects correct radio button in a named group by label text", () => {
      const container = new MockElement("fieldset");
      const r0 = new MockElement("input");
      r0.type = "radio";
      r0.name = "work_location";
      r0.id = "radio-na";

      const l0 = new MockElement("label");
      l0.setAttribute("for", "radio-na");
      l0.innerText = "North America";

      const r1 = new MockElement("input");
      r1.type = "radio";
      r1.name = "work_location";
      r1.id = "radio-sa";

      const l1 = new MockElement("label");
      l1.setAttribute("for", "radio-sa");
      l1.innerText = "South America";

      const r2 = new MockElement("input");
      r2.type = "radio";
      r2.name = "work_location";
      r2.id = "radio-eu";

      const l2 = new MockElement("label");
      l2.setAttribute("for", "radio-eu");
      l2.innerText = "Europe";

      container.appendChild(r0);
      container.appendChild(l0);
      container.appendChild(r1);
      container.appendChild(l1);
      container.appendChild(r2);
      container.appendChild(l2);

      // Call fill on first radio with target "Europe"
      const success = filler.fillElement(r0, "Europe");
      assert.strictEqual(success, true);
      assert.strictEqual(r2.checked, true);
      assert.strictEqual(r0.checked, false);
      assert.strictEqual(r1.checked, false);
    });
  });

  describe("fillElement on Checkbox & Yes/No Toggle Buttons", () => {
    it("clicks Yes button in custom Yes/No toggle container for positive value", () => {
      const fieldEntry = new MockElement("div");
      fieldEntry.className = "_fieldEntry_1e3gg_28 ashby-application-form-field-entry";

      const yesNoContainer = new MockElement("div");
      yesNoContainer.className = "_container_1svni_28 _yesno_1e3gg_148";

      let yesClicked = false;
      let noClicked = false;

      const btnYes = new MockElement("button");
      btnYes.className = "_container_pjyt6_1 _option_1svni_32";
      btnYes.innerText = "Yes";
      btnYes.addEventListener("click", () => {
        yesClicked = true;
      });

      const btnNo = new MockElement("button");
      btnNo.className = "_container_pjyt6_1 _option_1svni_32";
      btnNo.innerText = "No";
      btnNo.addEventListener("click", () => {
        noClicked = true;
      });

      const checkbox = new MockElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "work_auth";

      yesNoContainer.appendChild(btnYes);
      yesNoContainer.appendChild(btnNo);
      yesNoContainer.appendChild(checkbox);
      fieldEntry.appendChild(yesNoContainer);

      const success = filler.fillElement(checkbox, "Yes");
      assert.strictEqual(success, true);
      assert.strictEqual(checkbox.checked, true);
      assert.strictEqual(yesClicked, true);
      assert.strictEqual(noClicked, false);
    });

    it("clicks No button in custom Yes/No toggle container for negative value", () => {
      const yesNoContainer = new MockElement("div");
      yesNoContainer.className = "_yesno";

      let noClicked = false;
      const btnYes = new MockElement("button");
      btnYes.innerText = "Yes";

      const btnNo = new MockElement("button");
      btnNo.innerText = "No";
      btnNo.addEventListener("click", () => {
        noClicked = true;
      });

      const checkbox = new MockElement("input");
      checkbox.type = "checkbox";

      yesNoContainer.appendChild(btnYes);
      yesNoContainer.appendChild(btnNo);
      yesNoContainer.appendChild(checkbox);

      const success = filler.fillElement(checkbox, "false");
      assert.strictEqual(success, true);
      assert.strictEqual(checkbox.checked, false);
      assert.strictEqual(noClicked, true);
    });

    it("sets standard checkbox checked state for boolean/string values", () => {
      const checkbox = new MockElement("input");
      checkbox.type = "checkbox";

      filler.fillElement(checkbox, "true");
      assert.strictEqual(checkbox.checked, true);

      filler.fillElement(checkbox, "no");
      assert.strictEqual(checkbox.checked, false);
    });
  });

  describe("fillElement on ContentEditable", () => {
    it("sets innerText on contenteditable elements", () => {
      const editable = new MockElement("div");
      editable.isContentEditable = true;

      const success = filler.fillElement(editable, "Custom rich text autofill");
      assert.strictEqual(success, true);
      assert.strictEqual(editable.innerText, "Custom rich text autofill");
    });
  });


  describe("Framework Reactivity Event Sequence", () => {
    it("dispatches focus, input, change, keydown, keyup, and blur events with bubbling", () => {
      const input = new MockElement("input");
      const eventsDispatched = [];

      ["focus", "input", "change", "keydown", "keyup", "blur"].forEach(
        (eventType) => {
          input.addEventListener(eventType, (e) => {
            eventsDispatched.push({
              type: e.type,
              bubbles: e.bubbles,
              composed: e.composed,
            });
          });
        },
      );

      filler.fillElement(input, "Test Event Value");

      assert.deepEqual(
        eventsDispatched.map((e) => e.type),
        ["focus", "input", "change", "keydown", "keyup", "blur"],
      );
      eventsDispatched.forEach((e) => {
        assert.strictEqual(e.bubbles, true);
        assert.strictEqual(e.composed, true);
      });
    });
  });

  describe("Visual Pulse Highlight", () => {
    it("adds form-secretary-filled-pulse class and removes it after timeout when enabled", async () => {
      const input = new MockElement("input");
      filler.fillElement(input, "Highlight Test", {
        highlightFilledFields: true,
      });

      assert.strictEqual(
        input.classList.contains("form-secretary-filled-pulse"),
        true,
      );

      await new Promise((resolve) => setTimeout(resolve, 1300));
      assert.strictEqual(
        input.classList.contains("form-secretary-filled-pulse"),
        false,
      );
    });

    it("does not add highlight class when highlightFilledFields is false", () => {
      const input = new MockElement("input");
      filler.fillElement(input, "No Highlight", {
        highlightFilledFields: false,
      });

      assert.strictEqual(
        input.classList.contains("form-secretary-filled-pulse"),
        false,
      );
    });
  });

  describe("Error handling", () => {
    it("catches element throwing on event dispatch and returns false", () => {
      const badElement = new MockElement("input");
      badElement.dispatchEvent = () => {
        throw new Error("Event system failure");
      };

      const success = filler.fillElement(badElement, "fail");
      assert.strictEqual(success, false);
    });

    it("updates React _valueTracker on inputs and checkboxes", () => {
      const input = new MockElement("input");
      let trackedValue = "";
      input._valueTracker = {
        setValue: (v) => {
          trackedValue = v;
        },
      };

      filler.fillElement(input, "React state tracker test");
      assert.strictEqual(trackedValue, "React state tracker test");

      const checkbox = new MockElement("input");
      checkbox.type = "checkbox";
      let trackedCheck = "";
      checkbox._valueTracker = {
        setValue: (v) => {
          trackedCheck = v;
        },
      };

      filler.fillElement(checkbox, true);
      assert.strictEqual(trackedCheck, "true");
    });

    it("clicks option wrapper when filling radio buttons inside custom option containers", () => {
      const optionContainer = new MockElement("label");
      optionContainer.className = "_option_wrapper";
      let wrapperClicked = false;
      optionContainer.click = () => {
        wrapperClicked = true;
      };

      const radio = new MockElement("input");
      radio.type = "radio";
      radio.name = "plan_choice";
      radio.value = "pro";
      optionContainer.appendChild(radio);

      filler.fillElement(radio, "pro");
      assert.strictEqual(radio.checked, true);
      assert.strictEqual(wrapperClicked, true);
    });
  });
});
