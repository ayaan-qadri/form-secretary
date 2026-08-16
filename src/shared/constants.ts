/**
 * Form Secretary - Shared Constants & Configurations
 * Central repository for storage keys, category presets, matching configurations, and action types.
 */

import type { FormSecretarySettings, MatchTypeConfig } from "../types";

export const STORAGE_KEYS = {
  FIELDS: "fs_fields",
  SETTINGS: "fs_settings",
  CATEGORIES: "fs_categories",
} as const;

export const DEFAULT_CATEGORIES: string[] = ["Personal", "Job Apps"];

export const DEFAULT_SETTINGS: FormSecretarySettings = {
  enabled: true,
  showInlineButtons: true,
  showFloatingBar: false,
  theme: "system",
  highlightFilledFields: true,
  enableContextMenu: true,
  maxCharsToHideTrigger: 3,
};

export const MATCH_TYPE_CONFIG: MatchTypeConfig = {
  smart: {
    desc: "Intelligently scans form labels, placeholders, input names, and common synonyms to find the best match.",
    label: "Extra Synonyms & Keywords (Optional)",
    placeholder: "Type word and press Enter or comma...",
    help: "Field Name is matched automatically. Add extra words or phrases forms might use.",
    isRegex: false,
  },
  contains: {
    desc: "Triggers whenever the form field label or name contains any of the added words.",
    label: "Words to Look For (Add words below)",
    placeholder: "Type word and press Enter or comma...",
    help: "Form will match if it contains ANY of these added words.",
    isRegex: false,
  },
  exact: {
    desc: "Triggers ONLY if the form field name or label matches your keywords exactly.",
    label: "Exact Field Labels (Add exact phrases)",
    placeholder: "Type exact phrase and press Enter or comma...",
    help: "Form will match ONLY if its label or name is an exact match.",
    isRegex: false,
  },
  regex: {
    desc: "Advanced pattern matching using custom regular expressions (e.g. ^phone|tel).",
    label: "Regular Expression Pattern",
    placeholder: "e.g. ^(phone|mobile|tel)$",
    help: "Standard JavaScript regular expression without enclosing slashes.",
    isRegex: true,
  },
};

export const MESSAGE_ACTIONS = {
  GET_PAGE_FIELDS: "GET_PAGE_FIELDS",
  FILL_ALL_MATCHES: "FILL_ALL_MATCHES",
  FILL_SPECIFIC_FIELD: "FILL_SPECIFIC_FIELD",
  REFRESH_FIELDS: "REFRESH_FIELDS",
} as const;

export const DOM_SELECTORS = {
  INPUT_CONTROLS:
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="file"]):not([type="color"]):not([type="range"]):not([hidden]):not([aria-hidden="true"]), textarea:not([hidden]):not([aria-hidden="true"]), select:not([hidden]):not([aria-hidden="true"]), [contenteditable="true"]:not([hidden]):not([aria-hidden="true"]), [contenteditable=""]:not([hidden]):not([aria-hidden="true"]), [role="textbox"]:not([hidden]):not([aria-hidden="true"]), [role="combobox"]:not([hidden]):not([aria-hidden="true"]), [role="radio"]:not([hidden]):not([aria-hidden="true"]), [role="checkbox"]:not([hidden]):not([aria-hidden="true"])',
} as const;


