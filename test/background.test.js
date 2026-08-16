import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment } from "./helpers/test-dom-helper.js";

const { chrome } = setupTestEnvironment();
const bgModule = await import("../src/entrypoints/background.ts");
if (bgModule.default && typeof bgModule.default.main === "function") {
  bgModule.default.main();
}

describe("Background Service Worker", () => {
  beforeEach(() => {
    chrome.action._badgeText = {};
    chrome.action._badgeBgColor = {};
    chrome.action._badgeTextColor = {};
    chrome.storage.local.clear();
  });

  describe("Installation and Context Menus", () => {
    it("creates context menus for page autofill and text selection on install", () => {
      assert.strictEqual(chrome._installListeners.length > 0, true);
      // Trigger install listener
      chrome._installListeners.forEach((cb) => cb());

      assert.ok(chrome._menus["fs_fill_page"]);
      assert.strictEqual(
        chrome._menus["fs_fill_page"].title,
        "Autofill All Matching Fields",
      );

      assert.ok(chrome._menus["fs_save_selection"]);
      assert.strictEqual(
        chrome._menus["fs_save_selection"].title,
        'Save "%s" to Form Secretary',
      );
    });

    it("handles context menu click on fs_fill_page by sending FILL_ALL_MATCHES message to tab", () => {
      let sentMessage = null;
      let targetTabId = null;

      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        targetTabId = tabId;
        sentMessage = msg;
        if (cb) cb({ success: true, count: 3 });
      };

      const clickHandler = chrome._contextMenuClickListeners[0];
      assert.ok(clickHandler);

      clickHandler({ menuItemId: "fs_fill_page" }, { id: 202 });

      assert.strictEqual(targetTabId, 202);
      assert.deepEqual(sentMessage, { action: "FILL_ALL_MATCHES" });
    });

    it("handles context menu click on fs_save_selection by saving field to storage and notifying tab", async () => {
      let refreshSent = false;
      chrome.tabs.sendMessage = (tabId, msg) => {
        if (msg.action === "REFRESH_FIELDS") refreshSent = true;
      };

      const clickHandler = chrome._contextMenuClickListeners[0];
      clickHandler(
        {
          menuItemId: "fs_save_selection",
          selectionText: "Selected Text Sample",
        },
        { id: 202 },
      );

      await new Promise((resolve) => setTimeout(resolve, 60));

      const storedFields = chrome._store["fs_fields"];
      assert.ok(Array.isArray(storedFields));
      assert.strictEqual(storedFields.length, 1);
      assert.strictEqual(storedFields[0].value, "Selected Text Sample");
      assert.strictEqual(refreshSent, true);
    });

    it("ignores clicks with invalid or missing tab", () => {
      const clickHandler = chrome._contextMenuClickListeners[0];
      assert.doesNotThrow(() => {
        clickHandler({ menuItemId: "fs_fill_page" }, null);
        clickHandler({ menuItemId: "fs_fill_page" }, {});
      });
    });
  });

  describe("Badge Count Updates", () => {
    it("updates badge text with matched fields count and sets badge colors", () => {
      // Simulate tab responding with 2 matched fields
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (msg.action === "GET_PAGE_FIELDS" && cb) {
          cb({
            fields: [
              { index: 0, matchesCount: 1 },
              { index: 1, matchesCount: 2 },
              { index: 2, matchesCount: 0 },
            ],
          });
        }
      };

      // Trigger tab activation listener
      chrome._tabActivatedListeners.forEach((cb) => cb({ tabId: 301 }));

      assert.strictEqual(chrome.action._badgeText[301], "2");
      assert.strictEqual(chrome.action._badgeBgColor[301], "#2563eb");
    });

    it("clears badge text when no fields match or when tab response is empty", () => {
      chrome.tabs.sendMessage = (tabId, msg, cb) => {
        if (cb) cb({ fields: [] });
      };

      chrome._tabUpdatedListeners.forEach((cb) =>
        cb(401, { status: "complete" }, { url: "https://example.com/form" }),
      );

      assert.strictEqual(chrome.action._badgeText[401], "");
    });

    it("ignores chrome:// internal pages on tab update", () => {
      let messageSent = false;
      chrome.tabs.sendMessage = () => {
        messageSent = true;
      };

      chrome._tabUpdatedListeners.forEach((cb) =>
        cb(501, { status: "complete" }, { url: "chrome://extensions" }),
      );

      assert.strictEqual(messageSent, false);
    });

    it("truncates label for selection text exceeding 20 characters", async () => {
      const clickHandler = chrome._contextMenuClickListeners[0];
      const longText = "This is a very long text selection that exceeds 20 characters";
      clickHandler(
        {
          menuItemId: "fs_save_selection",
          selectionText: longText,
        },
        { id: 205 },
      );

      await new Promise((resolve) => setTimeout(resolve, 60));

      const storedFields = chrome._store["fs_fields"];
      assert.ok(storedFields && storedFields.length > 0);
      assert.strictEqual(storedFields[0].label, "Selected: This is a very long ...");
    });

    it("executes script auto-injection on tabs during install", async () => {
      let injectedTabIds = [];
      chrome.scripting = {
        executeScript: async ({ target, files }) => {
          injectedTabIds.push(target.tabId);
        },
      };

      chrome.tabs.query = async (queryInfo) => {
        return [
          { id: 10, url: "https://example.com/login" },
          { id: 11, url: "chrome://extensions" }, // Should be skipped
          { id: 12, url: "http://testsite.local/form" },
        ];
      };

      // Re-trigger install listener
      for (const listener of chrome._installListeners) {
        await listener();
      }

      assert.ok(injectedTabIds.includes(10));
      assert.ok(injectedTabIds.includes(12));
      assert.strictEqual(injectedTabIds.includes(11), false);
    });
  });
});
