/**
 * Form Secretary - Smart Field Matcher
 * Extracts semantic metadata from form controls and scores match confidence against saved fields.
 */

import type {
  FieldMetadata,
  FieldMatchResult,
  FormSecretaryField,
  ScoredFieldMatch,
  TargetProperty,
} from "../types";
import { isElementVisible } from "./utils";

export function cleanString(str: any): string {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .replace(/[:*#_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanExtractedLabelText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\s*\*+\s*$/g, "")
    .replace(/:\s*$/g, "")
    .replace(/\((required|optional)\)/gi, "")
    .trim();
}

/**
 * Finds the specific option label for a radio button or checkbox item
 */
export function findOptionLabelForElement(element: HTMLElement | null): string {
  if (!element) return "";
  try {
    const inputEl = element as HTMLInputElement;
    if (inputEl.labels && inputEl.labels.length > 0) {
      const t = cleanExtractedLabelText(
        Array.from(inputEl.labels)
          .map((l) => l.innerText || l.textContent || "")
          .join(" "),
      );
      if (t) return t;
    }

    if (element.id) {
      if (typeof document !== "undefined") {
        try {
          const lbl = document.querySelector(
            `label[for="${CSS.escape ? CSS.escape(element.id) : element.id}"]`,
          ) as HTMLElement;
          if (lbl) {
            const t = cleanExtractedLabelText(
              lbl.innerText || lbl.textContent || "",
            );
            if (t) return t;
          }
        } catch (e) {}
      }

      if (element.closest) {
        try {
          const container = element.closest("fieldset, form, [class*='fieldEntry'], div");
          if (container) {
            const lbl = container.querySelector(
              `label[for="${CSS.escape ? CSS.escape(element.id) : element.id}"]`,
            ) as HTMLElement;
            if (lbl) {
              const t = cleanExtractedLabelText(
                lbl.innerText || lbl.textContent || "",
              );
              if (t) return t;
            }
          }
        } catch (e) {}
      }
    }

    if (element.closest) {
      const optionContainer = element.closest(
        "._option, [class*='option'], label",
      );
      if (optionContainer) {
        const optionLabel = optionContainer.querySelector("label");
        if (optionLabel && optionLabel !== element) {
          const t = cleanExtractedLabelText(
            optionLabel.innerText || optionLabel.textContent || "",
          );
          if (t && t.length < 100) return t;
        }

        const clone = optionContainer.cloneNode(true) as HTMLElement;
        clone
          .querySelectorAll("input, button, svg")
          .forEach((i) => i.remove());
        const t = cleanExtractedLabelText(
          clone.innerText || clone.textContent || "",
        );
        if (t && t.length < 100) return t;
      }
    }

    if (element.nextElementSibling) {
      const next = element.nextElementSibling as HTMLElement;
      if (next.tagName === "LABEL" || next.tagName === "SPAN") {
        const t = cleanExtractedLabelText(
          next.innerText || next.textContent || "",
        );
        if (t && t.length < 100) return t;
      }
    }
  } catch (e) {}
  return "";
}


/**
 * Intelligently find visual or explicit label for an element
 */
export function findLabelForElement(element: HTMLElement | null): string {
  if (!element) return "";

  try {
    const tag = element.tagName.toLowerCase();
    const isInput = tag === "input";
    const rawType = isInput
      ? ((element as HTMLInputElement).type || "text").toLowerCase()
      : "";
    const isRadio = rawType === "radio";
    const isCheckbox = rawType === "checkbox";

    // For radio and checkbox inputs in custom toggle containers or fieldsets, prioritize group question title
    if ((isRadio || isCheckbox) && element.closest) {

      const container = element.closest(
        "fieldset, [data-field-path], ._fieldEntry, [class*='fieldEntry'], ._container_1258i_28, ._yesno, [class*='yesno']",
      );
      if (container) {
        const groupLabel = container.querySelector(
          "legend, label.ashby-application-form-question-title, [class*='question-title'], [class*='field-title'], .field-label, .form-label, [data-testid*='label']",
        ) as HTMLElement;
        if (
          groupLabel &&
          groupLabel !== element &&
          !groupLabel.contains(element) &&
          groupLabel.tagName !== "H1"
        ) {
          const text = cleanExtractedLabelText(
            groupLabel.innerText || groupLabel.textContent || "",
          );
          if (text && text.length < 150) return text;
        }

        // Check if container has data-field-path matching a label[for]
        const dataPath = container.getAttribute ? container.getAttribute("data-field-path") : null;
        if (dataPath) {
          const pathLabel = container.querySelector(`label[for="${dataPath}"]`) as HTMLElement;
          if (pathLabel && pathLabel !== element) {
            const text = cleanExtractedLabelText(pathLabel.innerText || pathLabel.textContent || "");
            if (text && text.length < 150) return text;
          }
        }

        // Check any label in container that is not associated with this individual input item
        const allLabelsInContainer = container.querySelectorAll("legend, label, dt");
        for (let i = 0; i < allLabelsInContainer.length; i++) {
          const lbl = allLabelsInContainer[i] as HTMLElement;
          if (lbl && lbl.tagName !== "H1" && !lbl.contains(element)) {
            const forAttr = lbl.getAttribute ? lbl.getAttribute("for") : (lbl as any).htmlFor;
            if (!forAttr || (forAttr !== element.id && (isRadio || !element.id))) {
              const text = cleanExtractedLabelText(
                lbl.innerText || lbl.textContent || "",
              );
              if (text && text.length < 150) return text;
            }
          }
        }
      }
    }

    // 1. Native element.labels collection
    const inputEl = element as HTMLInputElement;
    if (inputEl.labels && inputEl.labels.length > 0) {
      const texts = Array.from(inputEl.labels).map(
        (l) => l.innerText || l.textContent || "",
      );
      const joined = cleanExtractedLabelText(texts.join(" "));
      if (joined) return joined;
    }

    if (typeof document !== "undefined") {
      const idVal = element.id;
      const nameVal = element.getAttribute ? element.getAttribute("name") : "";
      const fieldPath = element.getAttribute
        ? element.getAttribute("data-field-path") ||
          (element.closest &&
            element.closest("[data-field-path]")?.getAttribute("data-field-path"))
        : "";
      const dataName =
        (element.getAttribute ? element.getAttribute("data-name") : "") ||
        (element.closest &&
          element.closest("[data-name]")?.getAttribute("data-name")) ||
        "";

      // 2. Matching <label for="id">, <label for="name">, <label data-for="..."> or <label for="data-field-path">
      try {
        const allLabels = document.getElementsByTagName("label");
        for (let i = 0; i < allLabels.length; i++) {
          const l = allLabels[i];
          if (!l) continue;
          const forVal = l.getAttribute ? l.getAttribute("for") : (l as any).htmlFor;
          const dataForVal = l.getAttribute ? l.getAttribute("data-for") : null;
          if (
            (idVal &&
              (l.htmlFor === idVal || forVal === idVal)) ||
            (nameVal && forVal === nameVal) ||
            (fieldPath && forVal === fieldPath) ||
            (dataName && (forVal === dataName || dataForVal === dataName)) ||
            (nameVal && dataForVal && nameVal.startsWith(dataForVal))
          ) {
            const t = cleanExtractedLabelText(
              l.innerText || l.textContent || "",
            );
            if (t) return t;
          }
        }
      } catch (e) {}

      // Fallback query with CSS.escape
      try {
        if (idVal && typeof CSS !== "undefined" && CSS.escape) {
          const escapedId = CSS.escape(idVal);
          const label = document.querySelector(
            `label[for="${escapedId}"]`,
          ) as HTMLElement;
          if (label && (label.innerText || label.textContent)) {
            const t = cleanExtractedLabelText(
              label.innerText || label.textContent || "",
            );
            if (t) return t;
          }
        }
      } catch (e) {}
    }

    // 3. Aria-labelledby reference
    if (element.getAttribute) {
      const ariaLabelledBy = element.getAttribute("aria-labelledby");
      if (ariaLabelledBy) {
        const ids = ariaLabelledBy.split(/\s+/);
        const textParts: string[] = [];
        for (const id of ids) {
          try {
            const el = document.getElementById(id);
            if (el && (el.innerText || el.textContent)) {
              textParts.push(
                cleanExtractedLabelText(el.innerText || el.textContent || ""),
              );
            }
          } catch (e) {}
        }
        if (textParts.length) return textParts.join(" ");
      }
    }

    // 4. Closest enclosing <label>
    try {
      const parentLabel = element.closest ? element.closest("label") : null;
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true) as HTMLElement;
        const inputs = clone.querySelectorAll(
          "input, select, textarea, button",
        );
        inputs.forEach((i) => i.remove());
        const labelText = cleanExtractedLabelText(
          clone.innerText || clone.textContent || "",
        );
        if (labelText) return labelText;
      }
    } catch (e) {}

    // 5. Table <th> row header association (common in table forms like Mozilla Add-ons Hub)
    try {
      if (element.closest) {
        const tr = element.closest("tr");
        if (tr) {
          const th = tr.querySelector("th");
          if (th && !th.contains(element)) {
            const innerLabel = th.querySelector(
              "label, .label, [class*='label'], [class*='title']",
            ) as HTMLElement;
            const targetNode = innerLabel || th;
            let raw = "";
            if (targetNode.cloneNode) {
              const clone = targetNode.cloneNode(true) as HTMLElement;
              clone
                .querySelectorAll(".tip, .tooltip, button, svg, input")
                .forEach((el) => el.remove());
              raw = clone.innerText || clone.textContent || "";
            } else {
              raw = targetNode.innerText || targetNode.textContent || "";
            }
            const t = cleanExtractedLabelText(raw);
            if (t && t.length < 120) return t;
          }
        }
      }
    } catch (e) {}

    // 6. Direct preceding sibling element
    try {
      let prev: Element | null = element.previousElementSibling;
      while (prev) {
        const prevTag = prev.tagName.toUpperCase();
        // Never treat H1 as a field label
        if (prevTag !== "H1") {
          const hasInputs =
            prev.querySelectorAll &&
            prev.querySelectorAll("input, select, textarea").length > 0;
          if (!hasInputs) {
            const isLabelLike =
              prevTag === "LABEL" ||
              prevTag === "LEGEND" ||
              prevTag === "DT" ||
              prevTag === "TH" ||
              (prev.className &&
                typeof prev.className === "string" &&
                /\b(label|question|title|heading|name)\b/i.test(prev.className));
            if (
              isLabelLike ||
              ["SPAN", "P", "DIV", "H2", "H3", "H4", "H5", "H6", "TH"].includes(
                prevTag,
              )
            ) {
              const text = cleanExtractedLabelText(
                (prev as HTMLElement).innerText || prev.textContent || "",
              );
              if (text && text.length < 120) return text;
            }
          }
        }
        prev = prev.previousElementSibling;
      }
    } catch (e) {}

    // 7. Field container search (max depth 3, scoped strictly to dedicated single-field wrappers)
    const STOP_CONTAINER_TAGS = [
      "BODY",
      "HTML",
      "FORM",
      "MAIN",
      "ARTICLE",
      "NAV",
      "SECTION",
    ];
    let currentParent: HTMLElement | null = element.parentElement;
    let depth = 0;

    while (currentParent && depth < 3) {
      try {
        const parentTag = currentParent.tagName.toUpperCase();
        if (STOP_CONTAINER_TAGS.includes(parentTag)) {
          break;
        }

        // Count other form controls in this container
        const formControlsInContainer = currentParent.querySelectorAll
          ? currentParent.querySelectorAll(
              'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]',
            )
          : [];

        if (formControlsInContainer.length > 1) {
          // If container has multiple inputs, allow <legend> or group question title if it's a fieldset/radio group
          if (parentTag === "FIELDSET" || isRadio) {
            const legend = currentParent.querySelector(
              "legend, label.ashby-application-form-question-title, [class*='question-title'], [class*='field-title'], .field-label",
            ) as HTMLElement;
            if (legend && legend.tagName !== "H1") {
              const text = cleanExtractedLabelText(
                legend.innerText || legend.textContent || "",
              );
              if (text && text.length < 150) return text;
            }
          }
          // Do not search downwards in a multi-input container to avoid cross-contamination
          break;
        }

        // Search dedicated single-field wrapper
        const containerLabel = currentParent.querySelector(
          "label, legend, .label, .field-label, .form-label, [class*='label'], [class*='question'], [class*='field-title'], [data-testid*='label'], dt, span.label, th",
        ) as HTMLElement;

        if (
          containerLabel &&
          containerLabel !== element &&
          !containerLabel.contains(element) &&
          containerLabel.tagName !== "H1"
        ) {
          const text = cleanExtractedLabelText(
            containerLabel.innerText || containerLabel.textContent || "",
          );
          if (text && text.length < 150) return text;
        }

        // Check previous siblings of current container
        let prevSibling: Element | null = currentParent.previousElementSibling;
        while (prevSibling) {
          const prevSiblingTag = prevSibling.tagName.toUpperCase();
          if (prevSiblingTag !== "H1") {
            const hasInputs =
              prevSibling.querySelectorAll &&
              prevSibling.querySelectorAll("input, select, textarea").length >
                0;
            if (!hasInputs) {
              const isLabelLike =
                prevSiblingTag === "LABEL" ||
                prevSiblingTag === "LEGEND" ||
                prevSiblingTag === "DT" ||
                prevSiblingTag === "TH" ||
                (prevSibling.className &&
                  typeof prevSibling.className === "string" &&
                  /\b(label|question|field-title)\b/i.test(
                    prevSibling.className,
                  ));
              if (
                isLabelLike ||
                ["SPAN", "P", "DIV", "H3", "H4", "H5", "H6", "TH"].includes(
                  prevSiblingTag,
                )
              ) {
                const text = cleanExtractedLabelText(
                  (prevSibling as HTMLElement).innerText ||
                    prevSibling.textContent ||
                    "",
                );
                if (text && text.length < 100) return text;
              }
            }
          }
          prevSibling = prevSibling.previousElementSibling;
        }
      } catch (e) {}

      currentParent = currentParent.parentElement;
      depth++;
    }
  } catch (err) {}

  return "";
}

