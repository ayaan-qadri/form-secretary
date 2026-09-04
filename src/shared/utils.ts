/**
 * Form Secretary - Shared Utility Functions
 * Safe HTML escaping, clipboard operations, toast messages, and file I/O.
 */

export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T> | undefined;
  cancel(): void;
  flush(): ReturnType<T> | undefined;
}

export function escapeHtml(str: any): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function truncateText(str: any, maxLength = 24): string {
  if (str === null || str === undefined || str === "") return "";
  const s = String(str).trim();
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength).trim() + "…";
}


export function showToast(
  element: HTMLElement | null,
  message: string,
  duration = 2200,
): void {
  if (!element) return;
  element.textContent = message;

  const el = element as any;
  if (el._toastTimer) {
    clearTimeout(el._toastTimer);
    el._toastTimer = null;
  }
  if (el._toastExitTimer) {
    clearTimeout(el._toastExitTimer);
    el._toastExitTimer = null;
  }

  element.classList.remove("closing");
  element.style.display = "block";
  // Trigger reflow to restart CSS animation
  void element.offsetWidth;
  element.classList.add("show");

  el._toastTimer = setTimeout(() => {
    element.classList.add("closing");
    el._toastExitTimer = setTimeout(() => {
      element.style.display = "none";
      element.classList.remove("show", "closing");
      el._toastTimer = null;
      el._toastExitTimer = null;
    }, 190);
  }, duration);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Strategy 1: navigator.clipboard.writeText
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Document might not be focused or permission denied, try execCommand fallback
    }
  }

  // Strategy 2: document.execCommand('copy') via temporary textarea
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "2em";
    textarea.style.height = "2em";
    textarea.style.padding = "0";
    textarea.style.border = "none";
    textarea.style.outline = "none";
    textarea.style.boxShadow = "none";
    textarea.style.background = "transparent";
    textarea.style.opacity = "0.01";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    if (textarea.focus) textarea.focus();
    if (textarea.select) textarea.select();
    if (textarea.setSelectionRange) textarea.setSelectionRange(0, text.length);
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return !!success;
  } catch (e) {
    // Fallback failed
  }

  return false;
}

export function exportJsonFile(filename: string, data: any): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function readJsonFile<T = any>(file: File | Blob): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided"));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        resolve(parsed);
      } catch (err: any) {
        reject(new Error("Invalid JSON format: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait = 300,
  immediate = false,
): DebouncedFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let result: ReturnType<T> | undefined;
  let lastContext: any;
  let lastArgs: Parameters<T> | null = null;

  const debounced = function (
    this: any,
    ...args: Parameters<T>
  ): ReturnType<T> | undefined {
    lastContext = this;
    lastArgs = args;
    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) {
        result = func.apply(lastContext, lastArgs!);
      }
    }, wait);

    if (callNow) {
      result = func.apply(lastContext, lastArgs);
    }

    return result;
  } as DebouncedFunction<T>;

  debounced.cancel = function () {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = null;
  };

  debounced.flush = function () {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
      if (!immediate && lastArgs) {
        result = func.apply(lastContext, lastArgs);
      }
    }
    return result;
  };

  return debounced;
}

/**
 * Determines whether a DOM element is visible, non-zero-sized, and interactive
 */
export function isElementVisible(element: HTMLElement | null): boolean {
  if (!element || !element.tagName) return false;

  // 1. Must be attached to document (if isConnected is supported)
  if (typeof element.isConnected === "boolean" && !element.isConnected) {
    return false;
  }

  // 2. Cannot be a template tag
  if (element.tagName === "TEMPLATE") {
    return false;
  }

  // 3. HTML hidden attribute
  if ((element as any).hidden === true) {
    return false;
  }
  if (element.getAttribute && element.getAttribute("hidden") !== null) {
    return false;
  }

  const isCheckOrRadio =
    element.tagName === "INPUT" &&
    ((element as HTMLInputElement).type === "checkbox" ||
      (element as HTMLInputElement).type === "radio");

  // 4. aria-hidden="true" on element or any ancestor
  if (element.closest) {
    try {
      const hiddenAncestor = element.closest(
        "[hidden], [aria-hidden='true'], template",
      );
      if (hiddenAncestor) return false;
    } catch (e) {}
  } else if (
    element.getAttribute &&
    element.getAttribute("aria-hidden") === "true"
  ) {
    return false;
  }

  // Helper to check if parent container is visible for custom styled / proxy controls
  const isParentContainerVisible = (): boolean => {
    if (!element.parentElement) return false;
    let curr: HTMLElement | null = element.parentElement;
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

  // 5. Inline style checks
  if (element.style) {
    if (
      element.style.display === "none" ||
      element.style.visibility === "hidden" ||
      element.style.visibility === "collapse"
    ) {
      if (isCheckOrRadio && isParentContainerVisible()) {
        return true;
      }
      return false;
    }
  }

  // 6. Computed style checks (in browser environment)
  if (typeof window !== "undefined" && window.getComputedStyle) {
    try {
      const computed = window.getComputedStyle(element);
      if (
        computed.display === "none" ||
        computed.visibility === "hidden" ||
        computed.visibility === "collapse"
      ) {
        if (isCheckOrRadio && isParentContainerVisible()) {
          return true;
        }
        return false;
      }
      if (computed.opacity === "0") {
        if (isCheckOrRadio && isParentContainerVisible()) {
          return true;
        }
        return false;
      }
      // Check clip / clip-path hiding patterns for non-checkbox/non-radio elements
      if (
        computed.clip === "rect(0px, 0px, 0px, 0px)" ||
        computed.clip === "rect(0, 0, 0, 0)" ||
        computed.clipPath === "inset(50%)" ||
        computed.clipPath === "inset(100%)"
      ) {
        if (isCheckOrRadio && isParentContainerVisible()) {
          return true;
        }
        return false;
      }
    } catch (e) {}
  }

  // 7. Bounding client rect (dimension check for 0x0 or 1x1 screen-reader / hidden utility elements)
  if (typeof element.getBoundingClientRect === "function") {
    try {
      const rect = element.getBoundingClientRect();
      if (rect && rect.width <= 1 && rect.height <= 1) {
        if (isCheckOrRadio && isParentContainerVisible()) {
          return true;
        }
        return false;
      }
    } catch (e) {}
  }

  // 8. offsetParent check (returns null if element or ancestor has display:none, unless position:fixed)
  if (
    "offsetParent" in element &&
    element.offsetParent === null &&
    element.style?.position !== "fixed" &&
    element.tagName !== "BODY" &&
    element.tagName !== "HTML"
  ) {
    if (
      typeof window === "undefined" ||
      !window.getComputedStyle ||
      window.getComputedStyle(element).position !== "fixed"
    ) {
      if (isCheckOrRadio && isParentContainerVisible()) {
        return true;
      }
      return false;
    }
  }

  return true;
}



