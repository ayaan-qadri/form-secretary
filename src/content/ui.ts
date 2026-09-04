/**
 * Form Secretary - Shadow DOM In-Page UI Controller
 * Manages encapsulated trigger pill and match dropdown with in-situ success feedback.
 */

import type { ScoredFieldMatch } from "../types";
import { createIconElement } from "../shared/icons";

let shadowRoot: ShadowRoot | null = null;
let triggerContainer: HTMLElement | null = null;
let dropdownContainer: HTMLElement | null = null;
let floatingBarContainer: HTMLElement | null = null;
let activeTargetElement: HTMLElement | null = null;
let successTimer: ReturnType<typeof setTimeout> | null = null;

export function createBrandLogoElement(): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "fs-trigger-logo-svg");
  svg.setAttribute("viewBox", "0 0 128 128");
  svg.setAttribute("fill", "none");

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const grad = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "linearGradient",
  );
  grad.setAttribute("id", "fs-pill-brand-grad");
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "128");
  grad.setAttribute("y2", "128");
  grad.setAttribute("gradientUnits", "userSpaceOnUse");

  const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  stop1.setAttribute("offset", "0%");
  stop1.setAttribute("stop-color", "#3b82f6");
  const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  stop2.setAttribute("offset", "100%");
  stop2.setAttribute("stop-color", "#2563eb");
  grad.appendChild(stop1);
  grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  const bgRect = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  bgRect.setAttribute("width", "128");
  bgRect.setAttribute("height", "128");
  bgRect.setAttribute("rx", "28");
  bgRect.setAttribute("fill", "url(#fs-pill-brand-grad)");
  svg.appendChild(bgRect);

  const r1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  r1.setAttribute("x", "36");
  r1.setAttribute("y", "28");
  r1.setAttribute("width", "16");
  r1.setAttribute("height", "72");
  r1.setAttribute("rx", "4");
  r1.setAttribute("fill", "#ffffff");
  svg.appendChild(r1);

  const r2 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  r2.setAttribute("x", "36");
  r2.setAttribute("y", "28");
  r2.setAttribute("width", "56");
  r2.setAttribute("height", "16");
  r2.setAttribute("rx", "4");
  r2.setAttribute("fill", "#ffffff");
  svg.appendChild(r2);

  const r3 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  r3.setAttribute("x", "36");
  r3.setAttribute("y", "56");
  r3.setAttribute("width", "42");
  r3.setAttribute("height", "14");
  r3.setAttribute("rx", "3");
  r3.setAttribute("fill", "#ffffff");
  svg.appendChild(r3);

  const sparkPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  sparkPath.setAttribute(
    "d",
    "M94 72 C94 80, 98 84, 106 84 C98 84, 94 88, 94 96 C94 88, 90 84, 82 84 C90 84, 94 80, 94 72 Z",
  );
  sparkPath.setAttribute("fill", "#34d399");
  svg.appendChild(sparkPath);

  const sparkCircle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  sparkCircle.setAttribute("cx", "104");
  sparkCircle.setAttribute("cy", "74");
  sparkCircle.setAttribute("r", "2.5");
  sparkCircle.setAttribute("fill", "#34d399");
  sparkCircle.setAttribute("fill-opacity", "0.95");
  svg.appendChild(sparkCircle);

  return svg;
}

export function initShadowHost(
  callbacks: { onTriggerClick?: () => void } = {},
) {
  let host = document.getElementById("form-secretary-root");
  const isDisconnected =
    host && typeof host.isConnected === "boolean" && !host.isConnected;
  if (!host || isDisconnected) {
    if (isDisconnected && host && host.parentElement) {
      try {
        host.remove();
      } catch (e) {}
    }
    host = document.createElement("div");
    host.id = "form-secretary-root";
    host.style.cssText =
      "position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 2147483647;";
    (document.documentElement || document.body).appendChild(host);
    shadowRoot = null;
    triggerContainer = null;
    dropdownContainer = null;
    floatingBarContainer = null;
  }

  if (!shadowRoot || !host.shadowRoot) {
    shadowRoot = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadowRoot.replaceChildren();
    injectShadowStyles(shadowRoot);
    createUIElements(shadowRoot, callbacks);
  }

  return {
    shadowRoot,
    triggerContainer,
    dropdownContainer,
    floatingBarContainer,
  };
}

