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
import { createIconElement, getIconSvg, initIcons } from "../../shared/icons";
import { cleanString, findMatchingFields } from "../../shared/matcher";

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

        const matchesToFill = activeTabFields
          .filter((f) => f.topMatch !== null || f.matchesCount > 0)
          .map((f) => ({
            index: f.index,
            value: f.topMatch ? f.topMatch.value : f.currentValue || "",
          }));

        notifyActiveTab({ action: "FILL_ALL_MATCHES" }, async (res, tab) => {
          let count = res && res.count !== undefined ? res.count : 0;
          if (count === 0 && tab && tab.id && matchesToFill.length > 0) {
            try {
              if (
                typeof chrome !== "undefined" &&
                chrome.scripting &&
                chrome.scripting.executeScript
              ) {
                const execRes = await chrome.scripting.executeScript({
                  target: { tabId: tab.id, allFrames: true },
                  func: (items: { index: number; value: string }[]) => {
                    const INPUT_SEL =
                      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="radio"]):not([type="checkbox"]):not([type="file"]):not([type="color"]):not([type="range"]), textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"], [role="combobox"]';
                    const allInputs = Array.from(
                      document.querySelectorAll(INPUT_SEL),
                    ) as HTMLElement[];
                    let filled = 0;
                    for (const item of items) {
                      const target = allInputs[item.index] as any;
                      if (target && !target.readOnly && !target.disabled) {
                        target.focus();
                        if (target.isContentEditable) {
                          target.innerText = item.value;
                        } else if ("value" in target) {
                          const proto = Object.getPrototypeOf(target);
                          const desc = Object.getOwnPropertyDescriptor(
                            proto,
                            "value",
                          );
                          if (desc && desc.set) {
                            desc.set.call(target, item.value);
                          } else {
                            target.value = item.value;
                          }
                        }
                        target.dispatchEvent(
                          new Event("input", {
                            bubbles: true,
                            composed: true,
                          }),
                        );
                        target.dispatchEvent(
                          new Event("change", {
                            bubbles: true,
                            composed: true,
                          }),
                        );
                        target.blur();
                        filled++;
                      }
                    }
                    return filled;
                  },
                  args: [matchesToFill],
                });
                count = execRes?.[0]?.result ?? matchesToFill.length;
              }
            } catch (e) {}
          }
          showToast(`Filled ${count} field${count === 1 ? "" : "s"}!`);
          setTimeout(scanActiveTab, 300);
        });
      });
    }

    // Save All Detected Fields with Default Options
    if (btnSaveAllFields) {
      btnSaveAllFields.addEventListener("click", async () => {
        if (!activeTabFields || activeTabFields.length === 0) {
          showToast("No fields detected on page");
          return;
        }

        const defaultCategory = allCategories[0] || "General";
        let savedCount = 0;

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

          const rawDisplayName =
            field.label ||
            field.placeholder ||
            field.name ||
            field.id ||
            `Input #${field.index + 1}`;
          const displayName =
            rawDisplayName.replace(/\s*[*:]+$/, "").trim() || rawDisplayName;
          const pattern =
            [field.name, field.id, field.placeholder, field.label]
              .filter(Boolean)
              .join(", ") || displayName;

          const existing = allFields.find(
            (f) => f.label.toLowerCase() === displayName.toLowerCase(),
          );

          if (existing) {
            await saveField({
              id: existing.id,
              label: existing.label,
              value: val,
              category: existing.category || defaultCategory,
              pattern: existing.pattern || pattern,
            });
          } else {
            await saveField({
              label: displayName,
              value: val,
              category: defaultCategory,
              pattern,
              matchType: "smart",
              targetProperty: "all",
              enabled: true,
            });
          }
          savedCount++;
        }

        if (savedCount === 0) {
          showToast("Please enter values in the fields to save");
          return;
        }

        await loadData();
        notifyActiveTab({ action: "REFRESH_FIELDS" });

        btnSaveAllFields.classList.add("fs-fill-success");
        const checkIcon = createIconElement("check", {
          size: 12,
          strokeWidth: 2.5,
        });
        const spanText = document.createElement("span");
        spanText.textContent = `Saved ${savedCount} Field${savedCount === 1 ? "" : "s"}!`;
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
          `Saved ${savedCount} field${savedCount === 1 ? "" : "s"} to My Fields!`,
        );
        setTimeout(scanActiveTab, 400);
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

      // Fallback: If content script returned 0 fields or failed, run direct DOM extraction via executeScript across all frames
      if (fields.length === 0 && tab && tab.id) {
        try {
          if (
            typeof chrome !== "undefined" &&
            chrome.scripting &&
            chrome.scripting.executeScript
          ) {
            const scriptResults = await chrome.scripting.executeScript({
              target: { tabId: tab.id, allFrames: true },
              func: () => {
                const INPUT_SEL =
                  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="file"]):not([type="color"]):not([type="range"]):not([hidden]):not([aria-hidden="true"]), textarea:not([hidden]):not([aria-hidden="true"]), select:not([hidden]):not([aria-hidden="true"]), [contenteditable="true"]:not([hidden]):not([aria-hidden="true"]), [contenteditable=""]:not([hidden]):not([aria-hidden="true"]), [role="textbox"]:not([hidden]):not([aria-hidden="true"]), [role="combobox"]:not([hidden]):not([aria-hidden="true"]), [role="radio"]:not([hidden]):not([aria-hidden="true"]), [role="checkbox"]:not([hidden]):not([aria-hidden="true"])';
                const clean = (s: string) =>
                  (s || "")
                    .replace(/\s*\*+\s*$/g, "")
                    .replace(/\s*\?+\s*$/g, "")
                    .replace(/:\s*$/g, "")
                    .replace(/\((required|optional)\)/gi, "")
                    .trim();

                const isVisible = (el: any): boolean => {
                  if (!el || !el.tagName) return false;
                  if (typeof el.isConnected === "boolean" && !el.isConnected) return false;
                  if (el.tagName === "TEMPLATE" || el.hidden) return false;
                  if (el.getAttribute && (el.getAttribute("hidden") !== null || el.getAttribute("aria-hidden") === "true")) return false;
                  if (el.closest) {
                    try {
                      if (el.closest("[hidden], [aria-hidden='true'], template")) return false;
                    } catch (e) {}
                  }
                  const isCheckOrRadio = el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio");

                  const isParentContainerVisible = (): boolean => {
                    if (!el.parentElement) return false;
                    let curr: HTMLElement | null = el.parentElement;
                    let depth = 0;
                    while (curr && depth < 4) {
                      if (curr.style) {
                        if (
                          curr.style.display === "none" ||
                          curr.style.visibility === "hidden" ||
                          curr.style.visibility === "collapse"
                        ) {
                          return false;
                        }
                      }
                      if (typeof window !== "undefined" && window.getComputedStyle) {
                        try {
                          const cs = window.getComputedStyle(curr);
                          if (
                            cs.display === "none" ||
                            cs.visibility === "hidden" ||
                            cs.visibility === "collapse" ||
                            cs.opacity === "0"
                          ) {
                            return false;
                          }
                        } catch (e) {}
                      }
                      if (curr.offsetParent !== null || curr.style?.position === "fixed") {
                        return true;
                      }
                      if (typeof curr.getBoundingClientRect === "function") {
                        try {
                          const rect = curr.getBoundingClientRect();
                          if (rect && (rect.width > 1 || rect.height > 1)) {
                            return true;
                          }
                        } catch (e) {}
                      }
                      curr = curr.parentElement;
                      depth++;
                    }
                    return false;
                  };

                  if (el.style) {
                    if (el.style.display === "none" || el.style.visibility === "hidden" || el.style.visibility === "collapse") {
                      if (isCheckOrRadio && isParentContainerVisible()) return true;
                      return false;
                    }
                  }
                  if (typeof window !== "undefined" && window.getComputedStyle) {
                    try {
                      const cs = window.getComputedStyle(el);
                      if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") {
                        if (isCheckOrRadio && isParentContainerVisible()) return true;
                        return false;
                      }
                      if (cs.opacity === "0") {
                        if (isCheckOrRadio && isParentContainerVisible()) return true;
                        return false;
                      }
                      if (cs.clip === "rect(0px, 0px, 0px, 0px)" || cs.clip === "rect(0, 0, 0, 0)" || cs.clipPath === "inset(50%)") {
                        if (isCheckOrRadio && isParentContainerVisible()) return true;
                        return false;
                      }
                    } catch (e) {}
                  }
                  if (typeof el.getBoundingClientRect === "function") {
                    try {
                      const r = el.getBoundingClientRect();
                      if (r && r.width <= 1 && r.height <= 1) {
                        if (isCheckOrRadio && isParentContainerVisible()) return true;
                        return false;
                      }
                    } catch (e) {}
                  }
                  return true;
                };

                const findOptLabel = (el: any): string => {
                  if (!el) return "";
                  if (el.labels && el.labels.length > 0) {
                    return Array.from(el.labels).map((l: any) => l.innerText || l.textContent || "").join(" ").trim();
                  }
                  if (el.id) {
                    const l = document.querySelector(`label[for="${el.id}"]`) as HTMLElement;
                    if (l) return (l.innerText || l.textContent || "").trim();
                  }
                  if (el.closest) {
                    const opt = el.closest("._option, [class*='option'], label");
                    if (opt) return (opt.innerText || opt.textContent || "").trim();
                  }
                  return "";
                };

                const inputs = Array.from(
                  document.querySelectorAll(INPUT_SEL),
                ) as HTMLElement[];
                const extracted: any[] = [];
                const seenRadios = new Set<string>();

                for (let i = 0; i < inputs.length; i++) {
                  const el = inputs[i] as any;
                  if (!el || el.readOnly || el.disabled || !isVisible(el)) continue;

                  const tag = (el.tagName || "").toLowerCase();
                  const isInput = tag === "input";
                  const role = el.getAttribute
                    ? el.getAttribute("role") || ""
                    : "";
                  const type = isInput
                    ? (el.type || "text").toLowerCase()
                    : role || tag;
                  if (
                    isInput &&
                    [
                      "file",
                      "hidden",
                      "submit",
                      "button",
                      "reset",
                      "image",
                      "color",
                      "range",
                    ].includes(type)
                  ) {
                    continue;
                  }

                  const isRadio = type === "radio";
                  const isCheckbox = type === "checkbox";
                  const name =
                    el.name ||
                    (el.getAttribute ? el.getAttribute("name") || "" : "");
                  const id = el.id || "";

                  if (isRadio) {
                    const groupKey = name ? `name:${name}` : id ? `id:${id}` : `idx:${i}`;
                    if (seenRadios.has(groupKey)) continue;
                    seenRadios.add(groupKey);
                  }

                  const placeholder =
                    el.placeholder ||
                    (el.getAttribute
                      ? el.getAttribute("placeholder") ||
                        el.getAttribute("aria-placeholder") ||
                        ""
                      : "");

                  // Label detection
                  let label = "";
                  if ((isRadio || isCheckbox) && el.closest) {
                    const fs = el.closest("fieldset, [data-field-path], ._fieldEntry, [class*='fieldEntry'], ._container_1258i_28, ._yesno, [class*='yesno']");
                    if (fs) {
                      const gl = fs.querySelector("legend, label.ashby-application-form-question-title, [class*='question-title'], [class*='field-title'], .field-label") as HTMLElement;
                      if (gl && gl.tagName !== "H1") {
                        label = gl.innerText || gl.textContent || "";
                      }
                      if (!label && fs.getAttribute) {
                        const dp = fs.getAttribute("data-field-path");
                        if (dp) {
                          const dpl = fs.querySelector(`label[for="${dp}"]`) as HTMLElement;
                          if (dpl && dpl.tagName !== "H1") {
                            label = dpl.innerText || dpl.textContent || "";
                          }
                        }
                      }
                    }
                  }

                  if (!label && el.labels && el.labels.length > 0) {
                    label = Array.from(el.labels)
                      .map((l: any) => l.innerText || l.textContent || "")
                      .join(" ");
                  }
                  if (!label && (id || name)) {
                    try {
                      const dataName =
                        el.getAttribute?.("data-name") ||
                        el.closest?.("[data-name]")?.getAttribute("data-name") ||
                        "";
                      const allLabels = document.getElementsByTagName("label");
                      for (let j = 0; j < allLabels.length; j++) {
                        const l = allLabels[j];
                        if (!l) continue;
                        const forAttr = l.getAttribute("for");
                        const dataForAttr = l.getAttribute("data-for");
                        if (
                          (id && (l.htmlFor === id || forAttr === id)) ||
                          (name && forAttr === name) ||
                          (dataName && (forAttr === dataName || dataForAttr === dataName)) ||
                          (name && dataForAttr && name.startsWith(dataForAttr))
                        ) {
                          label = l.innerText || l.textContent || "";
                          break;
                        }
                      }
                    } catch (e) {}
                  }

                  if (!label && el.closest) {
                    try {
                      const tr = el.closest("tr");
                      if (tr) {
                        const th = tr.querySelector("th");
                        if (th && !th.contains(el)) {
                          const innerLabel = th.querySelector(
                            "label, .label, [class*='label'], [class*='title']",
                          ) as HTMLElement;
                          label =
                            (innerLabel || th).innerText ||
                            (innerLabel || th).textContent ||
                            "";
                        }
                      }
                    } catch (e) {}
                  }

                  if (!label) {
                    try {
                      let prev = el.previousElementSibling;
                      while (prev) {
                        const prevTag = prev.tagName.toUpperCase();
                        if (prevTag !== "H1") {
                          const isLabel =
                            prevTag === "LABEL" ||
                            prevTag === "LEGEND" ||
                            prevTag === "DT" ||
                            (prev.className &&
                              typeof prev.className === "string" &&
                              /\b(label|question|title|heading)\b/i.test(prev.className));
                          if (isLabel || ["SPAN", "P", "DIV", "H2", "H3", "H4", "H5", "H6"].includes(prevTag)) {
                            label = prev.innerText || prev.textContent || "";
                            if (label && label.length < 120) break;
                          }
                        }
                        prev = prev.previousElementSibling;
                      }
                    } catch (e) {}
                  }
                  if (!label) {
                    const STOP_TAGS = ["BODY", "HTML", "FORM", "MAIN", "ARTICLE", "NAV", "SECTION"];
                    let parent = el.parentElement;
                    let depth = 0;
                    while (parent && depth < 3) {
                      try {
                        const pTag = parent.tagName.toUpperCase();
                        if (STOP_TAGS.includes(pTag)) break;

                        const fc = parent.querySelectorAll(INPUT_SEL);
                        if (fc.length > 1) {
                          if (pTag === "FIELDSET" || isRadio) {
                            const lg = parent.querySelector("legend, label.ashby-application-form-question-title, [class*='question-title'], [class*='field-title'], .field-label") as HTMLElement;
                            if (lg && lg.tagName !== "H1") {
                              label = lg.innerText || lg.textContent || "";
                              if (label) break;
                            }
                          }
                          break;
                        }

                        const containerLabel = parent.querySelector(
                          "label, legend, .label, .field-label, .form-label, [class*='label'], [class*='question'], [class*='field-title'], [data-testid*='label'], dt, span.label",
                        ) as HTMLElement;
                        if (
                          containerLabel &&
                          containerLabel !== el &&
                          !containerLabel.contains(el) &&
                          containerLabel.tagName !== "H1"
                        ) {
                          label =
                            containerLabel.innerText ||
                            containerLabel.textContent ||
                            "";
                          if (label) break;
                        }
                      } catch (e) {}
                      parent = parent.parentElement;
                      depth++;
                    }
                  }

                  let val = "";
                  const options: string[] = [];
                  if (el.isContentEditable) {
                    val = (el.innerText || el.textContent || "").trim();
                  } else if (isRadio) {
                    const groupRadios = name ? Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`)) : [el];
                    for (const r of groupRadios) {
                      const opt = findOptLabel(r) || (r as any).value || "";
                      if (opt && !options.includes(opt)) options.push(opt);
                      if ((r as any).checked) val = opt || (r as any).value || "selected";
                    }
                    if (!val && el.checked) val = findOptLabel(el) || el.value || "selected";
                  } else if (isCheckbox) {
                    const yn = el.closest ? el.closest("._yesno, [class*='yesno']") : null;
                    if (yn) {
                      options.push("Yes", "No");
                      const activeBtn = yn.querySelector("button.active, button[class*='active'], button[class*='selected']");
                      val = activeBtn ? (activeBtn.textContent || "").trim() : (el.checked ? "Yes" : "No");
                    } else {
                      val = el.checked ? "Yes" : "No";
                    }
                  } else {
                    val = el.value || "";
                  }

                  extracted.push({
                    index: i,
                    tag,
                    type,
                    name,
                    id,
                    label: clean(label),
                    placeholder: clean(placeholder),
                    currentValue: val,
                    options: options.length > 0 ? options : undefined,
                  });
                }
                return extracted;
              },
            });


            if (scriptResults && scriptResults.length > 0) {
              const allDetected: DetectedPageField[] = [];
              let globalIdx = 0;
              for (const frameResult of scriptResults) {
                if (frameResult && Array.isArray(frameResult.result)) {
                  for (const raw of frameResult.result) {
                    const cleanName = cleanString(raw.name);
                    const cleanId = cleanString(raw.id);
                    const cleanPlaceholder = cleanString(raw.placeholder);
                    const cleanLabel = cleanString(raw.label);
                    const combinedTokens = [
                      cleanLabel,
                      cleanPlaceholder,
                      cleanName,
                      cleanId,
                    ].filter(Boolean);
                    const meta: any = {
                      element: null,
                      tag: raw.tag,
                      type: raw.type,
                      name: cleanName,
                      rawName: raw.name,
                      id: cleanId,
                      rawId: raw.id,
                      placeholder: cleanPlaceholder,
                      rawPlaceholder: raw.placeholder,
                      ariaLabel: "",
                      label: cleanLabel,
                      rawLabel: raw.label,
                      title: "",
                      autocomplete: "",
                      dataAttributes: "",
                      combinedText: cleanString(combinedTokens.join(" ")),
                      value: raw.currentValue,
                    };
                    const matches = findMatchingFields(meta, allFields);
                    const topMatchItem =
                      matches.length > 0 && matches[0] ? matches[0].field : null;
                    allDetected.push({
                      index: raw.index !== undefined ? raw.index : globalIdx,
                      tag: raw.tag,
                      type: raw.type,
                      name: raw.name,
                      id: raw.id,
                      label: raw.label,
                      placeholder: raw.placeholder,
                      currentValue: raw.currentValue,
                      matchesCount: matches.length,
                      topMatch: topMatchItem && matches[0]
                        ? {
                            fieldId: topMatchItem.id,
                            label: topMatchItem.label,
                            value: topMatchItem.value,
                            score: matches[0].score,
                          }
                        : null,
                    });
                    globalIdx++;
                  }
                }
              }
              if (allDetected.length > 0) {
                fields = allDetected;
              }
            }
          }
        } catch (err) {
          console.warn("[FormSecretary] Direct script scan notice:", err);
        }
      }

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

        if (isAmoUrl) {
          renderRestrictedPageState(pageFieldsContainer, tab, "amo");
        } else if (isRestrictedUrl) {
          renderRestrictedPageState(pageFieldsContainer, tab, "restricted");
        } else if (isFileUrl) {
          renderRestrictedPageState(pageFieldsContainer, tab, "file");
        } else {
          renderRestrictedPageState(pageFieldsContainer, tab, "disconnected");
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

      const displayName =
        field.label ||
        field.placeholder ||
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
      btnSave.dataset.pattern = [
        field.name,
        field.id,
        field.placeholder,
        field.label,
      ]
        .filter(Boolean)
        .join(", ");
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
          (res, tab) => {
            showToast(`Filled ${truncateText(displayName, 24)}`);
            if ((!res || !res.success) && tab && tab.id) {
              try {
                if (
                  typeof chrome !== "undefined" &&
                  chrome.scripting &&
                  chrome.scripting.executeScript
                ) {
                  chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    func: (idx: number, val: string) => {
                      const INPUT_SEL =
                        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="radio"]):not([type="checkbox"]):not([type="file"]):not([type="color"]):not([type="range"]), textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"], [role="combobox"]';
                      const allInputs = Array.from(
                        document.querySelectorAll(INPUT_SEL),
                      ) as HTMLElement[];
                      const target = allInputs[idx] as any;
                      if (target && !target.readOnly && !target.disabled) {
                        target.focus();
                        if (target.isContentEditable) {
                          target.innerText = val;
                        } else if ("value" in target) {
                          const proto = Object.getPrototypeOf(target);
                          const desc = Object.getOwnPropertyDescriptor(
                            proto,
                            "value",
                          );
                          if (desc && desc.set) {
                            desc.set.call(target, val);
                          } else {
                            target.value = val;
                          }
                        }
                        target.dispatchEvent(
                          new Event("input", {
                            bubbles: true,
                            composed: true,
                          }),
                        );
                        target.dispatchEvent(
                          new Event("change", {
                            bubbles: true,
                            composed: true,
                          }),
                        );
                        target.blur();
                      }
                    },
                    args: [field.index, valueToFill],
                  });
                }
              } catch (e) {}
            }
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
          (res, tab) => {
            showToast(`Focused ${truncateText(displayName, 24)}`);

            if ((!res || !res.success) && tab && tab.id) {
              try {
                if (
                  typeof chrome !== "undefined" &&
                  chrome.scripting &&
                  chrome.scripting.executeScript
                ) {
                  chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    func: (idx: number, fName: string, fId: string, fLabel: string) => {
                      const INPUT_SEL =
                        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="file"]):not([type="color"]):not([type="range"]), textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"], [role="combobox"], [role="radio"], [role="checkbox"]';
                      const allInputs = Array.from(
                        document.querySelectorAll(INPUT_SEL),
                      ) as HTMLElement[];
                      let target = allInputs[idx] as HTMLElement | undefined;
                      if (!target && fId) {
                        target = document.getElementById(fId) || undefined;
                      }
                      if (!target && fName) {
                        try {
                          target = (document.querySelector(`[name="${fName}"]`) as HTMLElement) || undefined;
                        } catch (e) {}
                      }
                      if (!target && fLabel) {
                        try {
                          const lbl = Array.from(document.querySelectorAll("label, legend")).find(
                            (l: any) => (l.innerText || l.textContent || "").trim().toLowerCase().includes(fLabel.toLowerCase()),
                          ) as HTMLElement | undefined;
                          if (lbl) target = lbl;
                        } catch (e) {}
                      }

                      if (target) {
                        const isDirectlyVisible =
                          target.offsetParent !== null ||
                          (typeof target.getBoundingClientRect === "function" &&
                            target.getBoundingClientRect().height > 0);

                        const container = target.closest
                          ? (target.closest(
                              "._fieldEntry, [class*='fieldEntry'], [data-field-path], ._yesno, [class*='yesno'], fieldset, .form-group, .form-row, .form-field, [role='group'], [role='radiogroup']",
                            ) as HTMLElement)
                          : null;

                        let associatedLabel: HTMLElement | null = null;
                        const inputEl = target as HTMLInputElement;
                        if (inputEl.labels && inputEl.labels.length > 0) {
                          associatedLabel = inputEl.labels[0] as HTMLElement;
                        }
                        if (!associatedLabel && target.id) {
                          try {
                            associatedLabel = document.querySelector(`label[for="${target.id}"]`) as HTMLElement;
                          } catch (e) {}
                        }
                        if (!associatedLabel && container) {
                          associatedLabel = container.querySelector(
                            "legend, label.ashby-application-form-question-title, [class*='question-title'], [class*='field-title'], .field-label, label",
                          ) as HTMLElement;
                        }

                        let visualElement: HTMLElement = target;
                        if (!isDirectlyVisible) {
                          visualElement = associatedLabel || container || target.parentElement || target;
                        } else if (container && (container.tagName === "FIELDSET" || container.classList?.contains("_fieldEntry") || inputEl.type === "radio")) {
                          visualElement = container;
                        }

                        try {
                          visualElement.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                            inline: "nearest",
                          });
                        } catch (e) {
                          try {
                            target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                          } catch (err) {}
                        }

                        let focused = false;
                        try {
                          target.focus({ preventScroll: true });
                          if (document.activeElement === target) focused = true;
                        } catch (e) {}
                        if (!focused) {
                          try {
                            target.focus();
                            if (document.activeElement === target) focused = true;
                          } catch (e) {}
                        }
                        if (!focused && container) {
                          const fc = container.querySelector(
                            "button, [role='button'], input:not([tabindex='-1']):not([type='hidden']), select, textarea, [tabindex='0']",
                          ) as HTMLElement;
                          if (fc) {
                            try {
                              fc.focus({ preventScroll: true });
                              if (document.activeElement === fc) focused = true;
                            } catch (e) {}
                          }
                        }
                        if (!focused && visualElement) {
                          try {
                            const prevTab = visualElement.getAttribute("tabindex");
                            visualElement.setAttribute("tabindex", "-1");
                            visualElement.focus({ preventScroll: true });
                            if (prevTab === null) {
                              visualElement.addEventListener("blur", () => visualElement.removeAttribute("tabindex"), { once: true });
                            }
                          } catch (e) {}
                        }

                        const pulse = (el: HTMLElement) => {
                          try {
                            const origOutline = el.style.outline;
                            const origOutlineOffset = el.style.outlineOffset;
                            const origShadow = el.style.boxShadow;
                            const origTransition = el.style.transition;
                            el.style.transition = "outline 0.2s ease, box-shadow 0.2s ease";
                            el.style.outline = "3px solid #3b82f6";
                            el.style.outlineOffset = "2px";
                            el.style.boxShadow = "0 0 0 6px rgba(59, 130, 246, 0.28)";
                            setTimeout(() => {
                              el.style.outline = "3px solid #60a5fa";
                              el.style.boxShadow = "0 0 0 8px rgba(96, 165, 250, 0.35)";
                              setTimeout(() => {
                                el.style.outline = origOutline;
                                el.style.outlineOffset = origOutlineOffset;
                                el.style.boxShadow = origShadow;
                                el.style.transition = origTransition;
                              }, 1200);
                            }, 400);
                          } catch (e) {}
                        };

                        pulse(visualElement);
                        if (visualElement !== target && isDirectlyVisible) {
                          pulse(target);
                        }
                      }
                    },
                    args: [
                      field.index,
                      field.name || field.rawName || "",
                      field.id || field.rawId || "",
                      field.label || field.rawLabel || "",
                    ],
                  });
                }
              } catch (e) {}
            }
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

  function renderRestrictedPageState(
    container: HTMLElement,
    tab: chrome.tabs.Tab | null,
    reason: "amo" | "restricted" | "file" | "disconnected",
  ): void {
    container.replaceChildren();

    const card = document.createElement("div");
    card.className =
      "p-4 bg-white border border-slate-200/90 rounded-xl flex flex-col gap-3 shadow-2xs text-left select-text";

    const header = document.createElement("div");
    header.className = "flex items-start gap-2.5";

    const icon = createIconElement(
      reason === "file"
        ? "warning"
        : reason === "disconnected"
          ? "connect"
          : "help",
      {
        size: 18,
        class:
          reason === "file"
            ? "text-amber-500 shrink-0 mt-0.5"
            : "text-blue-600 shrink-0 mt-0.5",
      },
    );
    if (icon) header.appendChild(icon);

    const titleCol = document.createElement("div");
    titleCol.className = "flex flex-col gap-0.5 flex-1";

    const titleH4 = document.createElement("h4");
    titleH4.className = "text-xs font-semibold text-slate-800 select-text";
    titleH4.textContent =
      reason === "amo"
        ? "Firefox Protected Page (AMO)"
        : reason === "restricted"
          ? "Browser Protected Page"
          : reason === "file"
            ? "Local File Access Required"
            : "Page Not Connected";
    titleCol.appendChild(titleH4);

    const descP = document.createElement("p");
    descP.className = "text-[11.5px] text-slate-500 leading-normal select-text";
    descP.textContent =
      reason === "amo"
        ? "Firefox restricts all browser extensions from running on addons.mozilla.org by default for security."
        : reason === "restricted"
          ? "Browser security policies prevent extensions from interacting with internal browser and web store pages."
          : reason === "file"
            ? "Browser security restricts extensions from accessing local file:/// URLs by default."
            : "The extension could not establish a connection to this page.";
    titleCol.appendChild(descP);
    header.appendChild(titleCol);
    card.appendChild(header);

    const noteP = document.createElement("p");
    noteP.className = "text-[11.5px] text-slate-600 leading-normal select-text";
    noteP.textContent =
      "Browser security restrictions block automated form scanning and 1-click clipboard actions on this page. You can open your Fields Manager in a separate tab, or manually highlight and copy values (Ctrl+C) from My Fields.";
    card.appendChild(noteP);

    if (reason === "amo") {
      const amoBox = document.createElement("div");
      amoBox.className =
        "p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2 text-[11px] text-slate-600 leading-relaxed select-text";

      const amoTitle = document.createElement("div");
      amoTitle.className = "font-medium text-slate-700 select-text";
      amoTitle.textContent =
        "To allow extension access on Mozilla Add-ons Hub:";
      amoBox.appendChild(amoTitle);

      const createClickableBadge = (textToCopy: string, displayLabel?: string) => {
        const codeEl = document.createElement("code");
        codeEl.className =
          "font-mono text-blue-600 bg-blue-50/90 hover:bg-blue-100 hover:text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer select-all transition-all inline-flex items-center gap-1 font-medium text-[10.5px] break-all shadow-2xs";
        codeEl.title = `Click to copy or select: "${textToCopy}"`;
        codeEl.textContent = displayLabel || textToCopy;

        codeEl.addEventListener("click", async (e) => {
          e.stopPropagation();
          await copyToClipboard(textToCopy);
          showToast(`Copied ${textToCopy} to clipboard`);
          const originalText = displayLabel || textToCopy;
          codeEl.className =
            "font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-400 cursor-pointer select-all transition-all inline-flex items-center gap-1 font-bold text-[10.5px] break-all shadow-xs";
          codeEl.textContent = `Copied!`;

          setTimeout(() => {
            codeEl.className =
              "font-mono text-blue-600 bg-blue-50/90 hover:bg-blue-100 hover:text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer select-all transition-all inline-flex items-center gap-1 font-medium text-[10.5px] break-all shadow-2xs";
            codeEl.textContent = originalText;
          }, 1400);
        });

        return codeEl;
      };

      const step1 = document.createElement("div");
      step1.className = "text-[11px] leading-relaxed select-text";
      step1.appendChild(document.createTextNode("1. Open "));
      step1.appendChild(createClickableBadge("about:config"));
      step1.appendChild(document.createTextNode(" in Firefox."));
      amoBox.appendChild(step1);

      const step2 = document.createElement("div");
      step2.className =
        "text-[11px] leading-relaxed flex flex-wrap items-center gap-1 select-text";
      step2.appendChild(document.createTextNode("2. Search:"));
      step2.appendChild(
        createClickableBadge("extensions.webextensions.restrictedDomains"),
      );
      amoBox.appendChild(step2);

      const step3 = document.createElement("div");
      step3.className = "text-[11px] text-slate-500 leading-relaxed select-text";
      step3.textContent =
        "3. Remove addons.mozilla.org from the list, then reload this page.";
      amoBox.appendChild(step3);

      card.appendChild(amoBox);
    }

    const actionsRow = document.createElement("div");
    actionsRow.className =
      "flex items-center gap-2 pt-1 border-t border-slate-100";

    const btnGoMyFields = document.createElement("button");
    btnGoMyFields.className =
      "px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5 border-none";
    const listIcon = createIconElement("fields", { size: 13 });
    if (listIcon) btnGoMyFields.appendChild(listIcon);
    const myFieldsSpan = document.createElement("span");
    myFieldsSpan.textContent = "Go to My Fields";
    btnGoMyFields.appendChild(myFieldsSpan);
    btnGoMyFields.addEventListener("click", () => {
      switchToTab("rules");
    });
    actionsRow.appendChild(btnGoMyFields);

    if (reason === "amo" || reason === "restricted") {
      const btnOpenManager = document.createElement("button");
      btnOpenManager.className =
        "px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-slate-200 inline-flex items-center gap-1.5";
      const extIcon = createIconElement("export", { size: 13 });
      if (extIcon) btnOpenManager.appendChild(extIcon);
      const managerSpan = document.createElement("span");
      managerSpan.textContent = "Open in New Tab";
      btnOpenManager.appendChild(managerSpan);
      btnOpenManager.title = "Open Fields Manager in a dedicated browser tab";
      btnOpenManager.addEventListener("click", () => {
        if (
          typeof chrome !== "undefined" &&
          chrome.runtime &&
          chrome.runtime.openOptionsPage
        ) {
          chrome.runtime.openOptionsPage();
        } else if (
          typeof chrome !== "undefined" &&
          chrome.tabs &&
          chrome.tabs.create
        ) {
          chrome.tabs.create({
            url: chrome.runtime.getURL("options.html"),
          });
        } else {
          window.open("options.html", "_blank");
        }
      });
      actionsRow.appendChild(btnOpenManager);
    }

    if (reason === "file") {
      const btnOpenExt = document.createElement("button");
      btnOpenExt.className =
        "px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-slate-200 inline-flex items-center gap-1.5";
      const settIcon = createIconElement("settings", { size: 13 });
      if (settIcon) btnOpenExt.appendChild(settIcon);
      const span = document.createElement("span");
      span.textContent = "Extension Details";
      btnOpenExt.appendChild(span);
      btnOpenExt.addEventListener("click", () => {
        const extId =
          typeof chrome !== "undefined" && chrome.runtime?.id
            ? chrome.runtime.id
            : "";
        if (typeof chrome !== "undefined" && chrome.tabs?.create) {
          chrome.tabs.create({ url: `chrome://extensions/?id=${extId}` });
        }
      });
      actionsRow.appendChild(btnOpenExt);
    } else if (reason === "disconnected" && tab && tab.id) {
      const btnConn = document.createElement("button");
      btnConn.className =
        "px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-slate-200 inline-flex items-center gap-1.5";
      const connIcon = createIconElement("connect", { size: 13 });
      if (connIcon) btnConn.appendChild(connIcon);
      const connSpan = document.createElement("span");
      connSpan.textContent = "Try Connecting";
      btnConn.appendChild(connSpan);
      btnConn.addEventListener("click", async () => {
        btnConn.textContent = "Connecting...";
        (btnConn as HTMLButtonElement).disabled = true;
        if (
          typeof chrome !== "undefined" &&
          chrome.scripting &&
          chrome.scripting.executeScript &&
          tab.id !== undefined
        ) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content-scripts/content.js"],
            });
          } catch (e) {}
        }
        setTimeout(() => scanActiveTab(), 100);
      });
      actionsRow.appendChild(btnConn);
    }

    card.appendChild(actionsRow);
    container.appendChild(card);

    if (pageFieldsCount) pageFieldsCount.textContent = "0";
    if (scannerBadge) scannerBadge.style.display = "none";
    if (scannerActionsBar) scannerActionsBar.style.display = "none";
    if (scannerFilterBar) scannerFilterBar.style.display = "none";
  }

  function getActiveBrowserTab(
    callback: (tab: chrome.tabs.Tab | null) => void,
  ): void {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) {
      callback(null);
      return;
    }

    let finished = false;
    const safeCall = (tab: chrome.tabs.Tab | null) => {
      if (!finished) {
        finished = true;
        callback(tab);
      }
    };

    const timer = setTimeout(() => {
      safeCall(null);
    }, 1200);

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0]?.id) {
          clearTimeout(timer);
          safeCall(tabs[0]);
          return;
        }
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs2) => {
          if (tabs2 && tabs2.length > 0 && tabs2[0]?.id) {
            clearTimeout(timer);
            safeCall(tabs2[0]);
            return;
          }
          chrome.tabs.query({ active: true }, (tabs3) => {
            clearTimeout(timer);
            safeCall(tabs3 && tabs3.length > 0 && tabs3[0] ? tabs3[0] : null);
          });
        });
      });
    } catch (e) {
      clearTimeout(timer);
      safeCall(null);
    }
  }

  function notifyActiveTab(
    message: any,
    callback?: (response: any, tab?: any) => void,
  ): void {
    getActiveBrowserTab((tab) => {
      if (!tab || !tab.id) {
        if (callback) callback(null, null);
        return;
      }
      dispatchMessageToTab(tab, message, callback);
    });
  }

  function dispatchMessageToTab(
    tab: chrome.tabs.Tab | any,
    message: ExtensionMessageRequest,
    callback?: (
      response: ExtensionMessageResponse | null,
      tab?: chrome.tabs.Tab,
    ) => void,
    isRetry = false,
  ): void {
    let finished = false;
    const safeCallback = (res: any, t?: any) => {
      if (!finished) {
        finished = true;
        if (callback) callback(res, t !== undefined ? t : tab);
      }
    };

    if (
      !tab ||
      !tab.id ||
      (tab.url &&
        (tab.url.startsWith("chrome://") ||
          tab.url.startsWith("edge://") ||
          tab.url.startsWith("about:") ||
          tab.url.startsWith("chrome-extension://") ||
          tab.url.startsWith("moz-extension://")))
    ) {
      safeCallback(null, tab);
      return;
    }

    // Safety timeout: prevent scan from hanging indefinitely if tab is unresponsive
    const safetyTimer = setTimeout(() => {
      safeCallback(null, tab);
    }, isRetry ? 1200 : 1800);

    const tabsAPI =
      (typeof browser !== "undefined" && (browser as any).tabs) ||
      (typeof chrome !== "undefined" && chrome.tabs) ||
      null;

    if (!tabsAPI || !tabsAPI.sendMessage) {
      clearTimeout(safetyTimer);
      safeCallback(null, tab);
      return;
    }

    const tryInjectAndRetry = () => {
      if (isRetry || !tab.id) {
        safeCallback(null, tab);
        return;
      }

      if (
        typeof chrome !== "undefined" &&
        chrome.scripting &&
        chrome.scripting.executeScript
      ) {
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            files: ["content-scripts/content.js"],
          })
          .then(() => {
            setTimeout(() => {
              dispatchMessageToTab(tab, message, safeCallback, true);
            }, 100);
          })
          .catch((err) => {
            console.warn("[FormSecretary] Auto-inject error:", err);
            safeCallback(null, tab);
          });
      } else if (tabsAPI && tabsAPI.executeScript) {
        try {
          const res = tabsAPI.executeScript(tab.id, {
            file: "content-scripts/content.js",
          });
          if (res && typeof res.then === "function") {
            res
              .then(() => {
                setTimeout(() => {
                  dispatchMessageToTab(tab, message, safeCallback, true);
                }, 100);
              })
              .catch(() => safeCallback(null, tab));
          } else {
            setTimeout(() => {
              dispatchMessageToTab(tab, message, safeCallback, true);
            }, 100);
          }
        } catch (e) {
          safeCallback(null, tab);
        }
      } else {
        safeCallback(null, tab);
      }
    };

    try {
      let msgSent = false;
      const sendPromise = tabsAPI.sendMessage(tab.id, message, (response: any) => {
        msgSent = true;
        clearTimeout(safetyTimer);
        const runtimeAPI =
          (typeof chrome !== "undefined" && chrome.runtime) ||
          (typeof browser !== "undefined" && (browser as any).runtime);
        if (runtimeAPI?.lastError || !response) {
          tryInjectAndRetry();
        } else {
          safeCallback(response, tab);
        }
      });

      if (sendPromise && typeof sendPromise.then === "function" && !msgSent) {
        sendPromise
          .then((response: any) => {
            clearTimeout(safetyTimer);
            if (!response) {
              tryInjectAndRetry();
            } else {
              safeCallback(response, tab);
            }
          })
          .catch(() => {
            clearTimeout(safetyTimer);
            tryInjectAndRetry();
          });
      }
    } catch (e) {
      clearTimeout(safetyTimer);
      safeCallback(null, tab);
    }
  }
});
