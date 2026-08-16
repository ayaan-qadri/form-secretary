import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setupTestEnvironment,
  MockElement,
  MockEvent,
} from "./helpers/test-dom-helper.js";

const { document, chrome } = setupTestEnvironment();
import * as storage from "../src/shared/storage.ts";
import * as ui from "../src/content/ui.ts";

// Load content coordinator
const contentModule = await import("../src/entrypoints/content/index.ts");
if (contentModule.default && typeof contentModule.default.main === "function") {
  contentModule.default.main();
}

describe("Content Script Coordinator", () => {
  beforeEach(async () => {
    document.body.children = [];
    ui.initShadowHost();
    await storage.resetToDefaults();
  });

  it("prevents multiple duplicate injections via __FORM_SECRETARY_INJECTED__ flag", () => {
    assert.strictEqual(globalThis.window.__FORM_SECRETARY_INJECTED__, true);
  });

  describe("Runtime message dispatcher", () => {
    it("handles GET_PAGE_FIELDS runtime message", async () => {
      const input = new MockElement("input");
      input.type = "text";
      input.setAttribute("name", "user_email");
      document.body.appendChild(input);

      await storage.saveField({
        label: "Email",
        value: "me@site.com",
        pattern: "email",
      });

      // Trigger message listener directly
      const messageListener = chrome._messageListeners[0];
      assert.ok(messageListener);

      let responsePayload = null;
      messageListener({ action: "GET_PAGE_FIELDS" }, {}, (res) => {
        responsePayload = res;
      });

      assert.ok(responsePayload);
      assert.ok(Array.isArray(responsePayload.fields));
      assert.strictEqual(responsePayload.fields.length, 1);
    });

    it("handles FILL_ALL_MATCHES runtime message", async () => {
      const input = new MockElement("input");
      input.setAttribute("name", "email");
      document.body.appendChild(input);

      await storage.saveField({
        label: "Email",
        value: "auto@site.com",
        pattern: "email",
      });

      // Refresh storage cache
      const messageListener = chrome._messageListeners[0];
      await new Promise((resolve) => {
        messageListener({ action: "REFRESH_FIELDS" }, {}, resolve);
      });

      let responsePayload = null;
      messageListener({ action: "FILL_ALL_MATCHES" }, {}, (res) => {
        responsePayload = res;
      });

      assert.ok(responsePayload);
      assert.strictEqual(responsePayload.success, true);
      assert.strictEqual(responsePayload.count, 1);
      assert.strictEqual(input.value, "auto@site.com");
    });

    it("handles FILL_SPECIFIC_FIELD runtime message", async () => {
      const input1 = new MockElement("input");
      const input2 = new MockElement("input");
      document.body.appendChild(input1);
      document.body.appendChild(input2);

      const messageListener = chrome._messageListeners[0];

      let responsePayload = null;
      messageListener(
        {
          action: "FILL_SPECIFIC_FIELD",
          fieldIndex: 1,
          value: "Direct Fill Value",
        },
        {},
        (res) => {
          responsePayload = res;
        },
      );

      assert.ok(responsePayload);
      assert.strictEqual(responsePayload.success, true);
      assert.strictEqual(input2.value, "Direct Fill Value");
    });

    it("handles FOCUS_FIELD runtime message by scrolling and focusing target element", async () => {
      const input1 = new MockElement("input");
      const input2 = new MockElement("input");
      document.body.appendChild(input1);
      document.body.appendChild(input2);

      const messageListener = chrome._messageListeners[0];

      let responsePayload = null;
      messageListener(
        {
          action: "FOCUS_FIELD",
          fieldIndex: 1,
        },
        {},
        (res) => {
          responsePayload = res;
        },
      );

      assert.ok(responsePayload);
      assert.strictEqual(responsePayload.success, true);
      assert.strictEqual(input2._scrolledIntoView, true);
      assert.strictEqual(document.activeElement, input2);
    });

    it("handles FOCUS_FIELD on custom hidden proxy checkbox by scrolling the visible field label/container and focusing the button", async () => {
      const fieldEntry = new MockElement("div");
      fieldEntry.className = "_fieldEntry_1e3gg_28";
      const qLabel = new MockElement("label");
      qLabel.innerText = "Are you authorized to work in your intended work location?";
      const yesNoContainer = new MockElement("div");
      yesNoContainer.className = "_yesno";
      const btnYes = new MockElement("button");
      btnYes.innerText = "Yes";
      const btnNo = new MockElement("button");
      btnNo.innerText = "No";
      const hiddenCheckbox = new MockElement("input");
      hiddenCheckbox.type = "checkbox";
      hiddenCheckbox.style.display = "none";

      yesNoContainer.appendChild(btnYes);
      yesNoContainer.appendChild(btnNo);
      yesNoContainer.appendChild(hiddenCheckbox);
      fieldEntry.appendChild(qLabel);
      fieldEntry.appendChild(yesNoContainer);
      document.body.appendChild(fieldEntry);

      const messageListener = chrome._messageListeners[0];

      let responsePayload = null;
      messageListener(
        {
          action: "FOCUS_FIELD",
          fieldIndex: 0,
        },
        {},
        (res) => {
          responsePayload = res;
        },
      );

      assert.ok(responsePayload);
      assert.strictEqual(responsePayload.success, true);
      // Verify the visible question label or container was scrolled into view
      assert.ok(qLabel._scrolledIntoView || fieldEntry._scrolledIntoView || yesNoContainer._scrolledIntoView);
      // Verify the button was focused
      assert.strictEqual(document.activeElement, btnYes);
    });
  });


  describe("Focus & Input event handling", () => {
    it("shows trigger pill on focusin when field matches saved rule", async () => {
      await storage.saveField({
        label: "First Name",
        value: "John",
        pattern: "first name",
      });

      for (const listener of chrome._messageListeners) {
        listener({ action: "REFRESH_FIELDS" }, {}, () => {});
      }
      await new Promise((resolve) => setTimeout(resolve, 60));

      const input = new MockElement("input");
      input.setAttribute("name", "first_name");
      input.setAttribute("placeholder", "Enter first name");
      document.body.appendChild(input);

      const focusEvent = new MockEvent("focusin", { bubbles: true });
      input.dispatchEvent(focusEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const { triggerContainer } = ui.initShadowHost();
      assert.ok(triggerContainer);
      assert.strictEqual(triggerContainer.style.display, "flex");
    });

    it("hides trigger pill when input value exceeds maxCharsToHideTrigger threshold", async () => {
      await storage.saveField({
        label: "First Name",
        value: "John",
        pattern: "first name",
      });

      for (const listener of chrome._messageListeners) {
        listener({ action: "REFRESH_FIELDS" }, {}, () => {});
      }
      await new Promise((resolve) => setTimeout(resolve, 60));

      const input = new MockElement("input");
      input.setAttribute("name", "first_name");
      input.value = "Johnathan Doe"; // > 3 chars
      document.body.appendChild(input);

      const inputEvent = new MockEvent("input", { bubbles: true });
      input.dispatchEvent(inputEvent);

      const { triggerContainer } = ui.initShadowHost();
      assert.strictEqual(triggerContainer.style.display, "none");
    });

    it("hides trigger pill on disabled or readOnly fields", async () => {
      const disabledInput = new MockElement("input");
      disabledInput.disabled = true;
      document.body.appendChild(disabledInput);

      const focusEvent = new MockEvent("focusin", { bubbles: true });
      disabledInput.dispatchEvent(focusEvent);

      const { triggerContainer } = ui.initShadowHost();
      assert.strictEqual(triggerContainer.style.display, "none");
    });

    it("auto-hides trigger pill when input loses focus (focusout) after timeout", async () => {
      await storage.saveField({
        label: "First Name",
        value: "John",
        pattern: "first name",
      });

      for (const listener of chrome._messageListeners) {
        listener({ action: "REFRESH_FIELDS" }, {}, () => {});
      }
      await new Promise((resolve) => setTimeout(resolve, 60));

      const input = new MockElement("input");
      input.setAttribute("name", "first_name");
      document.body.appendChild(input);

      // Focus in: trigger pill displays
      const focusEvent = new MockEvent("focusin", { bubbles: true });
      input.dispatchEvent(focusEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const { triggerContainer } = ui.initShadowHost();
      assert.strictEqual(triggerContainer.style.display, "flex");

      // Focus out: trigger pill should auto-hide after 1500ms
      const focusOutEvent = new MockEvent("focusout", { bubbles: true });
      input.dispatchEvent(focusOutEvent);

      // Still visible immediately (< 1500ms)
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.strictEqual(triggerContainer.style.display, "flex");

      // Auto-hides after 1500ms timeout
      await new Promise((resolve) => setTimeout(resolve, 1400));
      assert.strictEqual(triggerContainer.style.display, "none");
      assert.strictEqual(ui.isTriggerVisible(), false);

      // Scrolling while unfocused should NOT make trigger visible
      const scrollEvent = new MockEvent("scroll");
      window.dispatchEvent(scrollEvent);
      assert.strictEqual(triggerContainer.style.display, "none");
      assert.strictEqual(ui.isTriggerVisible(), false);
    });

    it("handles FOCUS_FIELD runtime message and brings element to view", async () => {
      const input = new MockElement("input");
      input.setAttribute("name", "profile_url");
      document.body.appendChild(input);

      const listener = chrome._messageListeners[0];
      assert.ok(listener);

      let focusRes = null;
      listener(
        { action: "FOCUS_FIELD", fieldIndex: 0, fieldName: "profile_url" },
        {},
        (res) => {
          focusRes = res;
        },
      );

      assert.ok(focusRes);
      assert.strictEqual(focusRes.success, true);
    });

    it("handles REFRESH_FIELDS runtime message", async () => {
      const listener = chrome._messageListeners[0];
      assert.ok(listener);

      let refreshRes = null;
      await new Promise((resolve) => {
        listener({ action: "REFRESH_FIELDS" }, {}, (res) => {
          refreshRes = res;
          resolve();
        });
      });

      assert.ok(refreshRes);
      assert.strictEqual(refreshRes.success, true);
    });
  });
});
