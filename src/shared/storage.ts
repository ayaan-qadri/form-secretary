/**
 * Form Secretary - Unified Storage Manager
 * Promise-based local storage manager with fallback support.
 * Uses FormSecretaryConstants for storage keys, default categories, and settings.
 */

import type {
  FormSecretaryField,
  FormSecretarySettings,
  StorageDataBackup,
} from "../types";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
} from "./constants";

export { STORAGE_KEYS, DEFAULT_CATEGORIES, DEFAULT_SETTINGS };

export function getStorageKeys() {
  return STORAGE_KEYS;
}

export function getDefaultCategories(): string[] {
  return [...DEFAULT_CATEGORIES];
}

export function getDefaultSettings(): FormSecretarySettings {
  return { ...DEFAULT_SETTINGS };
}

function isExtensionStorageAvailable(): boolean {
  return (
    typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.local
  );
}

const memoryStore: Record<string, any> = {};

export async function getItem<T = any>(
  key: string,
  defaultValue: T | null = null,
): Promise<T | null> {
  if (isExtensionStorageAvailable()) {
    return new Promise<T | null>((resolve) => {
      chrome.storage.local.get([key], (result: any) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[Storage] Error reading key:",
            key,
            chrome.runtime.lastError,
          );
          resolve(defaultValue);
        } else {
          resolve(
            (result && result[key] !== undefined
              ? result[key]
              : defaultValue) as T | null,
          );
        }
      });
    });
  }
  return Promise.resolve(
    memoryStore[key] !== undefined ? memoryStore[key] : defaultValue,
  );
}

export async function setItem(key: string, value: any): Promise<boolean> {
  if (isExtensionStorageAvailable()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[Storage] Error saving key:",
            key,
            chrome.runtime.lastError,
          );
        }
        resolve(true);
      });
    });
  }
  memoryStore[key] = value;
  return Promise.resolve(true);
}

// ==========================================
// Category Management API
// ==========================================

export async function getCategories(): Promise<string[]> {
  const defaultCats = getDefaultCategories();
  const categories = await getItem<string[]>(getStorageKeys().CATEGORIES, null);
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    await setItem(getStorageKeys().CATEGORIES, defaultCats);
    return defaultCats;
  }
  return categories;
}

export async function saveCategories(categories: string[]): Promise<string[]> {
  const defaultCats = getDefaultCategories();
  const cleaned = Array.from(
    new Set(categories.map((c) => c.trim()).filter(Boolean)),
  );
  await setItem(
    getStorageKeys().CATEGORIES,
    cleaned.length > 0 ? cleaned : defaultCats,
  );
  return cleaned;
}

export async function addCategory(categoryName: string): Promise<string[]> {
  const trimmed = (categoryName || "").trim();
  if (!trimmed) return await getCategories();

  const categories = await getCategories();
  if (!categories.includes(trimmed)) {
    categories.push(trimmed);
    await saveCategories(categories);
  }
  return categories;
}

export async function deleteCategory(categoryName: string): Promise<string[]> {
  let categories = await getCategories();
  categories = categories.filter((c) => c !== categoryName);
  if (categories.length === 0) categories = ["Personal"];
  await saveCategories(categories);

  // Reassign affected fields to first remaining category
  const fallbackCat = categories[0] || "Personal";
  const fields = await getFields();
  let fieldsUpdated = false;

  fields.forEach((field) => {
    if (field.category === categoryName) {
      field.category = fallbackCat;
      fieldsUpdated = true;
    }
  });

  if (fieldsUpdated) {
    await setItem(getStorageKeys().FIELDS, fields);
  }

  return categories;
}

export function generateFieldId(): string {
  return "field_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
}

// ==========================================
// Fields Management API
// ==========================================