/**
 * Extract comprehensive metadata from any DOM input control
 */
export function extractFieldMetadata(element: any): FieldMetadata | null {
  if (!element || !element.tagName) return null;
  if (!isElementVisible(element)) return null;

  const tag = element.tagName.toLowerCase();
  const isInput = tag === "input";
  const isTextarea = tag === "textarea";
  const isSelect = tag === "select";
  const isContentEditable =
    element.isContentEditable === true ||
    element.getAttribute?.("contenteditable") === "true" ||
    element.getAttribute?.("contenteditable") === "";
  const role = element.getAttribute ? element.getAttribute("role") || "" : "";
  const isRoleInput =
    role === "textbox" ||
    role === "combobox" ||
    role === "searchbox" ||
    role === "radio" ||
    role === "checkbox";

  if (
    !isInput &&
    !isTextarea &&
    !isSelect &&
    !isContentEditable &&
    !isRoleInput
  ) {
    return null;
  }

  const rawType = (
    isInput ? element.type || "text" : isRoleInput ? role : tag
  ).toLowerCase();

  if (isInput) {
    const excludedTypes = [
      "file",
      "hidden",
      "submit",
      "button",
      "reset",
      "image",
      "color",
      "range",
    ];
    if (excludedTypes.includes(rawType)) {
      return null;
    }
  }

  const type = rawType;
  const isRadio = type === "radio";
  const isCheckbox = type === "checkbox";
  const name = element.getAttribute
    ? element.getAttribute("name") || element.name || ""
    : element.name || "";
  const id = element.id || "";
  const placeholder =
    element.placeholder ||
    (element.getAttribute
      ? element.getAttribute("placeholder") ||
        element.getAttribute("aria-placeholder") ||
        element.getAttribute("data-placeholder") ||
        ""
      : "");
  const ariaLabel = element.getAttribute
    ? element.getAttribute("aria-label") || ""
    : "";
  const title = element.title || "";
  const autocomplete = element.getAttribute
    ? element.getAttribute("autocomplete") || ""
    : "";
  const label = findLabelForElement(element);

  // Collect data attributes (e.g. data-qa, data-testid, data-field)
  const dataAttributes: string[] = [];
  if (element.dataset) {
    for (const [_, v] of Object.entries(element.dataset)) {
      if (typeof v === "string") dataAttributes.push(v);
    }
  }

  // Collect options for radio group or select
  const options: string[] = [];
  let value = "";

  if (isContentEditable) {
    value = (
      element.innerText ||
      element.textContent ||
      element.value ||
      ""
    ).trim();
  } else if (isRadio) {
    const radioName = element.getAttribute("name") || element.name || "";
    let checkedOption = "";
    const allRadios: HTMLElement[] = [];

    if (radioName && typeof document !== "undefined") {
      try {
        const found = document.querySelectorAll(
          `input[type="radio"][name="${radioName}"]`,
        );
        if (found && found.length > 0) {
          allRadios.push(...(Array.from(found) as HTMLElement[]));
        }
      } catch (e) {}
    }

    if (allRadios.length === 0 && element.closest) {
      const fieldset = element.closest(
        "fieldset, form, [data-field-path], ._fieldEntry, [class*='fieldEntry'], ._container_1258i_28",
      );
      if (fieldset) {
        const found = fieldset.querySelectorAll('input[type="radio"]');
        if (found && found.length > 0) {
          allRadios.push(...(Array.from(found) as HTMLElement[]));
        }
      }
    }

    if (allRadios.length === 0 && element.parentElement) {
      const found = element.parentElement.querySelectorAll('input[type="radio"]');
      if (found && found.length > 0) {
        allRadios.push(...(Array.from(found) as HTMLElement[]));
      }
    }

    if (allRadios.length === 0) {
      allRadios.push(element);
    }

    for (let i = 0; i < allRadios.length; i++) {
      const r = allRadios[i] as any;
      const optLbl = findOptionLabelForElement(r) || r.value || "";
      if (optLbl && !options.includes(optLbl)) options.push(optLbl);
      if (r.checked) {
        checkedOption = optLbl || r.value || "selected";
      }
    }

    if (!checkedOption && element.checked) {
      checkedOption = findOptionLabelForElement(element) || element.value || "selected";
    }
    value = checkedOption;
  } else if (isCheckbox) {
    // Check if inside custom Yes/No toggle buttons container
    const yesNoContainer = element.closest
      ? element.closest("._yesno, [class*='yesno'], [class*='toggle']")
      : null;

    if (yesNoContainer) {
      options.push("Yes", "No");
      const activeBtn = yesNoContainer.querySelector(
        "button.active, button[aria-pressed='true'], button[class*='active'], button[class*='selected']",
      );
      if (activeBtn) {
        value = (activeBtn.textContent || "").trim();
      } else {
        value = element.checked ? "Yes" : "No";
      }
    } else {
      value = element.checked ? "Yes" : "No";
    }
  } else if (isSelect) {
    const selectEl = element as HTMLSelectElement;
    if (selectEl.options) {
      for (let i = 0; i < selectEl.options.length; i++) {
        const opt = selectEl.options[i];
        if (opt && opt.text) options.push(opt.text.trim());
      }
    }
    const selectedOpt =
      selectEl.selectedIndex >= 0 && selectEl.options
        ? selectEl.options[selectEl.selectedIndex]
        : undefined;
    if (selectedOpt) {
      value = selectedOpt.text || selectedOpt.value || "";
    } else {
      value = element.value || "";
    }
  } else if ("value" in element && element.value !== undefined) {
    value = element.value || "";
  } else {
    value = (element.innerText || element.textContent || "").trim();
  }

  // Build combined normalized text representation for smart matching
  const combinedTokens = [
    label,
    placeholder,
    ariaLabel,
    name,
    id,
    title,
    autocomplete,
    options.join(" "),
    dataAttributes.join(" "),
  ].filter(Boolean);

  const combinedText = cleanString(combinedTokens.join(" "));

  return {
    element,
    tag,
    type,
    name: cleanString(name),
    rawName: name,
    id: cleanString(id),
    rawId: id,
    placeholder: cleanString(placeholder),
    rawPlaceholder: placeholder,
    ariaLabel: cleanString(ariaLabel),
    label: cleanString(label),
    rawLabel: label,
    title: cleanString(title),
    autocomplete: cleanString(autocomplete),
    dataAttributes: cleanString(dataAttributes.join(" ")),
    combinedText,
    value,
    options: options.length > 0 ? options : undefined,
  };
}


