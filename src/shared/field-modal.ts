/**
 * Form Secretary - Field Modal & Tag Controller
 * Reusable modal and interactive tag chips controller for both Popup and Options pages.
 */

import type { FormSecretaryField, MatchType } from "../types";
import { MATCH_TYPE_CONFIG } from "./constants";
import { escapeHtml } from "./utils";
import { createIconElement, getIconSvg } from "./icons";

export { MATCH_TYPE_CONFIG };

export interface FieldModalElements {
  modal: HTMLElement | null;
  title: HTMLElement | null;
  form: HTMLFormElement | null;
  formId: HTMLInputElement | null;
  formLabel: HTMLInputElement | null;
  formValue: HTMLInputElement | HTMLTextAreaElement | null;
  formPattern: HTMLInputElement | null;
  formCategory: HTMLSelectElement | null;
  formMatchType: HTMLSelectElement | null;
  matchDesc: HTMLElement | null;
  patternLabel: HTMLElement | null;
  patternHelp: HTMLElement | null;
  tagContainer: HTMLElement | null;
  tagsList: HTMLElement | null;
  tagTextInput: HTMLInputElement | null;
  regexInput: HTMLInputElement | null;
  btnSave?: HTMLElement | null;
  btnClose?: HTMLElement | null;
  btnCancel?: HTMLElement | null;
}

export interface FieldModalOptions {
  onSave?: (fieldData: Partial<FormSecretaryField>) => Promise<void> | void;
}

export class FieldModal {
  el: FieldModalElements;
  options: FieldModalOptions;
  tags: string[];

  constructor(elements: FieldModalElements, options: FieldModalOptions = {}) {
    this.el = elements;
    this.options = options;
    this.tags = [];

    this.initEventListeners();
  }