export async function getFields(): Promise<FormSecretaryField[]> {
  const keys = getStorageKeys();
  const fields = await getItem<FormSecretaryField[]>(keys.FIELDS, null);

  if (fields === null || !Array.isArray(fields)) {
    await setItem(keys.FIELDS, []);
    return [];
  }

  // Self-healing migration: Ensure every field has a unique, valid non-empty string ID
  let needsMigration = false;
  const seenIds = new Set<string>();
  const healedFields: FormSecretaryField[] = fields.map((f, idx) => {
    if (!f || typeof f !== "object") return f;
    const hasValidId = typeof f.id === "string" && f.id.trim().length > 0;
    if (!hasValidId || seenIds.has(f.id.trim())) {
      needsMigration = true;
      const newId =
        "field_" +
        Math.random().toString(36).substring(2, 11) +
        "_" +
        (Date.now() + idx);
      seenIds.add(newId);
      return {
        ...f,
        id: newId,
        enabled: f.enabled !== false,
        category: f.category || "Personal",
        matchType: f.matchType || "smart",
        targetProperty: f.targetProperty || "all",
      };
    }
    const cleanId = f.id.trim();
    seenIds.add(cleanId);
    return {
      ...f,
      id: cleanId,
    };
  });

  if (needsMigration) {
    await setItem(keys.FIELDS, healedFields);
  }

  return healedFields;
}

export async function saveField(
  field: Partial<FormSecretaryField> & { label: string; value: string },
): Promise<FormSecretaryField> {
  if (!field || !field.label || !field.value) {
    throw new Error("Field must have at least a label and value");
  }

  const fields = await getFields();
  const now = Date.now();

  if (field.category) {
    await addCategory(field.category);
  }

  const rawId = typeof field.id === "string" ? field.id.trim() : "";

  if (rawId) {
    const index = fields.findIndex((f) => f.id === rawId);
    if (index !== -1) {
      const existing = fields[index]!;
      const updated: FormSecretaryField = {
        ...existing,
        ...field,
        id: existing.id,
        updatedAt: now,
      };
      fields[index] = updated;
      await setItem(getStorageKeys().FIELDS, fields);
      return updated;
    }
  }

  const newField: FormSecretaryField = {
    enabled: true,
    category: "Personal",
    matchType: "smart",
    targetProperty: "all",
    createdAt: now,
    ...field,
    id: rawId || generateFieldId(),
  };

  fields.unshift(newField);
  await setItem(getStorageKeys().FIELDS, fields);
  return newField;
}

export async function deleteField(fieldId: string): Promise<boolean> {
  if (!fieldId || typeof fieldId !== "string" || !fieldId.trim()) {
    console.warn(
      "[Storage] Invalid fieldId provided to deleteField:",
      fieldId,
    );
    return false;
  }
  const cleanId = fieldId.trim();
  const fields = await getFields();
  const initialCount = fields.length;
  const filtered = fields.filter((f) => f.id !== cleanId);
  if (filtered.length === initialCount) {
    return false;
  }
  await setItem(getStorageKeys().FIELDS, filtered);
  return true;
}

export async function deleteAllFields(): Promise<boolean> {
  await setItem(getStorageKeys().FIELDS, []);
  return true;
}

export async function toggleField(
  fieldId: string,
  enabled?: boolean,
): Promise<FormSecretaryField | null> {
  if (!fieldId || typeof fieldId !== "string" || !fieldId.trim()) {
    return null;
  }
  const cleanId = fieldId.trim();
  const fields = await getFields();
  const field = fields.find((f) => f.id === cleanId);
  if (field) {
    field.enabled = enabled !== undefined ? enabled : !field.enabled;
    field.updatedAt = Date.now();
    await setItem(getStorageKeys().FIELDS, fields);
    return field;
  }
  return null;
}

// ==========================================
// Settings API
// ==========================================

export async function getSettings(): Promise<FormSecretarySettings> {
  const defaultSettings = getDefaultSettings();
  const settings = await getItem<Partial<FormSecretarySettings>>(
    getStorageKeys().SETTINGS,
    defaultSettings,
  );
  return { ...defaultSettings, ...settings };
}

export async function saveSettings(
  newSettings: Partial<FormSecretarySettings>,
): Promise<FormSecretarySettings> {
  const current = await getSettings();
  const merged = { ...current, ...newSettings };
  await setItem(getStorageKeys().SETTINGS, merged);
  return merged;
}

