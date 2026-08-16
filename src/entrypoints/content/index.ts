/**
 * Form Secretary - Main Content Script Coordinator (WXT)
 * Coordinates event listeners, storage cache, and runtime messaging across modules.
 */

import { defineContentScript } from "wxt/utils/define-content-script";
import type {
  DetectedPageField,
  ExtensionMessageRequest,
  ExtensionMessageResponse,
  FormSecretaryField,
  FormSecretarySettings,
  ScoredFieldMatch,
} from "../../types";
import { getFields, getSettings } from "../../shared/storage";
import { extractFieldMetadata, findMatchingFields } from "../../shared/matcher";
import { fillElement } from "../../content/filler";
import {
  bringFieldToView,
  closeDropdown,
  hideTrigger,
  highlightFocusedElement,
  initShadowHost,
  isDropdownOpen,
  isTriggerVisible,
  positionDropdown,
  positionTriggerPill,
  renderDropdown,
  showSuccessState,
  showToast,
  updatePillContent,
} from "../../content/ui";

import {
  findAllInputControls,
  fillAllMatchedFieldsOnPage,
  scanPageFields,
} from "../../content/scanner";

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  matchAboutBlank: true,
  runAt: "document_idle",
  main() {
    const win = window as any;
    try {
      document.getElementById("form-secretary-root")?.remove();
    } catch {}
    win.__FORM_SECRETARY_INJECTED__ = true;

    let currentFields: FormSecretaryField[] = [];
    let currentSettings: FormSecretarySettings = {
      enabled: true,
      showInlineButtons: true,
      showFloatingBar: false,
      theme: "system",
      highlightFilledFields: true,
      enableContextMenu: true,
      maxCharsToHideTrigger: 3,
    };

    let activeTargetElement: HTMLElement | null = null;
    let activeMatches: ScoredFieldMatch[] = [];

    function handleTriggerClick(): void {
      if (!activeTargetElement || activeMatches.length === 0) return;

      if (activeMatches.length === 1 && activeMatches[0]) {
        const match = activeMatches[0];
        fillElement(activeTargetElement, match.field.value, currentSettings);
        showSuccessState(match.field.label);
      } else {
        if (isDropdownOpen()) {
          closeDropdown();
        } else {
          renderDropdown(activeMatches, (selectedMatch) => {
            if (activeTargetElement) {
              fillElement(
                activeTargetElement,
                selectedMatch.field.value,
                currentSettings,
              );
            }
            showSuccessState(selectedMatch.field.label);
          });
          positionDropdown();
        }
      }
    }

    async function inspectElement(element: HTMLElement | null): Promise<void> {
      if (!element || (element as any).readOnly || (element as any).disabled) {
        hideTrigger();
        return;
      }

      if (!currentFields || currentFields.length === 0) {
        currentFields = (await getFields()) || [];
        currentSettings = await getSettings();
      }

      if (!currentSettings.enabled || !currentSettings.showInlineButtons) {
        hideTrigger();
        return;
      }

      const threshold =
        currentSettings.maxCharsToHideTrigger !== undefined
          ? currentSettings.maxCharsToHideTrigger
          : 3;
      const currentVal = (
        ((element as any).value !== undefined
          ? (element as any).value
          : element.textContent) || ""
      ).trim();
      if (currentVal.length >= threshold) {
        hideTrigger();
        return;
      }

      const meta = extractFieldMetadata(element);
      if (!meta) {
        hideTrigger();
        return;
      }

      const matches = findMatchingFields(meta, currentFields);
      if (matches.length === 0) {
        hideTrigger();
        return;
      }

      activeTargetElement = element;
      activeMatches = matches;

      updatePillContent(matches);
      positionTriggerPill(element);
    }

    let blurHideTimer: ReturnType<typeof setTimeout> | null = null;
    let isPointerOverShadowUI = false;

    function clearBlurHideTimer(): void {
      if (blurHideTimer) {
        clearTimeout(blurHideTimer);
        blurHideTimer = null;
      }
    }

    function scheduleBlurHide(delayMs = 1500): void {
      clearBlurHideTimer();
      blurHideTimer = setTimeout(() => {
        if (!isPointerOverShadowUI && !isDropdownOpen()) {
          const activeEl = document.activeElement;
          if (activeEl !== activeTargetElement) {
            hideTrigger();
          }
        }
      }, delayMs);
    }

    function handleElementInputOrStateChange(target: HTMLElement | null): void {
      if (!target) return;
      const tag = target.tagName ? target.tagName.toUpperCase() : "";
      const isInput =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable ||
        (target.getAttribute && target.getAttribute("role") === "textbox");
      if (!isInput) return;

      const threshold =
        currentSettings.maxCharsToHideTrigger !== undefined
          ? currentSettings.maxCharsToHideTrigger
          : 3;
      const val = (
        ((target as any).value !== undefined
          ? (target as any).value
          : target.textContent) || ""
      ).trim();

      if (val.length >= threshold) {
        hideTrigger();
      } else {
        inspectElement(target);
      }
    }

    function attachEventListeners(): void {
      // Hover tracking on shadow host to prevent hiding while interacting with UI
      const shadowHost = document.getElementById("form-secretary-root");
      if (shadowHost) {
        shadowHost.addEventListener("mouseenter", () => {
          isPointerOverShadowUI = true;
          clearBlurHideTimer();
        });
        shadowHost.addEventListener("mouseleave", () => {
          isPointerOverShadowUI = false;
          if (
            document.activeElement !== activeTargetElement &&
            !isDropdownOpen()
          ) {
            scheduleBlurHide(1000);
          }
        });
      }

      // Focus & Click delegation
      document.addEventListener(
        "focusin",
        (e) => {
          clearBlurHideTimer();
          inspectElement(e.target as HTMLElement);
        },
        true,
      );

      document.addEventListener(
        "focusout",
        (e) => {
          const target = e.target as HTMLElement;
          if (target && target === activeTargetElement) {
            scheduleBlurHide(1500);
          }
        },
        true,
      );

      document.addEventListener(
        "click",
        (e) => handleElementInputOrStateChange(e.target as HTMLElement),
        true,
      );

      // Typing, deletion, paste delegation
      document.addEventListener(
        "input",
        (e) => handleElementInputOrStateChange(e.target as HTMLElement),
        true,
      );
      document.addEventListener(
        "keyup",
        (e) => handleElementInputOrStateChange(e.target as HTMLElement),
        true,
      );
      document.addEventListener(
        "keydown",
        () => {
          setTimeout(() => {
            if (document.activeElement)
              handleElementInputOrStateChange(
                document.activeElement as HTMLElement,
              );
          }, 0);
        },
        true,
      );
      document.addEventListener(
        "change",
        (e) => handleElementInputOrStateChange(e.target as HTMLElement),
        true,
      );
      document.addEventListener(
        "cut",
        (e) =>
          setTimeout(
            () => handleElementInputOrStateChange(e.target as HTMLElement),
            20,
          ),
        true,
      );
      document.addEventListener(
        "paste",
        (e) =>
          setTimeout(
            () => handleElementInputOrStateChange(e.target as HTMLElement),
            20,
          ),
        true,
      );

      // Dismiss dropdown on outside click
      document.addEventListener("mousedown", (e) => {
        const host = document.getElementById("form-secretary-root");
        if (host && host.contains(e.target as Node)) return;
        if (
          activeTargetElement &&
          activeTargetElement.contains(e.target as Node)
        )
          return;
        closeDropdown();
      });

      // Reposition on scroll and resize only if field is active and trigger is currently visible
      window.addEventListener(
        "scroll",
        () => {
          if (
            activeTargetElement &&
            document.activeElement === activeTargetElement &&
            isTriggerVisible()
          ) {
            positionTriggerPill(activeTargetElement, false);
            if (isDropdownOpen()) positionDropdown();
          }
        },
        { passive: true },
      );

      window.addEventListener(
        "resize",
        () => {
          if (
            activeTargetElement &&
            document.activeElement === activeTargetElement &&
            isTriggerVisible()
          ) {
            positionTriggerPill(activeTargetElement, false);
          }
        },
        { passive: true },
      );

      // Re-inspect on window focus and tab visibility change (e.g. switching browser tabs)
      window.addEventListener("focus", () => {
        if (document.activeElement && document.activeElement !== document.body) {
          inspectElement(document.activeElement as HTMLElement);
        }
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          loadStorageData();
          if (document.activeElement && document.activeElement !== document.body) {
            inspectElement(document.activeElement as HTMLElement);
          }
        }
      });

      // Handle SPA route changes (React Router, Next.js, Ashby, etc.)
      const handleRouteChange = () => {
        setTimeout(() => {
          initShadowHost({ onTriggerClick: handleTriggerClick });
          if (document.activeElement && document.activeElement !== document.body) {
            inspectElement(document.activeElement as HTMLElement);
          }
        }, 150);
      };

      window.addEventListener("popstate", handleRouteChange);
      window.addEventListener("hashchange", handleRouteChange);

      try {
        const origPushState = history.pushState;
        if (origPushState && !(origPushState as any).__fs_wrapped__) {
          history.pushState = function (...args: any[]) {
            const res = origPushState.apply(this, args as any);
            handleRouteChange();
            return res;
          };
          (history.pushState as any).__fs_wrapped__ = true;
        }

        const origReplaceState = history.replaceState;
        if (origReplaceState && !(origReplaceState as any).__fs_wrapped__) {
          history.replaceState = function (...args: any[]) {
            const res = origReplaceState.apply(this, args as any);
            handleRouteChange();
            return res;
          };
          (history.replaceState as any).__fs_wrapped__ = true;
        }
      } catch (e) {}

      // MutationObserver for dynamically mounted form elements in SPAs
      let mutationDebounce: any = null;
      try {
        const observer = new MutationObserver(() => {
          if (mutationDebounce) clearTimeout(mutationDebounce);
          mutationDebounce = setTimeout(() => {
            const host = document.getElementById("form-secretary-root");
            if (!host || !host.isConnected) {
              initShadowHost({ onTriggerClick: handleTriggerClick });
            }
            if (
              activeTargetElement &&
              document.activeElement === activeTargetElement &&
              isTriggerVisible()
            ) {
              positionTriggerPill(activeTargetElement, false);
            } else if (
              document.activeElement &&
              document.activeElement !== document.body
            ) {
              inspectElement(document.activeElement as HTMLElement);
            }
          }, 150);
        });

        observer.observe(document.documentElement || document.body, {
          childList: true,
          subtree: true,
        });
      } catch (e) {}

      // Runtime messaging for popup and background
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.onMessage
      ) {
        chrome.runtime.onMessage.addListener(
          (
            request: ExtensionMessageRequest,
            sender,
            sendResponse: (res: ExtensionMessageResponse) => void,
          ) => {
            if (request.action === "GET_PAGE_FIELDS") {
              const fields = scanPageFields(currentFields);
              // If we are in a subframe/iframe and have 0 fields, do not send response
              // so the top-level main frame (or another frame containing the actual form) can answer
              if (window !== window.top && (!fields || fields.length === 0)) {
                return false;
              }
              sendResponse({ fields });
              loadStorageData();
              return true;
            } else if (request.action === "FILL_ALL_MATCHES") {
              const count = fillAllMatchedFieldsOnPage(
                currentFields,
                { extractFieldMetadata, findMatchingFields },
                { fillElement },
                currentSettings,
              );
              if (count > 0) {
                showToast(
                  `Autofilled ${count} field${count === 1 ? "" : "s"} on page`,
                );
              }
              if (window === window.top || count > 0) {
                sendResponse({ success: true, count });
              }
              return true;
            } else if (request.action === "FILL_SPECIFIC_FIELD") {
              const inputs = findAllInputControls();
              const targetInput = inputs[request.fieldIndex ?? -1];
              if (targetInput && request.value !== undefined) {
                fillElement(targetInput, request.value, currentSettings);
                sendResponse({ success: true });
              } else if (window === window.top) {
                sendResponse({ success: false });
              }
              return true;
            } else if (request.action === "FOCUS_FIELD") {
              const inputs = findAllInputControls();
              const targetInput = inputs[request.fieldIndex ?? -1] || null;
              const success = bringFieldToView(targetInput, {
                fieldName: request.fieldName,
                fieldId: request.fieldId,
                fieldLabel: request.fieldLabel,
              });
              if (targetInput) {
                inspectElement(targetInput);
              }
              if (success) {
                sendResponse({ success: true });
              } else if (window === window.top) {
                sendResponse({ success: false });
              }
              return true;
            } else if (request.action === "REFRESH_FIELDS") {

              loadStorageData().then(() => sendResponse({ success: true }));
              return true;
            }
          },
        );
      }
    }

    async function loadStorageData(): Promise<void> {
      currentFields = (await getFields()) || [];
      currentSettings = await getSettings();
    }

    async function init(): Promise<void> {
      initShadowHost({
        onTriggerClick: handleTriggerClick,
      });
      attachEventListeners();
      await loadStorageData();

      if (document.activeElement && document.activeElement !== document.body) {
        inspectElement(document.activeElement as HTMLElement);
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  },
});