function hasWordMatch(cleanHay: string, cleanNeedle: string): boolean {
  if (!cleanHay || !cleanNeedle) return false;
  if (cleanHay === cleanNeedle) return true;
  return (" " + cleanHay + " ").includes(" " + cleanNeedle + " ");
}

function getTargetPropertyValue(
  fieldMeta: FieldMetadata,
  targetProp: TargetProperty,
): string {
  switch (targetProp) {
    case "label":
      return fieldMeta.label;
    case "name":
      return fieldMeta.name;
    case "id":
      return fieldMeta.id;
    case "placeholder":
      return fieldMeta.placeholder;
    case "aria":
      return fieldMeta.ariaLabel;
    case "all":
    default:
      return fieldMeta.combinedText;
  }
}

/**
 * Score match between field metadata and a specific saved field entry
 */
export function evaluateFieldMatch(
  fieldMeta: FieldMetadata | null,
  savedField: FormSecretaryField | null,
): FieldMatchResult {
  if (!fieldMeta || !savedField || !savedField.enabled) {
    return { matched: false, score: 0, matchedBy: "" };
  }

  const matchType = savedField.matchType || "smart";
  const targetProp: TargetProperty = savedField.targetProperty || "all";
  const rawPattern = (savedField.pattern || savedField.label || "").trim();

  if (!rawPattern) {
    return { matched: false, score: 0, matchedBy: "" };
  }

  // Check Regex Match (ReDoS & Crash Protected)
  if (matchType === "regex") {
    if (rawPattern.length > 250 || /\([^)]*[+*][^)]*\)[+*{]/.test(rawPattern)) {
      return { matched: false, score: 0, matchedBy: "unsafe regex" };
    }
    try {
      const regex = new RegExp(rawPattern, "i");
      const targetValue = getTargetPropertyValue(fieldMeta, targetProp);
      if (regex.test(targetValue)) {
        return { matched: true, score: 95, matchedBy: `regex (${targetProp})` };
      }
    } catch (e) {
      return { matched: false, score: 0, matchedBy: "invalid regex" };
    }
    return { matched: false, score: 0, matchedBy: "" };
  }

  // Check Exact Match
  if (matchType === "exact") {
    const targetValue = getTargetPropertyValue(fieldMeta, targetProp);
    const cleanTarget = cleanString(targetValue);
    const cleanPat = cleanString(rawPattern);
    if (cleanPat && cleanTarget === cleanPat) {
      return { matched: true, score: 100, matchedBy: `exact (${targetProp})` };
    }
    return { matched: false, score: 0, matchedBy: "" };
  }

  // Check Contains Match
  if (matchType === "contains") {
    const targetValue = getTargetPropertyValue(fieldMeta, targetProp);
    const cleanTarget = cleanString(targetValue);
    const cleanPat = cleanString(rawPattern);
    if (cleanPat && cleanTarget.includes(cleanPat)) {
      return {
        matched: true,
        score: 85,
        matchedBy: `contains (${targetProp})`,
      };
    }
    return { matched: false, score: 0, matchedBy: "" };
  }

  // Smart Match (Default)
  const tokens = rawPattern
    .split(/[,|]/)
    .map((t) => cleanString(t))
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    tokens.push(cleanString(rawPattern));
  }

  let highestScore = 0;
  let bestMatchedBy = "";

  for (const token of tokens) {
    // 1. Exact match on label or name
    if (fieldMeta.label === token || fieldMeta.name === token) {
      if (100 > highestScore) {
        highestScore = 100;
        bestMatchedBy = `exact in ${fieldMeta.label === token ? "label" : "name"}`;
      }
    }
    // 2. Full word match in label
    else if (hasWordMatch(fieldMeta.label, token)) {
      if (90 > highestScore) {
        highestScore = 90;
        bestMatchedBy = "word in label";
      }
    }
    // 3. Substring in label
    else if (fieldMeta.label && fieldMeta.label.includes(token)) {
      if (80 > highestScore) {
        highestScore = 80;
        bestMatchedBy = "contains in label";
      }
    }
    // 4. Match in placeholder or aria-label
    else if (
      hasWordMatch(fieldMeta.placeholder, token) ||
      hasWordMatch(fieldMeta.ariaLabel, token)
    ) {
      if (75 > highestScore) {
        highestScore = 75;
        bestMatchedBy = "placeholder/aria-label";
      }
    }
    // 5. Match in name or id or autocomplete
    else if (
      hasWordMatch(fieldMeta.name, token) ||
      hasWordMatch(fieldMeta.id, token) ||
      hasWordMatch(fieldMeta.autocomplete, token)
    ) {
      if (70 > highestScore) {
        highestScore = 70;
        bestMatchedBy = "name/id/autocomplete";
      }
    }
    // 6. Substring in name or id
    else if (
      fieldMeta.name.includes(token) ||
      fieldMeta.id.includes(token) ||
      fieldMeta.placeholder.includes(token)
    ) {
      if (65 > highestScore) {
        highestScore = 65;
        bestMatchedBy = "partial name/id";
      }
    }
    // 7. General combined text match
    else if (fieldMeta.combinedText.includes(token)) {
      if (50 > highestScore) {
        highestScore = 50;
        bestMatchedBy = "combined text";
      }
    }
  }

  return {
    matched: highestScore > 0,
    score: highestScore,
    matchedBy: bestMatchedBy,
  };
}

/**
 * Find all matching saved fields for a field element, sorted by match confidence
 */
export function findMatchingFields(
  fieldMeta: FieldMetadata | null,
  savedFields: FormSecretaryField[],
): ScoredFieldMatch[] {
  if (!fieldMeta || !Array.isArray(savedFields) || savedFields.length === 0) {
    return [];
  }

  const matches: ScoredFieldMatch[] = [];
  for (const savedField of savedFields) {
    const evaluation = evaluateFieldMatch(fieldMeta, savedField);
    if (evaluation.matched) {
      matches.push({
        field: savedField,
        score: evaluation.score,
        matchedBy: evaluation.matchedBy,
      });
    }
  }

  // Sort descending by match score
  matches.sort((a, b) => b.score - a.score);
  return matches;
}
