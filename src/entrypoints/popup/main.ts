/**
 * Form Secretary - Popup Controller (TypeScript)
 * Manages fields CRUD, tab navigation, page scanner, categories, and settings.
 */

import type {
  DetectedPageField,
  ExtensionMessageRequest,
  ExtensionMessageResponse,
  FormSecretaryField,
  FormSecretarySettings,
} from "../../types";
import {
  addCategory,
  deleteAllFields,
  deleteCategory,
  deleteField,
  exportData,
  getCategories,
  getFields,
  getSettings,
  importData,
  saveField,
  saveSettings,
  toggleField,
} from "../../shared/storage";
import {
  copyToClipboard,
  debounce,
  escapeHtml,
  exportJsonFile,
  readJsonFile,
  showToast as utilsShowToast,
  truncateText,
} from "../../shared/utils";

import { FieldModal } from "../../shared/field-modal";
import {
  cleanFieldIdentifier,
  extractSuggestedKeywords,
} from "../../shared/matcher";
import { createIconElement, getIconSvg, initIcons } from "../../shared/icons";
import {
  ConflictModalController,
  type ConflictFieldItem,
} from "./conflict-modal";
import { renderRestrictedPageState } from "./restricted-views";
import {
  getActiveBrowserTab,
  notifyActiveTab,
  dispatchMessageToTab,
} from "./tab-messenger";

