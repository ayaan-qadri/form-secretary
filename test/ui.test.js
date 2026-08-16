import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setupTestEnvironment,
  MockElement,
  MockEvent,
} from "./helpers/test-dom-helper.js";

const { document } = setupTestEnvironment();
import * as ui from "../src/content/ui.ts";

describe("FormSecretaryUI", () => {
  let uiHandles;
  let triggerClickCount = 0;

  beforeEach(() => {
    document.documentElement.children = [];
    document.documentElement.appendChild(document.head);
    document.documentElement.appendChild(document.body);
    triggerClickCount = 0;

    uiHandles = ui.initShadowHost({
      onTriggerClick: () => {
        triggerClickCount++;
      },
    });
  });

  it("initializes Shadow host root and creates pill and dropdown containers", () => {
    assert.ok(uiHandles.shadowRoot);
    assert.ok(uiHandles.triggerContainer);
    assert.ok(uiHandles.dropdownContainer);
    assert.strictEqual(
      document.getElementById("form-secretary-root") !== null,
      true,
    );
  });

  describe("updatePillContent", () => {
    it("formats pill for a single matched field", () => {
      const singleMatch = [
        {
          field: { label: "Home Address", value: "123 Main St" },
          score: 100,
        },
      ];

      ui.updatePillContent(singleMatch);

      const textEl = uiHandles.triggerContainer.querySelector(".fs-pill-text");
      const badgeEl =
        uiHandles.triggerContainer.querySelector(".fs-pill-badge");
      const arrowEl =
        uiHandles.triggerContainer.querySelector(".fs-pill-arrow");

      assert.strictEqual(textEl.textContent, "Fill: Home Address");
      assert.strictEqual(badgeEl.style.display, "none");
      assert.strictEqual(arrowEl.style.display, "none");
    });

    it("formats pill for multiple matches with count badge and chevron", () => {
      const multiMatches = [
        { field: { label: "Work Email", value: "work@corp.com" }, score: 100 },
        {
          field: { label: "Personal Email", value: "me@gmail.com" },
          score: 90,
        },
        { field: { label: "Alt Email", value: "alt@site.com" }, score: 80 },
      ];

      ui.updatePillContent(multiMatches);

      const textEl = uiHandles.triggerContainer.querySelector(".fs-pill-text");
      const badgeEl =
        uiHandles.triggerContainer.querySelector(".fs-pill-badge");
      const arrowEl =
        uiHandles.triggerContainer.querySelector(".fs-pill-arrow");

      assert.strictEqual(textEl.textContent, "Work Email");
      assert.strictEqual(badgeEl.textContent, "+2");
      assert.strictEqual(badgeEl.style.display, "inline-block");
      assert.strictEqual(arrowEl.style.display, "inline-block");
    });
  });

  describe("positionTriggerPill & positionDropdown", () => {
    it("positions trigger pill relative to target element", () => {
      const input = new MockElement("input");
      input.getBoundingClientRect = () => ({
        top: 200,
        left: 150,
        bottom: 230,
        right: 350,
        width: 200,
        height: 30,
      });

      ui.positionTriggerPill(input);

      assert.strictEqual(uiHandles.triggerContainer.style.display, "flex");
      assert.strictEqual(
        uiHandles.triggerContainer.style.visibility,
        "visible",
      );
      assert.ok(uiHandles.triggerContainer.style.top.includes("px"));
      assert.ok(uiHandles.triggerContainer.style.left.includes("px"));
    });

    it("hides trigger pill when target has zero dimensions", () => {
      const hiddenInput = new MockElement("input");
      hiddenInput.getBoundingClientRect = () => ({
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
      });

      ui.positionTriggerPill(hiddenInput);
      assert.strictEqual(uiHandles.triggerContainer.style.display, "none");
    });

    it("positions dropdown menu relative to trigger container", () => {
      uiHandles.triggerContainer.getBoundingClientRect = () => ({
        top: 234,
        left: 152,
        bottom: 260,
        right: 262,
        width: 110,
        height: 26,
      });

      ui.positionDropdown();
      assert.strictEqual(uiHandles.dropdownContainer.style.display, "flex");
      assert.ok(uiHandles.dropdownContainer.style.top.includes("px"));
    });
  });

  describe("renderDropdown & interaction", () => {
    it("renders match items and triggers callback when item is selected", () => {
      let selectedMatch = null;
      const matches = [
        {
          field: { label: "Phone 1", category: "Personal", value: "111-222" },
          score: 100,
        },
        {
          field: { label: "Phone 2", category: "Work", value: "333-444" },
          score: 90,
        },
      ];

      ui.renderDropdown(matches, (match) => {
        selectedMatch = match;
      });

      const items =
        uiHandles.dropdownContainer.querySelectorAll(".fs-dropdown-item");
      assert.strictEqual(items.length, 2);

      const firstItem = items[0];
      assert.ok(firstItem.textContent.includes("Phone 1"));
      assert.ok(firstItem.textContent.includes("Personal"));
      assert.ok(firstItem.textContent.includes("111-222"));

      // Dispatch mousedown on item
      firstItem.dispatchEvent(new MockEvent("mousedown", { bubbles: true }));
      assert.strictEqual(selectedMatch, matches[0]);
    });

    it("closes dropdown when header close icon is clicked", () => {
      ui.renderDropdown([{ field: { label: "A", value: "1" } }]);
      uiHandles.dropdownContainer.style.display = "flex";

      const closeBtn =
        uiHandles.dropdownContainer.querySelector("#fs-close-dd");
      assert.ok(closeBtn);

      closeBtn.click();
      assert.strictEqual(uiHandles.dropdownContainer.style.display, "none");
    });
  });

  describe("showSuccessState & Toast", () => {
    it("switches trigger pill to success state with checkmark and auto-hides after timeout", async () => {
      uiHandles.triggerContainer.style.display = "flex";
      ui.showSuccessState("Full Name");

      assert.strictEqual(
        uiHandles.triggerContainer.classList.contains("fs-pill-success"),
        true,
      );
      const textEl = uiHandles.triggerContainer.querySelector(".fs-pill-text");
      assert.strictEqual(textEl.textContent, "Filled Full Name");

      await new Promise((resolve) => setTimeout(resolve, 1300));
      assert.strictEqual(uiHandles.triggerContainer.style.display, "none");
    });

    it("showToast redirects message to in-trigger feedback", () => {
      uiHandles.triggerContainer.style.display = "flex";
      ui.showToast("Filled Email Address");

      const textEl = uiHandles.triggerContainer.querySelector(".fs-pill-text");
      assert.strictEqual(textEl.textContent, "Filled Email Address");
      ui.hideTrigger();
    });
  });

  describe("Dropdown open state helpers", () => {
    it("accurately reports isDropdownOpen and closes dropdown with closeDropdown", () => {
      uiHandles.dropdownContainer.style.display = "none";
      assert.strictEqual(ui.isDropdownOpen(), false);

      uiHandles.dropdownContainer.style.display = "flex";
      assert.strictEqual(ui.isDropdownOpen(), true);

      ui.closeDropdown();
      assert.strictEqual(ui.isDropdownOpen(), false);
    });

    it("flips dropdown above trigger when positioned near bottom of viewport", () => {
      uiHandles.triggerContainer.style.display = "flex";
      uiHandles.triggerContainer.getBoundingClientRect = () => ({
        top: 700,
        bottom: 730,
        left: 200,
        right: 320,
        width: 120,
        height: 30,
      });

      globalThis.window.innerHeight = 800;
      globalThis.window.innerWidth = 1200;

      ui.positionDropdown();
      assert.strictEqual(uiHandles.dropdownContainer.style.display, "flex");
      // Top should be placed above trigger: scrollY + 700 - 270 = 430
      assert.strictEqual(uiHandles.dropdownContainer.style.top, "430px");
    });

    it("highlights and scrolls element into view via bringFieldToView", async () => {
      const input = new MockElement("input");
      let scrolled = false;
      input.scrollIntoView = () => {
        scrolled = true;
      };

      const res = ui.bringFieldToView(input);
      assert.strictEqual(res, true);
      assert.strictEqual(scrolled, true);
      assert.strictEqual(input.style.outline, "3px solid #3b82f6");

      await new Promise((resolve) => setTimeout(resolve, 1700));
      assert.ok(!input.style.outline);
    });
  });
});