export function injectShadowStyles(root: ShadowRoot): void {
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      color: #0f172a;
      box-sizing: border-box;
    }

    *, *::before, *::after {
      box-sizing: inherit;
      margin: 0;
      padding: 0;
    }

    /* Floating Trigger Pill */
    .fs-trigger-pill {
      position: absolute;
      pointer-events: auto;
      display: none;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      padding: 3px 9px 3px 5px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
      cursor: pointer;
      z-index: 2147483647;
      transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.12s ease, border-color 0.12s ease;
      user-select: none;
      animation: fs-pop-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .fs-trigger-pill:hover {
      transform: translateY(-1px) scale(1.02);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.06);
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .fs-trigger-pill:active {
      transform: translateY(0) scale(0.98);
    }

    /* In-Trigger Success Feedback State */
    .fs-trigger-pill.fs-pill-success {
      background: #ecfdf5 !important;
      border-color: #10b981 !important;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2) !important;
      pointer-events: none;
      animation: fs-success-pulse 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .fs-trigger-pill.fs-pill-success .fs-pill-text {
      color: #047857 !important;
      font-weight: 700;
    }

    .fs-icon-container {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .fs-trigger-logo-svg {
      width: 17px;
      height: 17px;
      border-radius: 4px;
      flex-shrink: 0;
      display: block;
    }

    .fs-pill-text {
      font-weight: 600;
      font-size: 11.5px;
      color: #0f172a;
      white-space: nowrap;
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: inline-block;
      line-height: 1.2;
    }

    .fs-pill-badge {
      background: #f1f5f9;
      color: #475569;
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      line-height: 1.2;
    }

    .fs-pill-arrow {
      width: 11px;
      height: 11px;
      color: #64748b;
      flex-shrink: 0;
      transition: transform 0.2s ease;
    }

    /* Dropdown Menu */
    .fs-dropdown {
      position: absolute;
      pointer-events: auto;
      display: none;
      flex-direction: column;
      width: 270px;
      max-height: 280px;
      overflow-y: auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      z-index: 2147483647;
      padding: 6px;
      animation: fs-fade-down 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .fs-dropdown-header {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      padding: 6px 8px 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .fs-dropdown-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.12s ease, transform 0.12s ease;
    }

    .fs-dropdown-item:hover {
      background: #f8fafc;
      transform: translateX(2px);
    }

    .fs-dropdown-item:active {
      transform: scale(0.98);
    }

    .fs-item-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .fs-item-label {
      font-weight: 600;
      font-size: 12px;
      color: #0f172a;
    }

    .fs-item-category {
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 5px;
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }

    .fs-item-value {
      font-size: 11px;
      color: #64748b;
      font-family: ui-monospace, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @keyframes fs-pop-in {
      0% { transform: scale(0.75); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes fs-fade-down {
      0% { opacity: 0; transform: translateY(-8px) scale(0.97); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes fs-success-pulse {
      0% { transform: scale(0.92); }
      50% { transform: scale(1.04); }
      100% { transform: scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .fs-trigger-pill, .fs-dropdown, .fs-dropdown-item, .fs-floating-bar {
        animation: none !important;
        transition: none !important;
      }
    }

    /* Floating Mass-Fill Bar */
    .fs-floating-bar {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: none;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      padding: 6px 14px 6px 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.06);
      cursor: pointer;
      z-index: 2147483646;
      transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s ease;
      user-select: none;
      font-weight: 600;
      font-size: 12px;
      color: #0f172a;
    }

    .fs-floating-bar:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .fs-floating-bar:active {
      transform: translateY(0);
    }
  `;
  root.appendChild(style);
}

export function createUIElements(
  root: ShadowRoot,
  callbacks: { onTriggerClick?: () => void } = {},
): void {
  // 1. Trigger Pill
  triggerContainer = document.createElement("div");
  triggerContainer.className = "fs-trigger-pill";
  triggerContainer.title = "Form Secretary Autofill";

  const iconContainer = document.createElement("div");
  iconContainer.className = "fs-icon-container";
  iconContainer.id = "fs-pill-icon";
  iconContainer.appendChild(createBrandLogoElement());

  const pillText = document.createElement("span");
  pillText.className = "fs-pill-text";
  pillText.textContent = "Autofill";

  const pillBadge = document.createElement("span");
  pillBadge.className = "fs-pill-badge";
  pillBadge.style.display = "none";
  pillBadge.textContent = "+1";

  const arrowIcon = createIconElement("chevron-down", {
    class: "fs-pill-arrow",
    size: 11,
    strokeWidth: 2.5,
  });

  triggerContainer.replaceChildren(
    iconContainer,
    pillText,
    pillBadge,
    arrowIcon || document.createTextNode(""),
  );

  triggerContainer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (callbacks.onTriggerClick) callbacks.onTriggerClick();
  });

  root.appendChild(triggerContainer);

  // 2. Dropdown Menu
  dropdownContainer = document.createElement("div");
  dropdownContainer.className = "fs-dropdown";
  root.appendChild(dropdownContainer);

  // 3. Floating Mass-Fill Bar
  floatingBarContainer = document.createElement("div");
  floatingBarContainer.className = "fs-floating-bar";
  root.appendChild(floatingBarContainer);
}

export function isTriggerVisible(): boolean {
  return (
    triggerContainer !== null &&
    triggerContainer.style.display !== "none" &&
    triggerContainer.style.visibility !== "hidden"
  );
}

export function positionTriggerPill(
  element: HTMLElement | null,
  forceShow = true,
): void {
  if (!element || !triggerContainer) return;
  activeTargetElement = element;

  if (
    !forceShow &&
    (triggerContainer.style.display === "none" ||
      triggerContainer.style.visibility === "hidden")
  ) {
    return;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    triggerContainer.style.display = "none";
    triggerContainer.style.visibility = "hidden";
    return;
  }

  const scrollX =
    window.scrollX || window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY =
    window.scrollY || window.pageYOffset || document.documentElement.scrollTop;

  // Show pill offscreen first to measure dimensions accurately
  triggerContainer.style.visibility = "hidden";
  triggerContainer.style.display = "flex";
  const pillWidth = triggerContainer.offsetWidth || 110;
  const pillHeight = triggerContainer.offsetHeight || 26;

  // Align directly beside where the cursor starts (field start / left edge)
  let left = scrollX + rect.left + 2;
  let top = scrollY + rect.bottom + 4;

  // Flip above field if not enough vertical room below
  if (
    rect.bottom + pillHeight + 10 > window.innerHeight &&
    rect.top - pillHeight - 4 > 0
  ) {
    top = scrollY + rect.top - pillHeight - 4;
  }

  // Keep within horizontal viewport boundaries
  left = Math.max(
    scrollX + 6,
    Math.min(scrollX + window.innerWidth - pillWidth - 10, left),
  );
  top = Math.max(scrollY + 4, top);

  triggerContainer.style.left = `${left}px`;
  triggerContainer.style.top = `${top}px`;
  triggerContainer.style.visibility = "visible";
}

export function positionDropdown(): void {
  if (!triggerContainer || !dropdownContainer) return;
  const triggerRect = triggerContainer.getBoundingClientRect();
  const scrollX =
    window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0;
  const scrollY =
    window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

  let top = scrollY + triggerRect.bottom + 4;
  let left = scrollX + triggerRect.left;

  if (
    triggerRect.bottom + 270 > window.innerHeight &&
    triggerRect.top - 270 > 0
  ) {
    top = scrollY + triggerRect.top - 270;
  }

  dropdownContainer.style.top = `${top}px`;
  dropdownContainer.style.left = `${Math.max(scrollX + 6, Math.min(scrollX + window.innerWidth - 280, left))}px`;
  dropdownContainer.style.display = "flex";
}

export function renderDropdown(
  matches: ScoredFieldMatch[] = [],
  onSelect?: (match: ScoredFieldMatch) => void,
): void {
  if (!dropdownContainer) return;
  dropdownContainer.replaceChildren();

  const header = document.createElement("div");
  header.className = "fs-dropdown-header";

  const titleSpan = document.createElement("span");
  titleSpan.textContent = `Select Match (${matches.length})`;

  const closeBtn = document.createElement("span");
  closeBtn.style.cssText =
    "cursor:pointer;display:inline-flex;align-items:center;";
  closeBtn.id = "fs-close-dd";
  closeBtn.title = "Close";
  const closeIcon = createIconElement("close", { size: 13, strokeWidth: 2.5 });
  if (closeIcon) closeBtn.appendChild(closeIcon);

  header.appendChild(titleSpan);
  header.appendChild(closeBtn);
  dropdownContainer.appendChild(header);

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dropdownContainer) dropdownContainer.style.display = "none";
  });

  matches.forEach((match) => {
    const fieldEntry = match.field;
    const item = document.createElement("div");
    item.className = "fs-dropdown-item";

    const itemHeader = document.createElement("div");
    itemHeader.className = "fs-item-header";

    const labelSpan = document.createElement("span");
    labelSpan.className = "fs-item-label";
    labelSpan.textContent = fieldEntry.label;

    const catSpan = document.createElement("span");
    catSpan.className = "fs-item-category";
    catSpan.textContent = fieldEntry.category || "General";

    itemHeader.appendChild(labelSpan);
    itemHeader.appendChild(catSpan);

    const valueDiv = document.createElement("div");
    valueDiv.className = "fs-item-value";
    valueDiv.textContent = fieldEntry.value;

    item.replaceChildren(itemHeader, valueDiv);

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onSelect) onSelect(match);
    });

    dropdownContainer?.appendChild(item);
  });
}

export function hideTrigger(): void {
  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }
  if (triggerContainer) {
    triggerContainer.classList.remove("fs-pill-success");
    triggerContainer.style.display = "none";
    triggerContainer.style.visibility = "hidden";
  }
  if (dropdownContainer && dropdownContainer.style.display !== "none") {
    dropdownContainer.style.display = "none";
  }
  activeTargetElement = null;
}

/**
 * Shows instant in-situ success confirmation right inside the trigger pill itself
 */
export function showSuccessState(label = ""): void {
  if (!triggerContainer) return;

  if (dropdownContainer) {
    dropdownContainer.style.display = "none";
  }

  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }

  const iconEl = triggerContainer.querySelector("#fs-pill-icon");
  const textEl = triggerContainer.querySelector(".fs-pill-text");
  const badgeEl = triggerContainer.querySelector(
    ".fs-pill-badge",
  ) as HTMLElement;
  const arrowEl = triggerContainer.querySelector(
    ".fs-pill-arrow",
  ) as HTMLElement;

  // Swap to success styling
  triggerContainer.classList.add("fs-pill-success");
  if (iconEl) {
    const successIcon = createIconElement("check", {
      class: "fs-trigger-success-svg",
      size: 16,
      strokeWidth: 3,
      style: "color: #10b981;",
    });
    if (successIcon) iconEl.replaceChildren(successIcon);
  }
  if (badgeEl) badgeEl.style.display = "none";
  if (arrowEl) arrowEl.style.display = "none";
  if (textEl) {
    textEl.textContent = label ? `Filled ${label}` : "Filled";
  }

  // Keep visible for a pleasant 1.2s confirmation, then smoothly hide
  successTimer = setTimeout(() => {
    hideTrigger();
  }, 1200);
}

export function showToast(message: string): void {
  const cleanMsg = (message || "")
    .replace(/^Filled:?\s*/i, "")
    .trim();
  showSuccessState(cleanMsg);
}

export function updatePillContent(matches: ScoredFieldMatch[] = []): void {
  if (!triggerContainer || matches.length === 0) return;

  triggerContainer.classList.remove("fs-pill-success");
  const iconEl = triggerContainer.querySelector("#fs-pill-icon");
  if (iconEl) iconEl.replaceChildren(createBrandLogoElement());

  const textEl = triggerContainer.querySelector(".fs-pill-text");
  const badgeEl = triggerContainer.querySelector(
    ".fs-pill-badge",
  ) as HTMLElement;
  const arrowEl = triggerContainer.querySelector(
    ".fs-pill-arrow",
  ) as HTMLElement;

  const topMatch = matches[0];
  if (!topMatch || !topMatch.field) return;
  const topField = topMatch.field;

  const displayLabel = (topField.label || topField.value || "Autofill").trim();

  if (matches.length === 1) {
    if (textEl) textEl.textContent = `Fill: ${displayLabel}`;
    triggerContainer.title = `Click to fill: ${topField.value || displayLabel}`;
    if (badgeEl) badgeEl.style.display = "none";
    if (arrowEl) arrowEl.style.display = "none";
  } else {
    if (textEl) textEl.textContent = displayLabel;
    triggerContainer.title = `${matches.length} matching fields available. Click to choose.`;
    if (badgeEl) {
      badgeEl.textContent = `+${matches.length - 1}`;
      badgeEl.style.display = "inline-block";
    }
    if (arrowEl) arrowEl.style.display = "inline-block";
  }
}

export function isDropdownOpen(): boolean {
  return !!(dropdownContainer && dropdownContainer.style.display === "flex");
}

export function closeDropdown(): void {
  if (dropdownContainer) {
    dropdownContainer.style.display = "none";
  }
}

/**
 * Highlights a focused form input with a smooth, pulsing visual beacon ring
 */
export function highlightFocusedElement(element: HTMLElement | null): void {
  if (!element) return;
  try {
    const origOutline = element.style.outline;
    const origOutlineOffset = element.style.outlineOffset;
    const origBoxShadow = element.style.boxShadow;
    const origTransition = element.style.transition;

    element.style.transition = "outline 0.2s ease, box-shadow 0.2s ease";
    element.style.outline = "3px solid #3b82f6";
    element.style.outlineOffset = "2px";
    element.style.boxShadow = "0 0 0 6px rgba(59, 130, 246, 0.28)";

    setTimeout(() => {
      element.style.outline = "3px solid #60a5fa";
      element.style.boxShadow = "0 0 0 8px rgba(96, 165, 250, 0.35)";
      setTimeout(() => {
        element.style.outline = origOutline;
        element.style.outlineOffset = origOutlineOffset;
        element.style.boxShadow = origBoxShadow;
        element.style.transition = origTransition;
      }, 1200);
    }, 400);
  } catch (e) {}
}

/**
 * Brings a form field, its label, or its parent container smoothly to the center of the viewport,
 * focuses the control (or nearest focusable child), and pulses a visual beacon highlight ring.
 */
export function bringFieldToView(
  targetElement: HTMLElement | null,
  fallbackInfo?: { fieldName?: string; fieldId?: string; fieldLabel?: string },
): boolean {
  let target = targetElement;

  if (!target && fallbackInfo && typeof document !== "undefined") {
    if (fallbackInfo.fieldId) {
      target = document.getElementById(fallbackInfo.fieldId);
    }
    if (!target && fallbackInfo.fieldName) {
      try {
        const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(fallbackInfo.fieldName) : fallbackInfo.fieldName;
        target = document.querySelector(`[name="${escaped}"]`) as HTMLElement;
      } catch (e) {}
    }
  }

  if (!target) return false;

  try {
    // Determine the most relevant visible element to scroll and highlight
    let visualElement: HTMLElement = target;

    const isHiddenByStyle =
      target.style?.display === "none" ||
      target.style?.visibility === "hidden" ||
      (target as any).hidden === true ||
      (typeof window !== "undefined" &&
        window.getComputedStyle &&
        (window.getComputedStyle(target).display === "none" ||
          window.getComputedStyle(target).visibility === "hidden"));

    const isDirectlyVisible =
      !isHiddenByStyle &&
      (target.offsetParent !== null ||
        (typeof target.getBoundingClientRect === "function" &&
          target.getBoundingClientRect().height > 0));


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

    if (!associatedLabel && typeof document !== "undefined") {
      const idVal = target.id;
      const nameVal = target.getAttribute ? target.getAttribute("name") : null;
      if (idVal) {
        try {
          const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(idVal) : idVal;
          associatedLabel = document.querySelector(`label[for="${esc}"]`) as HTMLElement;
        } catch (e) {}
      }
      if (!associatedLabel && nameVal) {
        try {
          const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(nameVal) : nameVal;
          associatedLabel = document.querySelector(`label[for="${esc}"]`) as HTMLElement;
        } catch (e) {}
      }
    }

    if (!associatedLabel && container) {
      associatedLabel = container.querySelector(
        "legend, label.ashby-application-form-question-title, [class*='question-title'], [class*='field-title'], .field-label, label",
      ) as HTMLElement;
    }

    if (!isDirectlyVisible) {
      visualElement = associatedLabel || container || target.parentElement || target;
    } else if (container && (container.tagName === "FIELDSET" || container.classList?.contains("_fieldEntry") || (target as HTMLInputElement).type === "radio")) {
      visualElement = container;
    }

    // 1. Smooth scroll to center of viewport
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

    // 2. Focus attempt
    let focused = false;
    if (!isHiddenByStyle) {
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
    }

    if (!focused && container) {
      const focusableChild = container.querySelector(
        "button, [role='button'], input:not([tabindex='-1']):not([type='hidden']), select, textarea, [tabindex='0']",
      ) as HTMLElement;
      if (focusableChild) {
        try {
          focusableChild.focus({ preventScroll: true });
          if (document.activeElement === focusableChild) focused = true;
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

    // 3. Visual pulse highlight
    highlightFocusedElement(visualElement);
    if (visualElement !== target && isDirectlyVisible) {
      highlightFocusedElement(target);
    }

    return true;
  } catch (e) {
    return false;
  }
}

export function showFloatingBar(
  count: number,
  onClick?: () => void,
): void {
  if (!floatingBarContainer || count <= 0) return;
  floatingBarContainer.replaceChildren();

  const iconWrap = document.createElement("div");
  iconWrap.className = "fs-icon-container";
  const logo = createBrandLogoElement();
  logo.style.width = "16px";
  logo.style.height = "16px";
  iconWrap.appendChild(logo);

  const textSpan = document.createElement("span");
  textSpan.textContent = `Autofill ${count} field${count === 1 ? "" : "s"}`;

  const sparkIcon = createIconElement("sparkles", {
    size: 13,
    class: "w-3.5 h-3.5 text-blue-600",
  });

  floatingBarContainer.replaceChildren(
    iconWrap,
    textSpan,
    sparkIcon || document.createTextNode(""),
  );

  floatingBarContainer.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) onClick();
  };

  floatingBarContainer.style.display = "flex";
}

export function hideFloatingBar(): void {
  if (floatingBarContainer) {
    floatingBarContainer.style.display = "none";
  }
}