document.addEventListener("DOMContentLoaded", async () => {
  let allFields: FormSecretaryField[] = [];
  let allCategories: string[] = ["Personal", "Job Apps"];
  let currentSettings: FormSecretarySettings = {
    enabled: true,
    showInlineButtons: true,
    showFloatingBar: false,
    theme: "system",
    highlightFilledFields: true,
    enableContextMenu: true,
    maxCharsToHideTrigger: 3,
  };
  let currentCategory = "all";
  let searchQuery = "";
  let activeTabFields: DetectedPageField[] = [];

  // DOM Elements
  const popupToast = document.getElementById("popup-toast");
  const btnHeaderSettings = document.getElementById("btn-header-settings");
  const globalToggle = document.getElementById(
    "global-toggle",
  ) as HTMLInputElement;
  const tabButtons = document.querySelectorAll(".fs-tab-btn");
  const tabContents = document.querySelectorAll(".fs-tab-content");
  const fieldsContainer = document.getElementById(
    "rules-container",
  ) as HTMLElement;
  const searchInput = document.getElementById(
    "rule-search-input",
  ) as HTMLInputElement;
  const categoryChips = document.getElementById(
    "category-chips",
  ) as HTMLElement;
  const btnOpenAddModal = document.getElementById(
    "btn-open-add-modal",
  ) as HTMLElement;

  const btnPopupBulkClear = document.getElementById(
    "btn-popup-bulk-clear",
  ) as HTMLElement | null;

  // Scanner Tab Elements
  const pageFieldsContainer = document.getElementById(
    "page-fields-container",
  ) as HTMLElement;
  const pageFieldsCount = document.getElementById(
    "page-fields-count",
  ) as HTMLElement;
  const scannerBadge = document.getElementById("scanner-badge") as HTMLElement;
  const scannerActionsBar = document.getElementById(
    "scanner-actions-bar",
  ) as HTMLElement;
  const scannerFilterBar = document.getElementById(
    "scanner-filter-bar",
  ) as HTMLElement;
  const scannerFilterChips = document.getElementById(
    "scanner-filter-chips",
  ) as HTMLElement;
  const btnRefreshScanner = document.getElementById(
    "btn-refresh-scanner",
  ) as HTMLElement;
  const btnFillAllPage = document.getElementById(
    "btn-fill-all-page",
  ) as HTMLElement;
  const btnSaveAllFields = document.getElementById(
    "btn-save-all-fields",
  ) as HTMLElement;
  let scannerFilter: "all" | "saved" | "filled" | "empty" = "all";

  // Settings Tab Elements
  const newCategoryInput = document.getElementById(
    "new-category-input",
  ) as HTMLInputElement;
  const btnAddCategory = document.getElementById(
    "btn-add-category",
  ) as HTMLElement;
  const categoryManageList = document.getElementById(
    "category-manage-list",
  ) as HTMLElement;
  const settingInlineBtn = document.getElementById(
    "setting-inline-btn",
  ) as HTMLInputElement;
  const settingHighlight = document.getElementById(
    "setting-highlight",
  ) as HTMLInputElement;
  const settingFloatingBar = document.getElementById(
    "setting-floating-bar",
  ) as HTMLInputElement;
  const settingMaxChars = document.getElementById(
    "setting-max-chars",
  ) as HTMLInputElement;
  const btnExportData = document.getElementById(
    "btn-export-data",
  ) as HTMLElement;
  const importFileInput = document.getElementById(
    "import-file-input",
  ) as HTMLInputElement;
  const btnDeleteAllFields = document.getElementById(
    "btn-delete-all-rules",
  ) as HTMLElement;

  function showToast(msg: string): void {
    utilsShowToast(popupToast, msg);
  }

  // Initialize Field Modal
  const modal = new FieldModal(
    {
      modal: document.getElementById("rule-modal"),
      title: document.getElementById("modal-title"),
      form: document.getElementById("rule-form") as HTMLFormElement,
      formId: document.getElementById("form-rule-id") as HTMLInputElement,
      formLabel: document.getElementById("form-rule-label") as HTMLInputElement,
      formValue: document.getElementById(
        "form-rule-value",
      ) as HTMLTextAreaElement,
      formPattern: document.getElementById(
        "form-rule-pattern",
      ) as HTMLInputElement,
      formCategory: document.getElementById(
        "form-rule-category",
      ) as HTMLSelectElement,
      formMatchType: document.getElementById(
        "form-rule-match-type",
      ) as HTMLSelectElement,
      matchDesc: document.getElementById("form-match-type-desc"),
      patternLabel: document.getElementById("form-pattern-label"),
      patternHelp: document.getElementById("form-pattern-help"),
      tagContainer: document.getElementById("form-tag-container"),
      tagsList: document.getElementById("form-tags-list"),
      tagTextInput: document.getElementById(
        "form-tag-text-input",
      ) as HTMLInputElement,
      regexInput: document.getElementById(
        "form-regex-input",
      ) as HTMLInputElement,
      btnSave: document.getElementById("btn-modal-save"),
      btnClose: document.getElementById("btn-modal-close"),
      btnCancel: document.getElementById("btn-modal-cancel"),
    },
    {
      onSave: async (fieldData) => {
        await saveField(fieldData as any);
        await loadData();
        notifyActiveTab({ action: "REFRESH_FIELDS" });
        showToast(fieldData.id ? "Field updated" : "New field saved");
      },
    },
  );

  // Initialize
  initIcons();
  await loadData();
  setupEventListeners();
  scanActiveTab();

  async function loadData(): Promise<void> {
    allFields = (await getFields()) || [];
    allCategories = await getCategories();
    currentSettings = await getSettings();

    if (globalToggle) globalToggle.checked = currentSettings.enabled !== false;
    if (settingInlineBtn)
      settingInlineBtn.checked = currentSettings.showInlineButtons !== false;
    if (settingHighlight)
      settingHighlight.checked =
        currentSettings.highlightFilledFields !== false;
    if (settingFloatingBar)
      settingFloatingBar.checked = currentSettings.showFloatingBar === true;
    if (settingMaxChars) {
      settingMaxChars.value = String(
        currentSettings.maxCharsToHideTrigger !== undefined
          ? currentSettings.maxCharsToHideTrigger
          : 3,
      );
    }

    renderCategoryChips();
    renderCategoryManager();
    renderFields();
  }

  function switchToTab(tabName: string): void {
    if (btnHeaderSettings) btnHeaderSettings.classList.remove("active");
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    if (tabName === "settings") {
      if (btnHeaderSettings) btnHeaderSettings.classList.add("active");
      document.getElementById("tab-settings")?.classList.add("active");
    } else {
      const btn = document.querySelector(`.fs-tab-btn[data-tab="${tabName}"]`);
      if (btn) btn.classList.add("active");
      const targetContent = document.getElementById(`tab-${tabName}`);
      if (targetContent) targetContent.classList.add("active");
    }
  }

  function setupEventListeners(): void {
    // Header Settings Icon Button
    if (btnHeaderSettings) {
      btnHeaderSettings.addEventListener("click", () => {
        const settingsTab = document.getElementById("tab-settings");
        const isSettingsActive = settingsTab?.classList.contains("active");
        if (isSettingsActive) {
          switchToTab("rules");
        } else {
          switchToTab("settings");
        }
      });
    }

    // Navigation Tabs
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabName = (btn as HTMLElement).dataset.tab;
        if (tabName) switchToTab(tabName);
      });
    });

    // Global Enabled Toggle
    if (globalToggle) {
      globalToggle.addEventListener("change", async () => {
        currentSettings.enabled = globalToggle.checked;
        await saveSettings(currentSettings);
        notifyActiveTab({ action: "REFRESH_FIELDS" });
        showToast(
          globalToggle.checked ? "Extension Enabled" : "Extension Disabled",
        );
      });
    }

    // Search Input with Debouncing
    const debouncedRenderFields = debounce(() => {
      renderFields();
    }, 300);

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = ((e.target as HTMLInputElement).value || "")
          .toLowerCase()
          .trim();
        debouncedRenderFields();
      });

      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && (searchInput.value || searchQuery)) {
          searchInput.value = "";
          searchQuery = "";
          debouncedRenderFields.cancel();
          renderFields();
        }
      });
    }

    // Category Filter Chips
    if (categoryChips) {
      categoryChips.addEventListener("click", (e) => {
        const chip = (e.target as HTMLElement).closest(
          ".fs-chip",
        ) as HTMLElement;
        if (!chip) return;
        currentCategory = chip.dataset.category || "all";
        renderCategoryChips();
        debouncedRenderFields.cancel();
        renderFields();
      });
    }

    // Add New Category
    if (btnAddCategory && newCategoryInput) {
      const handleAddCat = async () => {
        const name = newCategoryInput.value.trim();
        if (!name) return;
        allCategories = await addCategory(name);
        newCategoryInput.value = "";
        await loadData();
        showToast(`Category "${name}" created`);
      };

      btnAddCategory.addEventListener("click", handleAddCat);
      newCategoryInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddCat();
        }
      });
    }

    // Modal Add Button
    if (btnOpenAddModal) {
      btnOpenAddModal.addEventListener("click", () => {
        const defaultCat =
          currentCategory !== "all"
            ? currentCategory
            : allCategories[0] || "General";
        modal.open(null, allCategories, defaultCat);
      });
    }

    // Scanner actions
    if (btnRefreshScanner) {
      btnRefreshScanner.addEventListener("click", () => {
        scanActiveTab();
      });
    }

    if (scannerFilterChips) {
      scannerFilterChips.addEventListener("click", (e) => {
        const chip = (e.target as HTMLElement).closest(".fs-chip") as HTMLElement;
        if (!chip || !chip.dataset.filter) return;
        scannerFilter = chip.dataset.filter as
          | "all"
          | "saved"
          | "filled"
          | "empty";
        renderScannerFilterChips();
        renderPageFields(activeTabFields);
      });
    }

    if (btnFillAllPage) {
      btnFillAllPage.addEventListener("click", () => {
        const matchedCount = activeTabFields.filter(
          (f) => f.matchesCount > 0,
        ).length;
        if (matchedCount === 0) {
          showToast("No matched fields found to autofill");
          return;
        }

        notifyActiveTab({ action: "FILL_ALL_MATCHES" }, (res) => {
          const count = res && res.count !== undefined ? res.count : 0;
          showToast(`Filled ${count} field${count === 1 ? "" : "s"}!`);
          setTimeout(scanActiveTab, 300);
        });
      });
    }

    const conflictModalCtrl = new ConflictModalController({
      modal: document.getElementById("conflict-modal"),
      list: document.getElementById("conflict-fields-list"),
      subtitle: document.getElementById("conflict-modal-subtitle"),
      btnClose: document.getElementById("btn-conflict-modal-close"),
      btnCancel: document.getElementById("btn-conflict-modal-cancel"),
      btnApply: document.getElementById("btn-conflict-modal-apply"),
      btnOverrideAll: document.getElementById("btn-conflict-override-all"),
      btnKeepAll: document.getElementById("btn-conflict-keep-all"),
    });

    // Save All Detected Fields with Default Options & Conflict Resolution
    if (btnSaveAllFields) {
      btnSaveAllFields.addEventListener("click", async () => {
        if (!activeTabFields || activeTabFields.length === 0) {
          showToast("No fields detected on page");
          return;
        }

        const defaultCategory = allCategories[0] || "General";
        const fieldsToProcess: {
          field: DetectedPageField;
          val: string;
          displayName: string;
          pattern: string;
          existing: FormSecretaryField | undefined;
        }[] = [];

        for (const field of activeTabFields) {
          const inputEl = pageFieldsContainer?.querySelector(
            `.fs-field-direct-input[data-index="${field.index}"]`,
          ) as HTMLInputElement | null;
          const val = (
            inputEl
              ? inputEl.value
              : field.currentValue || field.topMatch?.value || ""
          ).trim();

          if (!val) continue;

          const cleanName = cleanFieldIdentifier(field.name || "");
          const rawDisplayName =
            field.label ||
            field.placeholder ||
            cleanName ||
            field.name ||
            field.id ||
            `Input #${field.index + 1}`;
          const displayName =
            rawDisplayName.replace(/\s*[*:]+$/, "").trim() || rawDisplayName;
          const pattern =
            extractSuggestedKeywords(field, displayName) || displayName;

          const existing =
            (field.topMatch?.fieldId
              ? allFields.find((f) => f.id === field.topMatch?.fieldId)
              : null) ||
            allFields.find(
              (f) => f.label.toLowerCase() === displayName.toLowerCase(),
            );

          fieldsToProcess.push({
            field,
            val,
            displayName,
            pattern,
            existing,
          });
        }

        if (fieldsToProcess.length === 0) {
          showToast("Please enter values in the fields to save");
          return;
        }

        const nonConflicting: {
          id?: string;
          label: string;
          value: string;
          category: string;
          pattern: string;
          matchType?: any;
          targetProperty?: any;
          enabled?: boolean;
        }[] = [];

        const conflicts: ConflictFieldItem[] = [];

        for (const item of fieldsToProcess) {
          const { val, displayName, pattern, existing } = item;

          if (!existing) {
            const prev = nonConflicting.find(
              (nc) => nc.label.toLowerCase() === displayName.toLowerCase(),
            );
            if (prev) {
              prev.value = val;
              prev.pattern = prev.pattern || pattern;
            } else {
              nonConflicting.push({
                label: displayName,
                value: val,
                category: defaultCategory,
                pattern,
                matchType: "smart",
                targetProperty: "all",
                enabled: true,
              });
            }
          } else {
            if (existing.value.trim() === val) {
              nonConflicting.push({
                id: existing.id,
                label: existing.label,
                value: val,
                category: existing.category || defaultCategory,
                pattern: existing.pattern || pattern,
              });
            } else {
              const alreadyConflict = conflicts.find(
                (c) => c.id === existing.id,
              );
              if (alreadyConflict) {
                alreadyConflict.newValue = val;
                alreadyConflict.currentValue = val;
              } else {
                conflicts.push({
                  id: existing.id,
                  label: existing.label,
                  category: existing.category || defaultCategory,
                  pattern: existing.pattern || pattern,
                  savedValue: existing.value,
                  newValue: val,
                  currentValue: val,
                  action: "override",
                });
              }
            }
          }
        }

        // Save non-conflicting fields
        let savedCount = 0;
        for (const nc of nonConflicting) {
          const savedItem = await saveField(nc as any);
          if (nc.id) {
            const idx = allFields.findIndex((f) => f.id === nc.id);
            if (idx !== -1) allFields[idx] = savedItem;
            else allFields.push(savedItem);
          } else {
            allFields.push(savedItem);
          }
          savedCount++;
        }

        const handleSuccessState = async (totalCount: number) => {
          await loadData();
          notifyActiveTab({ action: "REFRESH_FIELDS" });

          btnSaveAllFields.classList.add("fs-fill-success");
          const checkIcon = createIconElement("check", {
            size: 12,
            strokeWidth: 2.5,
          });
          const spanText = document.createElement("span");
          spanText.textContent = `Saved ${totalCount} Field${totalCount === 1 ? "" : "s"}!`;
          btnSaveAllFields.replaceChildren(
            checkIcon || document.createTextNode(""),
            spanText,
          );

          setTimeout(() => {
            btnSaveAllFields.classList.remove("fs-fill-success");
            const plusIcon = createIconElement("plus", {
              size: 13,
              strokeWidth: 2.5,
            });
            const defaultSpan = document.createElement("span");
            defaultSpan.textContent = "Save All Fields";
            btnSaveAllFields.replaceChildren(
              plusIcon || document.createTextNode(""),
              defaultSpan,
            );
          }, 1500);

          showToast(
            `Saved ${totalCount} field${totalCount === 1 ? "" : "s"} to My Fields!`,
          );
          setTimeout(scanActiveTab, 400);
        };

        if (conflicts.length === 0) {
          await handleSuccessState(savedCount);
        } else {
          conflictModalCtrl.open(conflicts, async (resolved) => {
            let conflictSavedCount = 0;
            for (const item of resolved) {
              if (item.action === "override") {
                const finalVal = item.currentValue.trim() || item.savedValue;
                const savedItem = await saveField({
                  id: item.id,
                  label: item.label,
                  value: finalVal,
                  category: item.category,
                  pattern: item.pattern,
                });
                const idx = allFields.findIndex((f) => f.id === item.id);
                if (idx !== -1) allFields[idx] = savedItem;
                else allFields.push(savedItem);
                conflictSavedCount++;
              }
            }
            await handleSuccessState(savedCount + conflictSavedCount);
          });
        }
      });
    }

    // Settings toggles
    if (settingInlineBtn) {
      settingInlineBtn.addEventListener("change", async () => {
        currentSettings.showInlineButtons = settingInlineBtn.checked;
        await saveSettings(currentSettings);
        notifyActiveTab({ action: "REFRESH_FIELDS" });
      });
    }

    if (settingHighlight) {
      settingHighlight.addEventListener("change", async () => {
        currentSettings.highlightFilledFields = settingHighlight.checked;
        await saveSettings(currentSettings);
        notifyActiveTab({ action: "REFRESH_FIELDS" });
      });
    }

    if (settingFloatingBar) {
      settingFloatingBar.addEventListener("change", async () => {
        currentSettings.showFloatingBar = settingFloatingBar.checked;
        await saveSettings(currentSettings);
        notifyActiveTab({ action: "REFRESH_FIELDS" });
      });
    }

    if (settingMaxChars) {
      settingMaxChars.addEventListener("change", async () => {
        const val = parseInt(settingMaxChars.value, 10);
        currentSettings.maxCharsToHideTrigger = isNaN(val) || val < 1 ? 3 : val;
        settingMaxChars.value = String(currentSettings.maxCharsToHideTrigger);
        await saveSettings(currentSettings);
        notifyActiveTab({ action: "REFRESH_FIELDS" });
        showToast(
          `Hide limit set to ${currentSettings.maxCharsToHideTrigger} chars`,
        );
      });
    }

    // Export JSON
    if (btnExportData) {
      btnExportData.addEventListener("click", async () => {
        const data = await exportData();
        exportJsonFile(
          `form-secretary-fields-${new Date().toISOString().slice(0, 10)}.json`,
          data,
        );
        showToast("Fields exported");
      });
    }

    // Import JSON
    if (importFileInput) {
      importFileInput.addEventListener("change", async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          const parsed = await readJsonFile(file);
          await importData(parsed);
          await loadData();
          notifyActiveTab({ action: "REFRESH_FIELDS" });
          showToast("Fields imported successfully");
        } catch (err: any) {
          alert(err.message);
        } finally {
          importFileInput.value = "";
        }
      });
    }

    // Delete All Fields
    if (btnDeleteAllFields) {
      btnDeleteAllFields.addEventListener("click", async () => {
        if (
          confirm(
            "Are you sure you want to delete ALL saved fields? This will remove all your saved field values.",
          )
        ) {
          await deleteAllFields();
          await loadData();
          notifyActiveTab({ action: "REFRESH_FIELDS" });
          showToast("All fields deleted");
        }
      });
    }
  }

  function renderCategoryChips(): void {
    if (!categoryChips) return;
    categoryChips.replaceChildren();

    const allChip = document.createElement("button");
    allChip.className = `fs-chip ${currentCategory === "all" ? "active" : ""}`;
    allChip.dataset.category = "all";
    allChip.appendChild(document.createTextNode("All ("));
    const countSpan = document.createElement("span");
    countSpan.id = "count-all";
    countSpan.textContent = String(allFields.length);
    allChip.appendChild(countSpan);
    allChip.appendChild(document.createTextNode(")"));
    categoryChips.appendChild(allChip);

    allCategories.forEach((cat) => {
      const count = allFields.filter(
        (r) => (r.category || "Personal") === cat,
      ).length;
      const chip = document.createElement("button");
      chip.className = `fs-chip ${currentCategory === cat ? "active" : ""}`;
      chip.dataset.category = cat;
      chip.textContent = `${cat} (${count})`;
      categoryChips.appendChild(chip);
    });
  }

  function renderCategoryManager(): void {
    if (!categoryManageList) return;
    categoryManageList.replaceChildren();

    allCategories.forEach((cat) => {
      const count = allFields.filter(
        (r) => (r.category || allCategories[0] || "General") === cat,
      ).length;

      const item = document.createElement("div");
      item.className =
        "fs-category-manage-item flex items-center justify-between p-2 bg-slate-50 border border-slate-200/80 rounded-lg";

      const leftDiv = document.createElement("div");
      leftDiv.className = "flex items-center gap-2";

      const catName = document.createElement("span");
      catName.className = "text-xs font-semibold text-slate-800";
      catName.textContent = cat;

      const catBadge = document.createElement("span");
      catBadge.className =
        "text-[10px] font-medium text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded-full";
      catBadge.textContent = `${count} field${count === 1 ? "" : "s"}`;

      leftDiv.appendChild(catName);
      leftDiv.appendChild(catBadge);

      const btnDelete = document.createElement("button");
      btnDelete.className =
        "btn-delete-cat text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-all cursor-pointer border-none bg-transparent";
      btnDelete.dataset.name = cat;
      btnDelete.title = "Delete category";
      const trashIcon = createIconElement("trash", {
        size: 13,
        class: "w-3.5 h-3.5",
      });
      if (trashIcon) btnDelete.appendChild(trashIcon);

      item.appendChild(leftDiv);
      item.appendChild(btnDelete);

      btnDelete.addEventListener("click", async (e) => {
        const catToDelete = (e.currentTarget as HTMLElement).dataset.name;
        if (!catToDelete) return;
        if (allCategories.length <= 1) {
          showToast("Cannot delete the only remaining category");
          return;
        }
        const targetCat =
          allCategories.find((c) => c !== catToDelete) || "General";
        if (
          confirm(
            `Delete category "${catToDelete}"? Fields in this category will be moved to "${targetCat}".`,
          )
        ) {
          allCategories = await deleteCategory(catToDelete);
          allFields = (await getFields()) || [];
          if (currentCategory === catToDelete) currentCategory = "all";
          await loadData();
          showToast(`Category "${catToDelete}" deleted`);
        }
      });

      categoryManageList.appendChild(item);
    });
  }

  function getPopupFilteredFields(): FormSecretaryField[] {
    let filtered = allFields;
    if (currentCategory !== "all") {
      filtered = filtered.filter(
        (r) => (r.category || "Personal") === currentCategory,
      );
    }

    if (searchQuery) {
      filtered = filtered.filter((r) => {
        const label = (r.label || "").toLowerCase();
        const val = (r.value || "").toLowerCase();
        const pat = (r.pattern || "").toLowerCase();
        const cat = (r.category || "").toLowerCase();
        return (
          label.includes(searchQuery) ||
          val.includes(searchQuery) ||
          pat.includes(searchQuery) ||
          cat.includes(searchQuery)
        );
      });
    }
    return filtered;
  }

  function renderFields(): void {
    const countAllEl = document.getElementById("count-all");
    if (countAllEl) countAllEl.textContent = String(allFields.length);

    const filtered = getPopupFilteredFields();

    if (filtered.length === 0) {
      fieldsContainer.replaceChildren();
      const emptyDiv = document.createElement("div");
      emptyDiv.className =
        "fs-empty-state flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-2 bg-white rounded-xl border border-dashed border-slate-200 shadow-2xs";

      const emptyIcon = createIconElement("empty", {
        size: 36,
        class: "text-slate-300 stroke-1",
      });
      if (emptyIcon) emptyDiv.appendChild(emptyIcon);

      const p = document.createElement("p");
      p.className = "text-xs font-medium text-slate-500";
      p.textContent = "No saved fields found.";
      emptyDiv.appendChild(p);

      const btnEmptyAdd = document.createElement("button");
      btnEmptyAdd.className =
        "fs-btn-primary px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer border-none";
      btnEmptyAdd.id = "btn-empty-add";
      btnEmptyAdd.textContent = "+ Add Field";
      btnEmptyAdd.addEventListener("click", () => {
        modal.open(
          null,
          allCategories,
          currentCategory !== "all"
            ? currentCategory
            : allCategories[0] || "General",
        );
      });
      emptyDiv.appendChild(btnEmptyAdd);

      fieldsContainer.appendChild(emptyDiv);
      return;
    }

    fieldsContainer.replaceChildren();

    filtered.forEach((field) => {
      const card = document.createElement("div");
      const catSlug = (field.category || "Personal")
        .toLowerCase()
        .replace(/\s+/g, "-");
      card.className = `fs-rule-card bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col gap-2 transition-all hover:border-slate-300 ${
        field.enabled ? "" : "opacity-60 bg-slate-50/70"
      }`;

      // Row 1: Header (select checkbox, label, category badge, toggle)
      const topRow = document.createElement("div");
      topRow.className = "flex items-center justify-between gap-2";

      const nameContainer = document.createElement("div");
      nameContainer.className = "flex items-center gap-1.5 flex-1 min-w-0";


      const labelSpan = document.createElement("span");
      labelSpan.className =
        "fs-rule-label text-xs font-bold text-slate-900 truncate";
      labelSpan.title = field.label;
      labelSpan.textContent = field.label;

      const catSpan = document.createElement("span");
      catSpan.className = `fs-rule-category cat-${catSlug} text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 shrink-0`;
      catSpan.textContent = field.category || "Personal";

      nameContainer.appendChild(labelSpan);
      nameContainer.appendChild(catSpan);

      const switchLabel = document.createElement("label");
      switchLabel.className = "fs-switch";
      switchLabel.title = "Toggle field";
      switchLabel.addEventListener("click", (e) => e.stopPropagation());
      const switchInput = document.createElement("input");
      switchInput.type = "checkbox";
      switchInput.className = "field-toggle-input";
      switchInput.dataset.id = field.id;
      switchInput.checked = !!field.enabled;
      const sliderSpan = document.createElement("span");
      sliderSpan.className = "fs-slider";
      switchLabel.appendChild(switchInput);
      switchLabel.appendChild(sliderSpan);

      topRow.appendChild(nameContainer);
      topRow.appendChild(switchLabel);

      // Row 2: Value Preview
      const valPreview = document.createElement("div");
      valPreview.className =
        "fs-rule-value-preview font-mono text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200/60 truncate cursor-text select-all hover:bg-blue-50/60 hover:border-blue-300 transition-all";
      valPreview.dataset.id = field.id;
      valPreview.title = `Click to select & copy: ${field.value}`;
      valPreview.textContent = field.value;

      // Row 3: Keywords & Action Buttons
      const bottomRow = document.createElement("div");
      bottomRow.className = "flex items-center justify-between gap-2 pt-0.5";

      const keywordsSpan = document.createElement("span");
      keywordsSpan.className =
        "fs-rule-keywords text-[10px] text-slate-500 truncate flex items-center gap-1";
      keywordsSpan.title = `Matches: ${field.pattern || field.label}`;
      const tagIcon = createIconElement("tag", {
        size: 11,
        class: "w-3 h-3 text-slate-400 shrink-0",
      });
      if (tagIcon) keywordsSpan.appendChild(tagIcon);
      const kwText = document.createElement("span");
      kwText.className = "truncate";
      kwText.textContent = field.pattern || field.label;
      keywordsSpan.appendChild(kwText);

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "flex items-center gap-1 shrink-0";

      const btnCopy = document.createElement("button");
      btnCopy.className =
        "btn-copy text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-md transition-all cursor-pointer border-none bg-transparent";
      btnCopy.dataset.id = field.id;
      btnCopy.title = "Copy value";
      const copyIcon = createIconElement("copy", {
        size: 14,
        class: "w-3.5 h-3.5",
      });
      if (copyIcon) btnCopy.appendChild(copyIcon);

      const btnEdit = document.createElement("button");
      btnEdit.className =
        "btn-edit text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-md transition-all cursor-pointer border-none bg-transparent";
      btnEdit.dataset.id = field.id;
      btnEdit.title = "Edit field";
      const editIcon = createIconElement("edit", {
        size: 14,
        class: "w-3.5 h-3.5",
      });
      if (editIcon) btnEdit.appendChild(editIcon);

      const btnDelete = document.createElement("button");
      btnDelete.className =
        "btn-delete text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-all cursor-pointer border-none bg-transparent";
      btnDelete.dataset.id = field.id;
      btnDelete.title = "Delete field";
      const trashIcon = createIconElement("trash", {
        size: 14,
        class: "w-3.5 h-3.5",
      });
      if (trashIcon) btnDelete.appendChild(trashIcon);

      actionsDiv.appendChild(btnCopy);
      actionsDiv.appendChild(btnEdit);
      actionsDiv.appendChild(btnDelete);

      bottomRow.appendChild(keywordsSpan);
      bottomRow.appendChild(actionsDiv);

      card.appendChild(topRow);
      card.appendChild(valPreview);
      card.appendChild(bottomRow);

      const handleCopy = async (e?: Event) => {
        if (e) e.stopPropagation();
        await copyToClipboard(field.value);
        valPreview.classList.remove("fs-copied-flash");
        void (valPreview as HTMLElement).offsetWidth;
        valPreview.classList.add("fs-copied-flash");
        setTimeout(
          () => valPreview.classList.remove("fs-copied-flash"),
          400,
        );
        showToast("Value copied to clipboard");
      };

      valPreview.addEventListener("click", handleCopy);

      switchInput.addEventListener("change", async (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id;
        if (!id) return;
        const updated = await toggleField(
          id,
          (e.target as HTMLInputElement).checked,
        );
        allFields = (await getFields()) || [];
        if (updated) {
          card.classList.toggle("opacity-60", !updated.enabled);
          card.classList.toggle("bg-slate-50/70", !updated.enabled);
        }
        notifyActiveTab({ action: "REFRESH_FIELDS" });
      });

      btnCopy.addEventListener("click", handleCopy);

      btnEdit.addEventListener("click", (e) => {
        e.stopPropagation();
        modal.open(field, allCategories);
      });

      btnDelete.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!field.id) {
          showToast("Unable to delete field: missing ID");
          return;
        }
        if (confirm(`Delete field "${field.label}"?`)) {
          const success = await deleteField(field.id);
          if (success) {
            allFields = (await getFields()) || [];
            renderCategoryChips();
            renderCategoryManager();
            renderFields();
            notifyActiveTab({ action: "REFRESH_FIELDS" });
            showToast("Field deleted");
          } else {
            showToast("Failed to delete field");
          }
        }
      });

      fieldsContainer.appendChild(card);
    });
  }

  function isFieldFilled(field: DetectedPageField): boolean {
    const topMatch = field.topMatch;
    return topMatch
      ? typeof field.currentValue === "string" &&
        field.currentValue.trim().length > 0 &&
        field.currentValue.trim().toLowerCase() ===
          topMatch.value.trim().toLowerCase()
      : typeof field.currentValue === "string" &&
        field.currentValue.trim().length > 0;
  }

  function renderScannerFilterChips(): void {
    if (!scannerFilterChips) return;

    const totalCount = activeTabFields.length;
    const savedCount = activeTabFields.filter(
      (f) => f.topMatch !== null || f.matchesCount > 0,
    ).length;
    const filledCount = activeTabFields.filter((f) => isFieldFilled(f)).length;
    const emptyCount = activeTabFields.filter((f) => !isFieldFilled(f)).length;

    const filters = [
      { key: "all", label: "All", count: totalCount },
      { key: "saved", label: "Saved", count: savedCount },
      { key: "filled", label: "Filled", count: filledCount },
      { key: "empty", label: "Empty", count: emptyCount },
    ];

    const existingChips = scannerFilterChips.querySelectorAll(".fs-chip");
    if (existingChips.length === filters.length) {
      existingChips.forEach((chipEl, idx) => {
        const filter = filters[idx];
        if (!filter) return;
        const chip = chipEl as HTMLElement;
        chip.className = `fs-chip ${scannerFilter === filter.key ? "active" : ""}`;
        chip.dataset.filter = filter.key;
        chip.textContent = `${filter.label} (${filter.count})`;
      });
      return;
    }

    scannerFilterChips.replaceChildren();
    filters.forEach((filter) => {
      const chip = document.createElement("button");
      chip.className = `fs-chip ${scannerFilter === filter.key ? "active" : ""}`;
      chip.dataset.filter = filter.key;
      chip.textContent = `${filter.label} (${filter.count})`;
      scannerFilterChips.appendChild(chip);
    });
  }

  async function scanActiveTab(): Promise<void> {
    if (!pageFieldsContainer) return;

    if (btnRefreshScanner) {
      const refreshIcon = btnRefreshScanner.querySelector(
        ".lucide-refresh, .fs-icon-refresh, svg",
      );
      if (refreshIcon) {
        refreshIcon.classList.remove("fs-spinning");
        void (refreshIcon as HTMLElement).offsetWidth;
        refreshIcon.classList.add("fs-spinning");
      }
    }

    const loadingDiv = document.createElement("div");
    loadingDiv.className =
      "fs-empty-state flex flex-col items-center justify-center p-6 text-center gap-4 bg-white rounded-xl border border-slate-200 shadow-2xs w-full";

    // Animated Radar Pulse Core
    const radarWrapper = document.createElement("div");
    radarWrapper.className = "fs-scan-radar-wrapper my-2";

    const ring1 = document.createElement("div");
    ring1.className = "fs-scan-pulse-ring";
    const ring2 = document.createElement("div");
    ring2.className = "fs-scan-pulse-ring";
    const ring3 = document.createElement("div");
    ring3.className = "fs-scan-pulse-ring";

    const iconCore = document.createElement("div");
    iconCore.className = "fs-scan-icon-core";
    const scanIcon = createIconElement("scanner", {
      size: 20,
      class: "text-blue-600",
    });
    if (scanIcon) iconCore.appendChild(scanIcon);

    radarWrapper.appendChild(ring1);
    radarWrapper.appendChild(ring2);
    radarWrapper.appendChild(ring3);
    radarWrapper.appendChild(iconCore);
    loadingDiv.appendChild(radarWrapper);

    // Dynamic scanning text
    const textGroup = document.createElement("div");
    textGroup.className = "flex flex-col gap-1 items-center";

    const titleP = document.createElement("p");
    titleP.className = "text-xs font-semibold text-slate-800 tracking-tight";
    titleP.textContent = "Scanning page form controls...";
    textGroup.appendChild(titleP);

    const subP = document.createElement("p");
    subP.className = "text-[11px] text-slate-400 font-medium";
    subP.textContent = "Detecting inputs, textareas, and buttons";
    textGroup.appendChild(subP);

    loadingDiv.appendChild(textGroup);

    // Shimmer Skeleton Placeholder Cards
    const skeletonContainer = document.createElement("div");
    skeletonContainer.className =
      "w-full flex flex-col gap-2 pt-2 border-t border-slate-100";

    for (let i = 0; i < 2; i++) {
      const skCard = document.createElement("div");
      skCard.className = "fs-skeleton-card";

      const row1 = document.createElement("div");
      row1.className = "flex items-center justify-between";
      const line1 = document.createElement("div");
      line1.className = "fs-skeleton-line h-3.5 w-24";
      const line2 = document.createElement("div");
      line2.className = "fs-skeleton-line h-3.5 w-12";
      row1.appendChild(line1);
      row1.appendChild(line2);

      const line3 = document.createElement("div");
      line3.className = "fs-skeleton-line h-6 w-full";

      skCard.appendChild(row1);
      skCard.appendChild(line3);
      skeletonContainer.appendChild(skCard);
    }
    loadingDiv.appendChild(skeletonContainer);

    pageFieldsContainer.replaceChildren(loadingDiv);

    if (!allFields || allFields.length === 0) {
      try {
        allFields = (await getFields()) || [];
      } catch (e) {}
    }

    let scanDone = false;
    const processScanResults = async (response: any, tab: any) => {
      if (btnRefreshScanner) {
        const refreshIcon = btnRefreshScanner.querySelector(
          ".lucide-refresh, .fs-icon-refresh, svg",
        );
        if (refreshIcon) refreshIcon.classList.remove("fs-spinning");
      }
      let fields: DetectedPageField[] =
        response && Array.isArray(response.fields) && response.fields.length > 0
          ? response.fields
          : [];

      if (fields.length === 0 && (!response || !response.fields)) {
        const urlStr = (tab?.url || tab?.pendingUrl || "").toLowerCase();
        const isAmoUrl = urlStr.includes("addons.mozilla.org");
        const isRestrictedUrl =
          isAmoUrl ||
          urlStr.startsWith("chrome://") ||
          urlStr.startsWith("edge://") ||
          urlStr.startsWith("about:") ||
          urlStr.startsWith("chrome-extension://") ||
          urlStr.startsWith("moz-extension://") ||
          urlStr.includes("chromewebstore.google.com") ||
          urlStr.includes("chrome.google.com/webstore");

        const isFileUrl = urlStr.startsWith("file:///");

        const restrictedCtx = {
          showToast,
          switchToTab,
          scanActiveTab,
          pageFieldsCount,
          scannerBadge,
          scannerActionsBar,
          scannerFilterBar,
        };

        if (isAmoUrl) {
          renderRestrictedPageState(pageFieldsContainer, tab, "amo", restrictedCtx);
        } else if (isRestrictedUrl) {
          renderRestrictedPageState(pageFieldsContainer, tab, "restricted", restrictedCtx);
        } else if (isFileUrl) {
          renderRestrictedPageState(pageFieldsContainer, tab, "file", restrictedCtx);
        } else {
          renderRestrictedPageState(pageFieldsContainer, tab, "disconnected", restrictedCtx);
        }
        return;
      }

      activeTabFields = fields;
      if (pageFieldsCount)
        pageFieldsCount.textContent = String(activeTabFields.length);

      const matchedCount = activeTabFields.filter(
        (f) => f.matchesCount > 0,
      ).length;

      if (activeTabFields.length > 0) {
        if (scannerActionsBar) scannerActionsBar.style.display = "flex";
        if (scannerFilterBar) scannerFilterBar.style.display = "block";
        if (btnSaveAllFields) {
          btnSaveAllFields.style.display = "flex";
          const plusIcon = createIconElement("plus", {
            size: 13,
            strokeWidth: 2.5,
          });
          const saveSpan = document.createElement("span");
          saveSpan.className = "truncate";
          saveSpan.textContent = "Save All Fields";
          btnSaveAllFields.replaceChildren(
            plusIcon || document.createTextNode(""),
            saveSpan,
          );
        }
        if (btnFillAllPage) {
          btnFillAllPage.style.display = "flex";
          const sparkIcon = createIconElement("sparkles", {
            size: 13,
            class: "w-3.5 h-3.5 shrink-0",
          });
          const fillSpan = document.createElement("span");
          fillSpan.className = "truncate";
          fillSpan.textContent = `Autofill All${matchedCount > 0 ? ` (${matchedCount})` : ""}`;
          btnFillAllPage.replaceChildren(
            sparkIcon || document.createTextNode(""),
            fillSpan,
          );
        }
        renderScannerFilterChips();
      } else {
        if (scannerActionsBar) scannerActionsBar.style.display = "none";
        if (scannerFilterBar) scannerFilterBar.style.display = "none";
      }

      if (matchedCount > 0) {
        if (scannerBadge) scannerBadge.style.display = "inline-block";
      } else {
        if (scannerBadge) scannerBadge.style.display = "none";
      }

      renderPageFields(activeTabFields);
    };

    const safetyScanTimer = setTimeout(() => {
      if (!scanDone) {
        scanDone = true;
        getActiveBrowserTab((fallbackTab) => {
          processScanResults(null, fallbackTab);
        });
      }
    }, 2000);

    notifyActiveTab({ action: "GET_PAGE_FIELDS" }, async (response, tab) => {
      if (scanDone) return;
      scanDone = true;
      clearTimeout(safetyScanTimer);
      processScanResults(response, tab);
    });
  }

  function renderPageFields(fields: DetectedPageField[]): void {
    if (fields.length === 0) {
      pageFieldsContainer.replaceChildren();
      const emptyDiv = document.createElement("div");
      emptyDiv.className =
        "fs-empty-state flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-2 bg-white rounded-xl border border-dashed border-slate-200 shadow-2xs";
      const p = document.createElement("p");
      p.className = "text-xs font-medium text-slate-500";
      p.textContent = "No form inputs found on this page.";
      emptyDiv.appendChild(p);
      pageFieldsContainer.appendChild(emptyDiv);
      return;
    }

    let filteredFields = fields;
    if (scannerFilter === "saved") {
      filteredFields = fields.filter(
        (f) => f.topMatch !== null || f.matchesCount > 0,
      );
    } else if (scannerFilter === "filled") {
      filteredFields = fields.filter((f) => isFieldFilled(f));
    } else if (scannerFilter === "empty") {
      filteredFields = fields.filter((f) => !isFieldFilled(f));
    }

    if (filteredFields.length === 0) {
      let emptyMessage = "No matching inputs found.";
      if (scannerFilter === "saved") {
        emptyMessage = "No saved fields matched on this page.";
      } else if (scannerFilter === "filled") {
        emptyMessage = "No filled fields found on this page.";
      } else if (scannerFilter === "empty") {
        emptyMessage = "No empty fields found on this page.";
      }
      pageFieldsContainer.replaceChildren();
      const emptyDiv = document.createElement("div");
      emptyDiv.className =
        "fs-empty-state flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-2 bg-white rounded-xl border border-dashed border-slate-200 shadow-2xs";
      const p = document.createElement("p");
      p.className = "text-xs font-medium text-slate-500";
      p.textContent = emptyMessage;
      emptyDiv.appendChild(p);
      pageFieldsContainer.appendChild(emptyDiv);
      return;
    }

    const datalist = document.getElementById("fs-saved-datalist");
    if (datalist) {
      datalist.replaceChildren();
      allFields.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.value;
        opt.textContent = r.label;
        datalist.appendChild(opt);
      });
    }

    pageFieldsContainer.replaceChildren();

    filteredFields.forEach((field) => {
      const card = document.createElement("div");
      card.className =
        "fs-field-card bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col gap-2";

      const cleanName = cleanFieldIdentifier(field.name || "");
      const displayName =
        field.label ||
        field.placeholder ||
        cleanName ||
        field.name ||
        field.id ||
        `Input #${field.index + 1}`;
      const topMatch = field.topMatch;
      const initialValue = topMatch ? topMatch.value : field.currentValue || "";
      const isFilled = isFieldFilled(field);

      // Top Row (name, badge, type tag)
      const topRow = document.createElement("div");
      topRow.className = "flex items-center justify-between gap-2";

      const nameContainer = document.createElement("div");
      nameContainer.className = "flex items-center gap-1.5 flex-1 min-w-0";

      const fieldTitle = document.createElement("span");
      fieldTitle.className =
        "fs-field-name text-xs font-bold text-slate-900 truncate hover:text-blue-600 active:text-blue-700 transition-colors cursor-pointer";
      fieldTitle.title = "Click to jump to this field on page";
      fieldTitle.dataset.index = String(field.index);
      fieldTitle.textContent = displayName;
      nameContainer.appendChild(fieldTitle);

      if (isFilled) {
        const filledBadge = document.createElement("span");
        filledBadge.className =
          "fs-field-filled-badge text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 inline-flex items-center gap-1";
        const chkIcon = createIconElement("check", {
          size: 10,
          strokeWidth: 2.5,
        });
        if (chkIcon) filledBadge.appendChild(chkIcon);
        const fText = document.createElement("span");
        fText.textContent = "Filled";
        filledBadge.appendChild(fText);
        nameContainer.appendChild(filledBadge);
      }

      const typeTag = document.createElement("span");
      typeTag.className =
        "text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0";
      typeTag.textContent = field.type || field.tag;

      topRow.appendChild(nameContainer);
      topRow.appendChild(typeTag);

      // Action Row (direct input, fill button, save button)
      const actionRow = document.createElement("div");
      actionRow.className = "flex items-center gap-1.5";

      const inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.className =
        "fs-field-direct-input flex-1 h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all";
      inputEl.value = initialValue;
      inputEl.placeholder = "Enter value to fill...";
      inputEl.setAttribute("list", "fs-saved-datalist");
      inputEl.dataset.index = String(field.index);
      inputEl.autocomplete = "off";

      const btnFill = document.createElement("button");
      btnFill.className =
        "fs-btn-primary btn-fill-choice h-8 px-3 text-xs font-semibold rounded-lg cursor-pointer border-none flex items-center justify-center shrink-0";
      btnFill.dataset.index = String(field.index);
      btnFill.title = "Fill into webpage";
      btnFill.textContent = "Fill";

      const btnSave = document.createElement("button");
      btnSave.className =
        "btn-create-from-field h-8 px-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-slate-200 inline-flex items-center justify-center gap-1 shrink-0";
      btnSave.dataset.name = displayName;
      btnSave.dataset.pattern = extractSuggestedKeywords(field, displayName);
      btnSave.title = "Save as field in My Fields";
      const plusIcon = createIconElement("plus", {
        size: 11,
        strokeWidth: 2.5,
      });
      if (plusIcon) btnSave.appendChild(plusIcon);
      const saveText = document.createElement("span");
      saveText.textContent = "Save";
      btnSave.appendChild(saveText);

      actionRow.appendChild(inputEl);
      actionRow.appendChild(btnFill);
      actionRow.appendChild(btnSave);

      card.appendChild(topRow);
      card.appendChild(actionRow);

      const triggerFill = () => {
        const valueToFill = inputEl.value;
        if (!valueToFill && valueToFill !== "0") {
          showToast("Please enter a value to fill");
          inputEl.focus();
          return;
        }

        btnFill.classList.add("fs-fill-success");
        const chkIcon = createIconElement("check", {
          size: 12,
          strokeWidth: 2.5,
        });
        const fSpan = document.createElement("span");
        fSpan.textContent = "Filled";
        btnFill.replaceChildren(chkIcon || document.createTextNode(""), fSpan);

        setTimeout(() => {
          btnFill.classList.remove("fs-fill-success");
          btnFill.textContent = "Fill";
        }, 1200);

        // Update activeTabFields value for this field
        field.currentValue = valueToFill;

        // Ensure "Filled" badge is visible with green checkmark
        let badge = card.querySelector(".fs-field-filled-badge");
        if (!badge && nameContainer) {
          badge = document.createElement("span");
          badge.className =
            "fs-field-filled-badge text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 inline-flex items-center gap-1";
          const bChk = createIconElement("check", {
            size: 10,
            strokeWidth: 2.5,
          });
          if (bChk) badge.appendChild(bChk);
          const bSpan = document.createElement("span");
          bSpan.textContent = "Filled";
          badge.appendChild(bSpan);
          nameContainer.appendChild(badge);
        }

        renderScannerFilterChips();

        notifyActiveTab(
          {
            action: "FILL_SPECIFIC_FIELD",
            fieldIndex: field.index,
            value: valueToFill,
          },
          () => {
            showToast(`Filled ${truncateText(displayName, 24)}`);
          },
        );
      };

      const triggerGoTo = () => {
        notifyActiveTab(
          {
            action: "FOCUS_FIELD",
            fieldIndex: field.index,
            fieldName: field.name || field.rawName,
            fieldId: field.id || field.rawId,
            fieldLabel: field.label || field.rawLabel,
          },
          () => {
            showToast(`Focused ${truncateText(displayName, 24)}`);
          },
        );
      };


      fieldTitle?.addEventListener("click", triggerGoTo);

      btnFill.addEventListener("click", triggerFill);
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          triggerFill();
        }
      });

      card
        .querySelector(".btn-create-from-field")
        ?.addEventListener("click", (e) => {
          const name = (e.currentTarget as HTMLElement).dataset.name || "";
          const pattern =
            (e.currentTarget as HTMLElement).dataset.pattern || "";
          modal.open(
            {
              label: name,
              value: inputEl.value || "",
              pattern: pattern || name,
              category: allCategories[0] || "General",
              matchType: "smart",
              targetProperty: "all",
              enabled: true,
              id: "",
              createdAt: Date.now(),
            },
            allCategories,
          );
        });

      pageFieldsContainer.appendChild(card);
    });
  }
});

