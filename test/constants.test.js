import { describe, it } from "node:test";
import assert from "node:assert/strict";

import * as constants from "../src/shared/constants.ts";

describe("FormSecretaryConstants", () => {
  it("exports FormSecretaryConstants definitions", () => {
    assert.ok(constants);
    assert.strictEqual(typeof constants, "object");
  });

  describe("STORAGE_KEYS", () => {
    it("defines expected storage keys", () => {
      assert.ok(constants.STORAGE_KEYS);
      assert.strictEqual(constants.STORAGE_KEYS.FIELDS, "fs_fields");
      assert.strictEqual(constants.STORAGE_KEYS.SETTINGS, "fs_settings");
      assert.strictEqual(constants.STORAGE_KEYS.CATEGORIES, "fs_categories");
    });
  });

  describe("DEFAULT_CATEGORIES", () => {
    it("defines initial categories array with default values", () => {
      assert.ok(Array.isArray(constants.DEFAULT_CATEGORIES));
      assert.deepEqual(constants.DEFAULT_CATEGORIES, ["Personal", "Job Apps"]);
    });
  });

  describe("DEFAULT_SETTINGS", () => {
    it("defines initial settings object with all expected flags and defaults", () => {
      assert.ok(constants.DEFAULT_SETTINGS);
      assert.strictEqual(constants.DEFAULT_SETTINGS.enabled, true);
      assert.strictEqual(constants.DEFAULT_SETTINGS.showInlineButtons, true);
      assert.strictEqual(constants.DEFAULT_SETTINGS.showFloatingBar, false);
      assert.strictEqual(constants.DEFAULT_SETTINGS.theme, "system");
      assert.strictEqual(
        constants.DEFAULT_SETTINGS.highlightFilledFields,
        true,
      );
      assert.strictEqual(constants.DEFAULT_SETTINGS.enableContextMenu, true);
      assert.strictEqual(constants.DEFAULT_SETTINGS.maxCharsToHideTrigger, 3);
    });
  });

  describe("MATCH_TYPE_CONFIG", () => {
    it("defines complete configurations for smart match type", () => {
      const config = constants.MATCH_TYPE_CONFIG.smart;
      assert.ok(config);
      assert.ok(config.desc.includes("Intelligently scans"));
      assert.strictEqual(config.label, "Extra Synonyms & Keywords (Optional)");
      assert.ok(config.placeholder.includes("Type word"));
      assert.ok(config.help.includes("matched automatically"));
      assert.strictEqual(config.isRegex, false);
    });

    it("defines complete configurations for contains match type", () => {
      const config = constants.MATCH_TYPE_CONFIG.contains;
      assert.ok(config);
      assert.ok(config.desc.includes("contains any"));
      assert.strictEqual(config.label, "Words to Look For (Add words below)");
      assert.ok(config.placeholder.includes("Type word"));
      assert.ok(config.help.includes("contains ANY"));
      assert.strictEqual(config.isRegex, false);
    });

    it("defines complete configurations for exact match type", () => {
      const config = constants.MATCH_TYPE_CONFIG.exact;
      assert.ok(config);
      assert.ok(config.desc.includes("matches your keywords exactly"));
      assert.strictEqual(
        config.label,
        "Exact Field Labels (Add exact phrases)",
      );
      assert.ok(config.placeholder.includes("exact phrase"));
      assert.ok(config.help.includes("exact match"));
      assert.strictEqual(config.isRegex, false);
    });

    it("defines complete configurations for regex match type", () => {
      const config = constants.MATCH_TYPE_CONFIG.regex;
      assert.ok(config);
      assert.ok(config.desc.includes("Advanced pattern matching"));
      assert.strictEqual(config.label, "Regular Expression Pattern");
      assert.strictEqual(config.placeholder, "e.g. ^(phone|mobile|tel)$");
      assert.ok(config.help.includes("without enclosing slashes"));
      assert.strictEqual(config.isRegex, true);
    });
  });

  describe("MESSAGE_ACTIONS", () => {
    it("defines all runtime messaging actions", () => {
      assert.ok(constants.MESSAGE_ACTIONS);
      assert.strictEqual(
        constants.MESSAGE_ACTIONS.GET_PAGE_FIELDS,
        "GET_PAGE_FIELDS",
      );
      assert.strictEqual(
        constants.MESSAGE_ACTIONS.FILL_ALL_MATCHES,
        "FILL_ALL_MATCHES",
      );
      assert.strictEqual(
        constants.MESSAGE_ACTIONS.FILL_SPECIFIC_FIELD,
        "FILL_SPECIFIC_FIELD",
      );
      assert.strictEqual(
        constants.MESSAGE_ACTIONS.REFRESH_FIELDS,
        "REFRESH_FIELDS",
      );
    });
  });

  describe("DOM_SELECTORS", () => {
    it("defines INPUT_CONTROLS selector targeting form controls and excluding buttons", () => {
      assert.ok(constants.DOM_SELECTORS);
      assert.ok(constants.DOM_SELECTORS.INPUT_CONTROLS);
      assert.ok(
        constants.DOM_SELECTORS.INPUT_CONTROLS.includes(
          'input:not([type="hidden"])',
        ),
      );
      assert.ok(constants.DOM_SELECTORS.INPUT_CONTROLS.includes("textarea"));
      assert.ok(constants.DOM_SELECTORS.INPUT_CONTROLS.includes("select"));
      assert.ok(
        constants.DOM_SELECTORS.INPUT_CONTROLS.includes(
          '[contenteditable="true"]',
        ),
      );
      assert.ok(
        constants.DOM_SELECTORS.INPUT_CONTROLS.includes('[role="textbox"]'),
      );
    });
  });
});
