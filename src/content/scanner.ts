/**
 * Form Secretary - Page Scanner & Mass Autofill
 * Deeply scans DOM and custom Shadow DOM controls for active form inputs.
 */

import type {
  DetectedPageField,
  FormSecretaryField,
  FormSecretarySettings,
} from "../types";
import { extractFieldMetadata, findMatchingFields } from "../shared/matcher";
import { fillElement } from "./filler";
import { DOM_SELECTORS } from "../shared/constants";
import { isElementVisible } from "../shared/utils";

const INPUT_SELECTOR = DOM_SELECTORS.INPUT_CONTROLS;

/**
 * Deeply finds all input controls including inside custom shadow DOM elements and accessible iframes
 */
export function findAllInputControls(
  rootNode: Node | Document = document,
  currentDepth = 0,
  maxDepth = 6,
): HTMLElement[] {
  if (!rootNode || currentDepth > maxDepth) return [];

  const results: HTMLElement[] = [];
  const seen = new Set<Node>();

  function traverse(node: Node, depth: number) {
    if (!node || depth > maxDepth || seen.has(node)) return;
    seen.add(node);

    try {
      const parentEl = node as Document | HTMLElement | ShadowRoot;
      if (parentEl.querySelectorAll) {
        // 1. Query direct input controls
        const directInputs = parentEl.querySelectorAll(INPUT_SELECTOR);
        for (let i = 0; i < directInputs.length; i++) {
          const el = directInputs[i] as HTMLElement;
          if (el && !results.includes(el) && isElementVisible(el)) {
            results.push(el);
          }
        }

        // 2. Query open shadow roots
        const allElements = parentEl.querySelectorAll("*");
        for (let i = 0; i < allElements.length; i++) {
          const customEl = allElements[i] as HTMLElement;
          if (customEl.shadowRoot && customEl.id !== "form-secretary-root") {
            traverse(customEl.shadowRoot, depth + 1);
          }
        }

        // 3. Query accessible iframes
        const iframes = parentEl.querySelectorAll("iframe, frame");
        for (let i = 0; i < iframes.length; i++) {
          try {
            const iframe = iframes[i] as HTMLIFrameElement;
            const iframeDoc =
              iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc && !seen.has(iframeDoc)) {
              traverse(iframeDoc, depth + 1);
            }
          } catch (e) {
            // Cross-origin iframe
          }
        }
      }
    } catch (e) {
      // Guard against DOM access restrictions
    }
  }

  traverse(rootNode, currentDepth);
  return results;
}

/**
 * Scans entire page and finds all input controls and their matches
 */
export function scanPageFields(
  savedFields: FormSecretaryField[] = [],
  matcher: any = { extractFieldMetadata, findMatchingFields },
): DetectedPageField[] {
  const m = matcher;
  if (!m || !m.extractFieldMetadata) return [];

  let inputs: HTMLElement[] = [];
  try {
    inputs = findAllInputControls();
  } catch (e) {
    return [];
  }

  const detected: DetectedPageField[] = [];
  const seenRadioGroups = new Set<string>();

  for (let i = 0; i < inputs.length; i++) {
    try {
      const el = inputs[i] as any;
      if (!el || el.readOnly || el.disabled) continue;

      const isRadio =
        el.type === "radio" || el.getAttribute?.("role") === "radio";
      if (isRadio) {
        const radioName = el.name || el.getAttribute?.("name") || "";
        const groupKey = radioName
          ? `name:${radioName}`
          : el.id
            ? `id:${el.id}`
            : `idx:${i}`;
        if (seenRadioGroups.has(groupKey)) {
          continue;
        }
        seenRadioGroups.add(groupKey);
      }

      const meta = m.extractFieldMetadata(el);
      if (!meta) continue;

      let matches: any[] = [];
      try {
        matches = m.findMatchingFields(meta, savedFields);
      } catch (err) {
        matches = [];
      }

      const topMatchItem = matches.length > 0 ? matches[0].field : null;

      detected.push({
        index: i,
        tag: meta.tag,
        type: meta.type,
        name: meta.rawName,
        id: meta.rawId,
        label: meta.rawLabel,
        placeholder: meta.rawPlaceholder,
        currentValue: meta.value,
        matchesCount: matches.length,
        options: meta.options,
        topMatch: topMatchItem
          ? {
              fieldId: topMatchItem.id,
              label: topMatchItem.label,
              value: topMatchItem.value,
              score: matches[0].score,
            }
          : null,
      });
    } catch (err) {
      // Safely skip any single problematic node
    }
  }

  return detected;
}

/**
 * Mass fills all matched fields on current page
 */
export function fillAllMatchedFieldsOnPage(
  savedFields: FormSecretaryField[] = [],
  matcher: any = { extractFieldMetadata, findMatchingFields },
  filler: any = { fillElement },
  settings: Partial<FormSecretarySettings> = {},
): number {
  const m = matcher;
  const f = filler;

  if (!m || !f || !m.extractFieldMetadata || !f.fillElement) return 0;

  let inputs: HTMLElement[] = [];
  try {
    inputs = findAllInputControls();
  } catch (e) {
    return 0;
  }

  let filledCount = 0;
  const seenRadioFillGroups = new Set<string>();

  for (const el of inputs) {
    try {
      const inputEl = el as any;
      if (!inputEl || inputEl.readOnly || inputEl.disabled) continue;

      const isRadio =
        inputEl.type === "radio" ||
        inputEl.getAttribute?.("role") === "radio";
      if (isRadio) {
        const radioName =
          inputEl.name || inputEl.getAttribute?.("name") || "";
        const groupKey = radioName
          ? `name:${radioName}`
          : `el:${inputEl.id || Math.random()}`;
        if (seenRadioFillGroups.has(groupKey)) {
          continue;
        }
        seenRadioFillGroups.add(groupKey);
      }

      const meta = m.extractFieldMetadata(inputEl);
      if (!meta) continue;

      let matches: any[] = [];
      try {
        matches = m.findMatchingFields(meta, savedFields);
      } catch (e) {
        matches = [];
      }

      if (matches.length > 0) {
        const valueToFill = matches[0].field.value;
        const success = f.fillElement(inputEl, valueToFill, settings);
        if (success) filledCount++;
      }
    } catch (err) {
      // Continue next element
    }
  }

  return filledCount;
}

