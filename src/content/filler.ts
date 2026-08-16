/**
 * Form Secretary - DOM Input Filler
 * Framework-resilient autofill for React, Vue, Angular, contenteditable, and standard HTML forms.
 */

import type { FormSecretarySettings } from "../types";
import { findOptionLabelForElement } from "../shared/matcher";

function isPositiveBooleanValue(val: any): boolean {
  if (typeof val === "boolean") return val;
  const s = String(val).toLowerCase().trim();
  return (
    s === "yes" ||
    s === "true" ||
    s === "1" ||
    s === "checked" ||
    s === "authorized" ||
    s === "y" ||
    s === "agree" ||
    s === "accept"
  );
}

export function fillElement(
  element: HTMLElement | null,
  value: any,
  settings: Partial<FormSecretarySettings> = {},
): boolean {
  if (!element || value === undefined || value === null) return false;

  try {
    const el = element as any;
    const tag = element.tagName.toLowerCase();
    const isInput = tag === "input";
    const isTextarea = tag === "textarea";
    const isSelect = tag === "select";
    const isContentEditable = !!element.isContentEditable;
    const rawType = isInput
      ? ((element as HTMLInputElement).type || "text").toLowerCase()
      : (element.getAttribute?.("role") || tag).toLowerCase();
    const isRadio = rawType === "radio";
    const isCheckbox = rawType === "checkbox";

    const win = (typeof window !== "undefined" ? window : globalThis) as any;

    if (isRadio) {
      // 1. Radio Button Group Selection
      const targetStr = String(value).toLowerCase().trim();
      const radioName = element.getAttribute("name") || (element as any).name || "";

      let radioGroup: HTMLElement[] = [];
      if (radioName && typeof document !== "undefined") {
        try {
          const found = document.querySelectorAll(
            `input[type="radio"][name="${radioName}"]`,
          );
          if (found && found.length > 0) {
            radioGroup = Array.from(found as any);
          }
        } catch (e) {}
      }

      if (radioGroup.length === 0 && element.closest) {
        const fieldset = element.closest(
          "fieldset, form, [data-field-path], ._fieldEntry, [class*='fieldEntry'], ._container_1258i_28",
        );
        if (fieldset) {
          const found = fieldset.querySelectorAll('input[type="radio"]');
          if (found && found.length > 0) {
            radioGroup = Array.from(found as any);
          }
        }
      }

      if (radioGroup.length === 0 && element.parentElement) {
        const found = element.parentElement.querySelectorAll('input[type="radio"]');
        if (found && found.length > 0) {
          radioGroup = Array.from(found as any);
        }
      }

      if (radioGroup.length === 0) {
        radioGroup = [element];
      }


      let bestRadio: HTMLElement | null = null;
      for (const r of radioGroup) {
        const radioInput = r as HTMLInputElement;
        const optVal = (radioInput.value || "").toLowerCase().trim();
        const optLabel = findOptionLabelForElement(r).toLowerCase().trim();

        if (
          optVal === targetStr ||
          optLabel === targetStr ||
          (optLabel && (optLabel.includes(targetStr) || targetStr.includes(optLabel))) ||
          (optVal && (optVal.includes(targetStr) || targetStr.includes(optVal)))
        ) {
          bestRadio = r;
          break;
        }
      }

      if (!bestRadio && radioGroup.length > 0) {
        const isPos = isPositiveBooleanValue(value);
        for (const r of radioGroup) {
          const optLabel = findOptionLabelForElement(r).toLowerCase();
          if (isPos && (optLabel.includes("yes") || optLabel.includes("true") || optLabel.includes("agree"))) {
            bestRadio = r;
            break;
          } else if (!isPos && (optLabel.includes("no") || optLabel.includes("false") || optLabel.includes("decline"))) {
            bestRadio = r;
            break;
          }
        }
      }

      const targetRadio = (bestRadio || element) as HTMLInputElement;

      const prototype = win.HTMLInputElement?.prototype;
      const descriptor = prototype
        ? Object.getOwnPropertyDescriptor(prototype, "checked")
        : null;

      if (descriptor && descriptor.set) {
        descriptor.set.call(targetRadio, true);
      } else {
        targetRadio.checked = true;
      }

      const tracker = (targetRadio as any)._valueTracker;
      if (tracker) {
        tracker.setValue("true");
      }

      const optionWrapper = targetRadio.closest
        ? targetRadio.closest("._option, [class*='option'], label")
        : null;
      if (optionWrapper && optionWrapper !== targetRadio) {
        try {
          (optionWrapper as HTMLElement).click();
        } catch (e) {}
      }

      targetRadio.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
      targetRadio.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      targetRadio.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    } else if (isCheckbox) {
      // 2. Checkbox & Custom Yes/No Toggle Buttons
      const shouldBeChecked = isPositiveBooleanValue(value);

      // Check if inside custom Yes/No toggle buttons container (e.g. Ashby _yesno container)
      const container = element.closest
        ? element.closest("._yesno, [class*='yesno'], ._container_1svni_28, [class*='container']")
        : null;

      if (container) {
        const buttons = container.querySelectorAll("button");
        for (let i = 0; i < buttons.length; i++) {
          const btn = buttons[i];
          if (!btn) continue;
          const btnText = (btn.innerText || btn.textContent || "").toLowerCase().trim();
          if (shouldBeChecked && (btnText === "yes" || btnText.includes("yes"))) {
            btn.click();
            break;
          } else if (!shouldBeChecked && (btnText === "no" || btnText.includes("no"))) {
            btn.click();
            break;
          }
        }
      }

      const checkboxEl = element as HTMLInputElement;
      const prototype = win.HTMLInputElement?.prototype;
      const descriptor = prototype
        ? Object.getOwnPropertyDescriptor(prototype, "checked")
        : null;

      if (descriptor && descriptor.set) {
        descriptor.set.call(checkboxEl, shouldBeChecked);
      } else {
        checkboxEl.checked = shouldBeChecked;
      }

      const tracker = (checkboxEl as any)._valueTracker;
      if (tracker) {
        tracker.setValue("" + shouldBeChecked);
      }

      checkboxEl.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
      checkboxEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      checkboxEl.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    } else if (isInput || isTextarea) {
      // 3. Text Inputs & Textareas
      const prototype = isInput
        ? win.HTMLInputElement?.prototype
        : win.HTMLTextAreaElement?.prototype;
      const descriptor = prototype
        ? Object.getOwnPropertyDescriptor(prototype, "value")
        : null;

      if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
      } else {
        el.value = value;
      }

      // Handle React _valueTracker if present
      const tracker = el._valueTracker;
      if (tracker) {
        tracker.setValue(value);
      }
    } else if (isSelect) {
      // 4. Select Dropdowns
      const selectEl = element as HTMLSelectElement;
      const strVal = String(value).toLowerCase().trim();
      let matchedIndex = -1;

      for (let i = 0; i < selectEl.options.length; i++) {
        const opt = selectEl.options[i];
        if (!opt) continue;
        const optVal = opt.value.toLowerCase().trim();
        const optText = opt.text.toLowerCase().trim();
        if (
          optVal === strVal ||
          optText === strVal ||
          optText.includes(strVal) ||
          strVal.includes(optText)
        ) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex >= 0) {
        selectEl.selectedIndex = matchedIndex;
      }
    } else if (isContentEditable) {
      // 5. ContentEditable Elements
      element.innerText = value;
    }

    // Comprehensive event sequence for maximum framework reactivity
    element.dispatchEvent(
      new Event("focus", { bubbles: true, composed: true }),
    );
    element.dispatchEvent(
      new Event("input", { bubbles: true, composed: true }),
    );
    element.dispatchEvent(
      new Event("change", { bubbles: true, composed: true }),
    );
    element.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, composed: true, key: "a" }),
    );
    element.dispatchEvent(
      new KeyboardEvent("keyup", { bubbles: true, composed: true, key: "a" }),
    );
    element.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));

    // Visual feedback pulse
    if (settings.highlightFilledFields !== false) {
      element.classList.add("form-secretary-filled-pulse");
      setTimeout(() => {
        element.classList.remove("form-secretary-filled-pulse");
      }, 1200);
    }

    return true;
  } catch (err) {
    console.warn("[FormSecretary] Autofill error:", err);
    return false;
  }
}

