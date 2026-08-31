/**
 * Form Secretary - Full Options & Categories Controller (TypeScript)
 * Manages fields table, category management, settings toggles, and data backup.
 */

import type { FormSecretaryField, FormSecretarySettings } from "../../types";
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
  debounce,
  escapeHtml,
  exportJsonFile,
  readJsonFile,
  showToast as utilsShowToast,
} from "../../shared/utils";
import { FieldModal } from "../../shared/field-modal";
import { createIconElement, getIconSvg, initIcons } from "../../shared/icons";

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
  let searchQuery = "";
  let selectedCategory = "all";

  // DOM Elements
  const toast = document.getElementById("opt-toast");
  const navLinks = document.querySelectorAll(".fs-nav-link");
  const viewSections = document.querySelectorAll(".fs-view-section");
  const fieldsTbody = document.getElementById("opt-rules-tbody") as HTMLElement;
  const sidebarFieldsCount = document.getElementById(
    "sidebar-rules-count",
  ) as HTMLElement;
  const sidebarCategoriesCount = document.getElementById(
    "sidebar-categories-count",
  ) as HTMLElement;
  const searchInput = document.getElementById(
    "opt-search-input",
  ) as HTMLInputElement;
  const categoryFilter = document.getElementById(
    "opt-category-filter",
  ) as HTMLSelectElement;
  const btnAddField = document.getElementById(
    "btn-add-rule-opt",
  ) as HTMLElement;


  // Categories View Elements
  const optNewCategoryInput = document.getElementById(
    "opt-new-category-input",
  ) as HTMLInputElement;
  const optBtnAddCategory = document.getElementById(
    "opt-btn-add-category",
  ) as HTMLElement;
  const optCategoriesTbody = document.getElementById(
    "opt-categories-tbody",
  ) as HTMLElement;

  // Settings elements
  const settingInline = document.getElementById(
    "opt-setting-inline",
  ) as HTMLInputElement;
  const settingHighlight = document.getElementById(
    "opt-setting-highlight",
  ) as HTMLInputElement;
  const settingFloating = document.getElementById(
    "opt-setting-floating",
  ) as HTMLInputElement;
  const settingMaxChars = document.getElementById(
    "opt-setting-max-chars",
  ) as HTMLInputElement;
  const btnExport = document.getElementById("opt-btn-export") as HTMLElement;
  const importFileInput = document.getElementById(
    "opt-import-file",
  ) as HTMLInputElement;
  const btnDeleteAll = document.getElementById(
    "opt-btn-delete-all",
  ) as HTMLElement;

  function showToast(msg: string): void {
    utilsShowToast(toast, msg);
  }

  // Initialize shared Field Modal
  const modal = new FieldModal(
    {
      modal: document.getElementById("opt-rule-modal"),
      title: document.getElementById("opt-modal-title"),
      form: document.getElementById("opt-rule-form") as HTMLFormElement,
      formId: document.getElementById("opt-form-id") as HTMLInputElement,
      formLabel: document.getElementById("opt-form-label") as HTMLInputElement,
      formValue: document.getElementById(
        "opt-form-value",
      ) as HTMLTextAreaElement,
      formPattern: document.getElementById(
        "opt-form-pattern",
      ) as HTMLInputElement,
      formCategory: document.getElementById(
        "opt-form-category",
      ) as HTMLSelectElement,
      formMatchType: document.getElementById(
        "opt-form-match-type",
      ) as HTMLSelectElement,
      matchDesc: document.getElementById("opt-match-type-desc"),
      patternLabel: document.getElementById("opt-pattern-label"),
      patternHelp: document.getElementById("opt-pattern-help"),
      tagContainer: document.getElementById("opt-tag-container"),
      tagsList: document.getElementById("opt-tags-list"),
      tagTextInput: document.getElementById(
        "opt-tag-text-input",
      ) as HTMLInputElement,
      regexInput: document.getElementById(
        "opt-regex-input",
      ) as HTMLInputElement,
      btnSave: document.getElementById("opt-btn-save"),
      btnClose: document.getElementById("opt-modal-close"),
      btnCancel: document.getElementById("opt-modal-cancel"),
    },
    {
      onSave: async (fieldData) => {
        await saveField(fieldData as any);
        await loadData();
        showToast(fieldData.id ? "Field updated" : "New field saved");
      },
    },
  );

  initIcons();
  await loadData();
  setupEvents();

  async function loadData(): Promise<void> {
    allFields = (await getFields()) || [];
    allCategories = await getCategories();
    currentSettings = await getSettings();

    if (sidebarFieldsCount)
      sidebarFieldsCount.textContent = String(allFields.length);
    if (sidebarCategoriesCount)
      sidebarCategoriesCount.textContent = String(allCategories.length);

    if (settingInline)
      settingInline.checked = currentSettings.showInlineButtons !== false;
    if (settingHighlight)
      settingHighlight.checked =
        currentSettings.highlightFilledFields !== false;
    if (settingFloating)
      settingFloating.checked = currentSettings.showFloatingBar === true;
    if (settingMaxChars) {
      settingMaxChars.value = String(
        currentSettings.maxCharsToHideTrigger !== undefined
          ? currentSettings.maxCharsToHideTrigger
          : 3,
      );
    }

    populateCategoryFilter();
    renderCategoriesTable();
    renderTable();
  }

  function populateCategoryFilter(): void {
    if (!categoryFilter) return;
    const currentVal = categoryFilter.value || "all";
    categoryFilter.replaceChildren();

    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = `All Categories (${allFields.length})`;
    categoryFilter.appendChild(allOpt);

    allCategories.forEach((cat) => {
      const count = allFields.filter(
        (r) => (r.category || "Personal") === cat,
      ).length;
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = `${cat} (${count})`;
      if (cat === currentVal) opt.selected = true;
      categoryFilter.appendChild(opt);
    });
  }

  function renderCategoriesTable(): void {
    if (!optCategoriesTbody) return;
    optCategoriesTbody.replaceChildren();

    allCategories.forEach((cat) => {
      const count = allFields.filter(
        (r) => (r.category || allCategories[0] || "General") === cat,
      ).length;

      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50/70 transition-colors";

      const tdName = document.createElement("td");
      tdName.className = "py-3.5 px-4";
      const strongName = document.createElement("strong");
      strongName.className = "font-bold text-slate-900";
      strongName.textContent = cat;
      tdName.appendChild(strongName);

      const tdCount = document.createElement("td");
      tdCount.className = "py-3.5 px-4";
      const countBadge = document.createElement("span");
      countBadge.className =
        "text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600";
      countBadge.textContent = `${count} field${count === 1 ? "" : "s"}`;
      tdCount.appendChild(countBadge);

      const tdActions = document.createElement("td");
      tdActions.className = "py-3.5 px-4 text-right";
      const btnDelete = document.createElement("button");
      btnDelete.className =
        "btn-delete-cat-row p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer border-none bg-transparent";
      btnDelete.dataset.name = cat;
      btnDelete.title = "Delete category";
      const trashIcon = createIconElement("trash", {
        size: 16,
        class: "w-4 h-4",
      });
      if (trashIcon) btnDelete.appendChild(trashIcon);
      tdActions.appendChild(btnDelete);

      tr.appendChild(tdName);
      tr.appendChild(tdCount);
      tr.appendChild(tdActions);

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
            `Delete category "${catToDelete}"? Fields in this category will be reassigned to "${targetCat}".`,
          )
        ) {
          allCategories = await deleteCategory(catToDelete);
          await loadData();
          showToast(`Category "${catToDelete}" deleted`);
        }
      });

      optCategoriesTbody.appendChild(tr);
    });
  }

  function setupEvents(): void {
    // Navigation
    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const view = (link as HTMLElement).dataset.view;
        navLinks.forEach((l) => l.classList.remove("active"));
        viewSections.forEach((s) => s.classList.remove("active"));

        link.classList.add("active");
        const targetView = document.getElementById(`view-${view}`);
        if (targetView) targetView.classList.add("active");
      });
    });

    // Add New Category in Categories View
    if (optBtnAddCategory && optNewCategoryInput) {
      const handleAddCat = async () => {
        const name = optNewCategoryInput.value.trim();
        if (!name) return;
        allCategories = await addCategory(name);
        optNewCategoryInput.value = "";
        await loadData();
        showToast(`Category "${name}" created`);
      };

      optBtnAddCategory.addEventListener("click", handleAddCat);
      optNewCategoryInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddCat();
        }
      });
    }

    // Search and filter with Debouncing
    const debouncedRenderTable = debounce(() => {
      renderTable();
    }, 300);

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = ((e.target as HTMLInputElement).value || "")
          .toLowerCase()
          .trim();
        debouncedRenderTable();
      });

      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && searchInput.value) {
          searchInput.value = "";
          searchQuery = "";
          debouncedRenderTable.cancel();
          renderTable();
        }
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener("change", (e) => {
        selectedCategory = (e.target as HTMLSelectElement).value;
        debouncedRenderTable.cancel();
        renderTable();
      });
    }

    // Modal Add Button
    if (btnAddField) {
      btnAddField.addEventListener("click", () => {
        const defaultCat =
          selectedCategory !== "all"
            ? selectedCategory
            : allCategories[0] || "General";
        modal.open(null, allCategories, defaultCat);
      });
    }

    // Settings
    if (settingInline) {
      settingInline.addEventListener("change", async () => {
        currentSettings.showInlineButtons = settingInline.checked;
        await saveSettings(currentSettings);
        showToast("Settings saved");
      });
    }

    if (settingHighlight) {
      settingHighlight.addEventListener("change", async () => {
        currentSettings.highlightFilledFields = settingHighlight.checked;
        await saveSettings(currentSettings);
        showToast("Settings saved");
      });
    }

    if (settingFloating) {
      settingFloating.addEventListener("change", async () => {
        currentSettings.showFloatingBar = settingFloating.checked;
        await saveSettings(currentSettings);
        showToast("Settings saved");
      });
    }

    if (settingMaxChars) {
      settingMaxChars.addEventListener("change", async () => {
        const val = parseInt(settingMaxChars.value, 10);
        currentSettings.maxCharsToHideTrigger = isNaN(val) || val < 1 ? 3 : val;
        settingMaxChars.value = String(currentSettings.maxCharsToHideTrigger);
        await saveSettings(currentSettings);
        showToast(
          `Hide limit set to ${currentSettings.maxCharsToHideTrigger} chars`,
        );
      });
    }

    // Export JSON
    if (btnExport) {
      btnExport.addEventListener("click", async () => {
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
          showToast("Fields imported");
        } catch (err: any) {
          alert(err.message);
        } finally {
          importFileInput.value = "";
        }
      });
    }

    if (btnDeleteAll) {
      btnDeleteAll.addEventListener("click", async () => {
        if (
          confirm(
            "Are you sure you want to delete ALL saved fields? This will remove all your saved field values.",
          )
        ) {
          await deleteAllFields();
          await loadData();
          showToast("All fields deleted");
        }
      });
    }
  }

  function getFilteredFields(): FormSecretaryField[] {
    let filtered = allFields;
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (r) => (r.category || "Personal") === selectedCategory,
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

  function renderTable(): void {
    if (!fieldsTbody) return;

    const filtered = getFilteredFields();

    if (filtered.length === 0) {
      fieldsTbody.replaceChildren();
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.className = "text-center py-12 text-slate-400 text-sm font-medium";
      td.textContent = "No saved fields found.";
      tr.appendChild(td);
      fieldsTbody.appendChild(tr);
      return;
    }

    fieldsTbody.replaceChildren();

    filtered.forEach((field) => {
      const tr = document.createElement("tr");
      tr.className = `hover:bg-slate-50/70 cursor-pointer transition-colors  ${field.enabled ? "" : "opacity-60 bg-slate-50/40"}`;


      // 1. Switch
      const tdSwitch = document.createElement("td");
      tdSwitch.className = "py-3.5 px-4";
      const switchLabel = document.createElement("label");
      switchLabel.className = "fs-switch scale-85";
      const switchInput = document.createElement("input");
      switchInput.type = "checkbox";
      switchInput.className = "field-status-toggle";
      switchInput.dataset.id = field.id;
      switchInput.checked = !!field.enabled;
      const sliderSpan = document.createElement("span");
      sliderSpan.className = "fs-slider";
      switchLabel.appendChild(switchInput);
      switchLabel.appendChild(sliderSpan);
      tdSwitch.appendChild(switchLabel);

      // 2. Label
      const tdLabel = document.createElement("td");
      tdLabel.className = "py-3.5 px-4";
      const strongLabel = document.createElement("strong");
      strongLabel.className = "font-bold text-slate-900";
      strongLabel.textContent = field.label;
      tdLabel.appendChild(strongLabel);

      // 3. Category
      const tdCat = document.createElement("td");
      tdCat.className = "py-3.5 px-4";
      const catBadge = document.createElement("span");
      catBadge.className =
        "text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100";
      catBadge.textContent = field.category || "Personal";
      tdCat.appendChild(catBadge);

      // 4. Value
      const tdVal = document.createElement("td");
      tdVal.className = "py-3.5 px-4";
      const valBadge = document.createElement("span");
      valBadge.className =
        "fs-rule-val-cell font-mono text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all inline-block max-w-xs truncate";
      valBadge.title = field.value;
      valBadge.textContent = field.value;
      tdVal.appendChild(valBadge);

      // 5. Pattern
      const tdPat = document.createElement("td");
      tdPat.className = "py-3.5 px-4";
      const patSpan = document.createElement("span");
      patSpan.className = "text-xs text-slate-500 max-w-[180px] truncate block";
      patSpan.textContent = field.pattern || field.label;
      tdPat.appendChild(patSpan);

      // 6. Match Type
      const tdMatch = document.createElement("td");
      tdMatch.className = "py-3.5 px-4";
      const matchBadge = document.createElement("span");
      matchBadge.className =
        "text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100";
      matchBadge.textContent = field.matchType || "smart";
      tdMatch.appendChild(matchBadge);

      // 7. Actions
      const tdActions = document.createElement("td");
      tdActions.className = "py-3.5 px-4 text-right";
      const flexDiv = document.createElement("div");
      flexDiv.className = "flex items-center justify-end gap-1";

      const btnCopy = document.createElement("button");
      btnCopy.className =
        "btn-copy-row p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer border-none bg-transparent";
      btnCopy.title = "Copy value";
      btnCopy.dataset.id = field.id;
      const copyIcon = createIconElement("copy", {
        size: 16,
        class: "w-4 h-4",
      });
      if (copyIcon) btnCopy.appendChild(copyIcon);

      const btnEdit = document.createElement("button");
      btnEdit.className =
        "btn-edit-row p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer border-none bg-transparent";
      btnEdit.title = "Edit field";
      btnEdit.dataset.id = field.id;
      const editIcon = createIconElement("edit", {
        size: 16,
        class: "w-4 h-4",
      });
      if (editIcon) btnEdit.appendChild(editIcon);

      const btnDelete = document.createElement("button");
      btnDelete.className =
        "btn-delete-row p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer border-none bg-transparent";
      btnDelete.title = "Delete field";
      btnDelete.dataset.id = field.id;
      const trashIcon = createIconElement("trash", {
        size: 16,
        class: "w-4 h-4",
      });
      if (trashIcon) btnDelete.appendChild(trashIcon);

      flexDiv.appendChild(btnCopy);
      flexDiv.appendChild(btnEdit);
      flexDiv.appendChild(btnDelete);
      tdActions.appendChild(flexDiv);

      tr.appendChild(tdSwitch);
      tr.appendChild(tdLabel);
      tr.appendChild(tdCat);
      tr.appendChild(tdVal);
      tr.appendChild(tdPat);
      tr.appendChild(tdMatch);
      tr.appendChild(tdActions);

      const handleRowCopy = async (e?: Event) => {
        if (e) e.stopPropagation();
        valBadge.classList.remove("fs-copied-flash");
        void (valBadge as HTMLElement).offsetWidth;
        valBadge.classList.add("fs-copied-flash");
        setTimeout(() => valBadge.classList.remove("fs-copied-flash"), 400);
        await utilsShowToast(toast, "Copied to clipboard");
      };

      valBadge.addEventListener("click", handleRowCopy);

      switchLabel.addEventListener("click", (e) => e.stopPropagation());
      switchInput.addEventListener("change", async (e) => {
        e.stopPropagation();
        const updated = await toggleField(
          field.id,
          (e.target as HTMLInputElement).checked,
        );
        allFields = (await getFields()) || [];
        if (updated) {
          tr.classList.toggle("opacity-60", !updated.enabled);
          tr.classList.toggle("bg-slate-50/40", !updated.enabled);
        }
      });

      btnCopy.addEventListener("click", handleRowCopy);
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
            await loadData();
            showToast("Field deleted");
          } else {
            showToast("Failed to delete field");
          }
        }
      });

      fieldsTbody.appendChild(tr);
    });
  }
});