  initEventListeners(): void {
    // Modal save button (explicit click fallback if not handled by native form submit)
    if (this.el.btnSave) {
      this.el.btnSave.addEventListener("click", () => {
        if (this.el.form && this.el.btnSave?.getAttribute("type") !== "submit") {
          this.el.form.dispatchEvent(
            new Event("submit", { cancelable: true, bubbles: true }),
          );
        }
      });
    }

    // Modal close & cancel
    if (this.el.btnClose) {
      this.el.btnClose.addEventListener("click", () => this.close());
    }
    if (this.el.btnCancel) {
      this.el.btnCancel.addEventListener("click", () => this.close());
    }

    // Close on backdrop overlay click
    if (this.el.modal) {
      this.el.modal.addEventListener("mousedown", (e) => {
        if (e.target === this.el.modal) {
          this.close();
        }
      });
    }

    // Close on Escape key press
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        this.el.modal &&
        this.el.modal.style.display !== "none" &&
        !this.el.modal.classList.contains("closing")
      ) {
        this.close();
      }
    });

    // Matching mode dropdown change
    if (this.el.formMatchType) {
      this.el.formMatchType.addEventListener("change", () => {
        this.updateFieldModeView(
          (this.el.formMatchType?.value as MatchType) || "smart",
        );
      });
    }

    // Save button click
    if (this.el.btnSave) {
      this.el.btnSave.addEventListener("click", () => {
        if (this.el.form) {
          const FormEvtClass = (globalThis as any).CustomEvent || (globalThis as any).Event;
          const submitEvt = FormEvtClass
            ? new FormEvtClass("submit", { cancelable: true, bubbles: true })
            : ({ type: "submit", preventDefault: () => {} } as any);
          try {
            this.el.form.dispatchEvent(submitEvt);
          } catch {
            // fallback for environments with strict Event objects
            const fallbackEvt = { type: "submit", preventDefault: () => {}, target: this.el.form, bubbles: true };
            this.el.form.dispatchEvent(fallbackEvt as any);
          }
        }
      });
    }

    // Tag container and text input events
    if (this.el.tagContainer && this.el.tagTextInput) {
      this.el.tagContainer.addEventListener("click", () => {
        this.el.tagTextInput?.focus();
      });

      this.el.tagTextInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          if (this.el.tagTextInput && this.el.tagTextInput.value.trim()) {
            this.addTag(this.el.tagTextInput.value);
            this.el.tagTextInput.value = "";
          }
        } else if (
          e.key === "Backspace" &&
          (!this.el.tagTextInput || !this.el.tagTextInput.value) &&
          this.tags.length > 0
        ) {
          this.tags.pop();
          this.renderTags();
        }
      });

      this.el.tagTextInput.addEventListener("blur", () => {
        if (this.el.tagTextInput && this.el.tagTextInput.value.trim()) {
          this.addTag(this.el.tagTextInput.value);
          this.el.tagTextInput.value = "";
        }
      });

      this.el.tagTextInput.addEventListener("paste", () => {
        setTimeout(() => {
          if (
            this.el.tagTextInput &&
            this.el.tagTextInput.value.includes(",")
          ) {
            this.addTag(this.el.tagTextInput.value);
            this.el.tagTextInput.value = "";
          }
        }, 10);
      });
    }

    // Regex input sync
    if (this.el.regexInput) {
      this.el.regexInput.addEventListener("input", () => {
        if (this.el.formPattern && this.el.regexInput) {
          this.el.formPattern.value = this.el.regexInput.value.trim();
        }
      });
    }

    // Form submit handler
    if (this.el.form) {
      this.el.form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (this.el.tagTextInput && this.el.tagTextInput.value.trim()) {
          this.addTag(this.el.tagTextInput.value);
          this.el.tagTextInput.value = "";
        }

        const matchType = (
          this.el.formMatchType ? this.el.formMatchType.value : "smart"
        ) as MatchType;
        let finalPattern = "";

        if (matchType === "regex") {
          finalPattern = this.el.regexInput
            ? this.el.regexInput.value.trim()
            : this.el.formPattern?.value.trim() || "";
        } else {
          finalPattern = this.el.formPattern
            ? this.el.formPattern.value.trim()
            : "";
        }

        const labelVal = this.el.formLabel
          ? this.el.formLabel.value.trim()
          : "";
        if (!finalPattern) {
          finalPattern = labelVal;
        }

        const rawId = this.el.formId?.value?.trim();
        const fieldData: Partial<FormSecretaryField> = {
          ...(rawId ? { id: rawId } : {}),
          label: labelVal,
          value: this.el.formValue ? this.el.formValue.value : "",
          pattern: finalPattern,
          category: this.el.formCategory
            ? this.el.formCategory.value || "General"
            : "General",
          matchType,
          targetProperty: "all",
          enabled: true,
        };

        if (this.options.onSave) {
          await this.options.onSave(fieldData);
        }

        this.close();
      });
    }
  }

  renderTags(): void {
    if (!this.el.tagsList) return;
    this.el.tagsList.replaceChildren();

    this.tags.forEach((tag, idx) => {
      const chip = document.createElement("span");
      chip.className =
        "fs-tag-chip inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium";

      const textSpan = document.createElement("span");
      textSpan.textContent = tag;

      const removeBtn = document.createElement("span");
      removeBtn.className =
        "fs-tag-remove cursor-pointer opacity-60 hover:opacity-100 hover:text-rose-600 transition-opacity ml-0.5 inline-flex items-center";
      removeBtn.dataset.idx = String(idx);
      removeBtn.title = "Remove word";
      const closeIcon = createIconElement("close", {
        size: 10,
        class: "w-2.5 h-2.5",
      });
      if (closeIcon) removeBtn.appendChild(closeIcon);

      chip.replaceChildren(textSpan, removeBtn);

      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.tags.splice(idx, 1);
        this.syncPatternFromTags();
        this.renderTags();
      });
      this.el.tagsList?.appendChild(chip);
    });

    this.syncPatternFromTags();
  }

  syncPatternFromTags(): void {
    if (this.el.formPattern) {
      this.el.formPattern.value = this.tags.join(", ");
    }
  }

  addTag(text: string): void {
    if (!text) return;
    const parts = text
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    let changed = false;
    parts.forEach((part) => {
      if (
        part &&
        !this.tags.some((t) => t.toLowerCase() === part.toLowerCase())
      ) {
        this.tags.push(part);
        changed = true;
      }
    });
    if (changed) {
      this.renderTags();
    }
  }

  setTagsFromPattern(patternStr: string): void {
    if (!patternStr || !patternStr.trim()) {
      this.tags = [];
    } else {
      this.tags = patternStr
        .split(/[,;\n]+/)
        .map((p) => p.trim())
        .filter(Boolean);
    }
    this.renderTags();
  }

  updateFieldModeView(matchType: MatchType): void {
    const config = MATCH_TYPE_CONFIG[matchType] || MATCH_TYPE_CONFIG.smart;
    if (this.el.matchDesc) this.el.matchDesc.textContent = config.desc;
    if (this.el.patternLabel) this.el.patternLabel.textContent = config.label;
    if (this.el.patternHelp) this.el.patternHelp.textContent = config.help;

    if (config.isRegex) {
      if (this.el.tagContainer) this.el.tagContainer.style.display = "none";
      if (this.el.regexInput) {
        this.el.regexInput.style.display = "block";
        this.el.regexInput.placeholder = config.placeholder;
        this.el.regexInput.value = this.el.formPattern
          ? this.el.formPattern.value || ""
          : "";
      }
    } else {
      if (this.el.regexInput) this.el.regexInput.style.display = "none";
      if (this.el.tagContainer) {
        this.el.tagContainer.style.display = "flex";
        if (this.el.tagTextInput)
          this.el.tagTextInput.placeholder = config.placeholder;
      }
    }
  }

  populateCategories(categories: string[] = [], selected = ""): void {
    if (!this.el.formCategory) return;
    this.el.formCategory.replaceChildren();
    const activeSelected = selected || categories[0] || "General";
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      if (cat === activeSelected) opt.selected = true;
      this.el.formCategory?.appendChild(opt);
    });
  }

  open(
    field: FormSecretaryField | null = null,
    categories: string[] = [],
    defaultCategory = "",
  ): void {
    const fallbackCat = categories[0] || "General";
    const selectedCat = field
      ? field.category || fallbackCat
      : defaultCategory || fallbackCat;
    this.populateCategories(categories, selectedCat);

    if (field) {
      if (this.el.title) this.el.title.textContent = "Edit Field";
      if (this.el.formId) this.el.formId.value = field.id || "";
      if (this.el.formLabel) this.el.formLabel.value = field.label || "";
      if (this.el.formValue) this.el.formValue.value = field.value || "";
      const customPattern =
        field.pattern && field.pattern !== field.label ? field.pattern : "";
      if (this.el.formPattern) this.el.formPattern.value = customPattern;
      if (this.el.formCategory)
        this.el.formCategory.value = field.category || fallbackCat;
      if (this.el.formMatchType)
        this.el.formMatchType.value = field.matchType || "smart";
      this.setTagsFromPattern(customPattern);
      if (this.el.regexInput) this.el.regexInput.value = customPattern;
    } else {
      if (this.el.title) this.el.title.textContent = "Add New Field";
      if (this.el.formId) this.el.formId.value = "";
      if (this.el.formLabel) this.el.formLabel.value = "";
      if (this.el.formValue) this.el.formValue.value = "";
      if (this.el.formPattern) this.el.formPattern.value = "";
      if (this.el.formCategory) this.el.formCategory.value = selectedCat;
      if (this.el.formMatchType) this.el.formMatchType.value = "smart";
      this.setTagsFromPattern("");
      if (this.el.regexInput) this.el.regexInput.value = "";
    }

    if (this.el.tagTextInput) this.el.tagTextInput.value = "";
    this.updateFieldModeView(
      (this.el.formMatchType?.value as MatchType) || "smart",
    );

    if (this.el.modal) {
      this.el.modal.classList.remove("closing");
      this.el.modal.style.display = "flex";
    }
    if (this.el.formLabel) {
      setTimeout(() => {
        this.el.formLabel?.focus();
      }, 50);
    }
  }

  close(): void {
    if (this.el.modal) {
      this.el.modal.classList.add("closing");
      setTimeout(() => {
        if (this.el.modal) {
          this.el.modal.style.display = "none";
          this.el.modal.classList.remove("closing");
        }
      }, 180);
    }
    if (this.el.form) {
      this.el.form.reset();
    }
  }
}
