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

const FALLBACK_STORAGE_KEYS = {
  FIELDS: "fs_fields",
  SETTINGS: "fs_settings",
  CATEGORIES: "fs_categories",
};

const FALLBACK_CATEGORIES = ["Personal", "Job Apps"];

const FALLBACK_SETTINGS: FormSecretarySettings = {
  enabled: true,
  showInlineButtons: true,
  showFloatingBar: false,
  theme: "system",
  highlightFilledFields: true,
  enableContextMenu: true,
  maxCharsToHideTrigger: 3,
};

export function getStorageKeys() {
  return STORAGE_KEYS || FALLBACK_STORAGE_KEYS;
}

export function getDefaultCategories(): string[] {
  const cats = DEFAULT_CATEGORIES || FALLBACK_CATEGORIES;
  return Array.isArray(cats) ? [...cats] : ["Personal", "Job Apps"];
}

export function getDefaultSettings(): FormSecretarySettings {
  return { ...(DEFAULT_SETTINGS || FALLBACK_SETTINGS) };
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
            (result[key] !== undefined
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
  return fields;
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

  if (field.id) {
    const index = fields.findIndex((f) => f.id === field.id);
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
    id: "field_" + Math.random().toString(36).substr(2, 9) + "_" + now,
    enabled: true,
    category: "Personal",
    matchType: "smart",
    targetProperty: "all",
    createdAt: now,
    ...field,
  };

  fields.unshift(newField);
  await setItem(getStorageKeys().FIELDS, fields);
  return newField;
}

export async function deleteField(fieldId: string): Promise<boolean> {
  const fields = await getFields();
  const filtered = fields.filter((f) => f.id !== fieldId);
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
  const fields = await getFields();
  const field = fields.find((f) => f.id === fieldId);
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
    await setItem(getStorageKeys().FIELDS, imported.fields);
  }
  if (imported.settings && typeof imported.settings === "object") {
    await setItem(getStorageKeys().SETTINGS, imported.settings);
  }

  return {
    categories: await getCategories(),
    fields: await getFields(),
    settings: await getSettings(),
  };
}