export async function resetToDefaults(): Promise<{
  fields: FormSecretaryField[];
  settings: FormSecretarySettings;
  categories: string[];
}> {
  const defaultSettings = getDefaultSettings();
  const defaultCats = getDefaultCategories();
  const keys = getStorageKeys();

  await setItem(keys.FIELDS, []);
  await setItem(keys.SETTINGS, defaultSettings);
  await setItem(keys.CATEGORIES, defaultCats);

  return {
    fields: [],
    settings: defaultSettings,
    categories: defaultCats,
  };
}

export async function exportData(): Promise<StorageDataBackup> {
  const fields = await getFields();
  const settings = await getSettings();
  const categories = await getCategories();
  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    categories,
    fields,
    settings,
  };
}

export async function importData(imported: any): Promise<{
  categories: string[];
  fields: FormSecretaryField[];
  settings: FormSecretarySettings;
}> {
  if (!imported || typeof imported !== "object") {
    throw new Error("Invalid backup file");
  }

  if (Array.isArray(imported.categories)) {
    await saveCategories(imported.categories);
  }
  if (Array.isArray(imported.fields)) {
    const validMatchTypes = new Set(["smart", "contains", "exact", "regex"]);
    const validTargetProps = new Set([
      "all",
      "label",
      "name",
      "id",
      "placeholder",
      "aria",
    ]);
    const seenIds = new Set<string>();
    const sanitizedFields: FormSecretaryField[] = imported.fields
      .filter((f: any) => f && typeof f === "object" && f.label && f.value)
      .map((f: any, idx: number) => {
        let id = typeof f.id === "string" && f.id.trim() ? f.id.trim() : "";
        if (!id || seenIds.has(id)) {
          id =
            "field_" +
            Math.random().toString(36).substring(2, 11) +
            "_" +
            (Date.now() + idx);
        }
        seenIds.add(id);

        const matchType = validMatchTypes.has(f.matchType)
          ? f.matchType
          : "smart";
        const targetProperty = validTargetProps.has(f.targetProperty)
          ? f.targetProperty
          : "all";

        return {
          id,
          label: String(f.label).trim(),
          value: String(f.value),
          pattern:
            typeof f.pattern === "string"
              ? f.pattern
              : String(f.label).trim(),
          category:
            typeof f.category === "string" && f.category.trim()
              ? f.category.trim()
              : "Personal",
          matchType,
          targetProperty,
          enabled: f.enabled !== false,
          createdAt:
            typeof f.createdAt === "number" && !isNaN(f.createdAt)
              ? f.createdAt
              : Date.now(),
          ...(typeof f.updatedAt === "number" && !isNaN(f.updatedAt)
            ? { updatedAt: f.updatedAt }
            : {}),
        };
      });
    await setItem(getStorageKeys().FIELDS, sanitizedFields);
  }
  if (imported.settings && typeof imported.settings === "object") {
    const def = getDefaultSettings();
    const s = imported.settings;
    const sanitizedSettings: FormSecretarySettings = {
      enabled: typeof s.enabled === "boolean" ? s.enabled : def.enabled,
      showInlineButtons:
        typeof s.showInlineButtons === "boolean"
          ? s.showInlineButtons
          : def.showInlineButtons,
      showFloatingBar:
        typeof s.showFloatingBar === "boolean"
          ? s.showFloatingBar
          : def.showFloatingBar,
      theme:
        s.theme === "dark" || s.theme === "light" || s.theme === "system"
          ? s.theme
          : def.theme,
      highlightFilledFields:
        typeof s.highlightFilledFields === "boolean"
          ? s.highlightFilledFields
          : def.highlightFilledFields,
      enableContextMenu:
        typeof s.enableContextMenu === "boolean"
          ? s.enableContextMenu
          : def.enableContextMenu,
      maxCharsToHideTrigger:
        typeof s.maxCharsToHideTrigger === "number" &&
        s.maxCharsToHideTrigger > 0
          ? s.maxCharsToHideTrigger
          : def.maxCharsToHideTrigger,
    };
    await setItem(getStorageKeys().SETTINGS, sanitizedSettings);
  }

  return {
    categories: await getCategories(),
    fields: await getFields(),
    settings: await getSettings(),
  };
}
