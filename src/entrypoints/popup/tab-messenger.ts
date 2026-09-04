/**
 * Form Secretary - Popup Tab Messenger
 * Handles querying active tabs, dispatching runtime messages, and auto-injecting content scripts on demand.
 */

import type {
  ExtensionMessageRequest,
  ExtensionMessageResponse,
} from "../../types";

export function getActiveBrowserTab(
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

export function notifyActiveTab(
  message: ExtensionMessageRequest,
  callback?: (response: ExtensionMessageResponse | null, tab?: chrome.tabs.Tab | null) => void,
): void {
  getActiveBrowserTab((tab) => {
    if (!tab || !tab.id) {
      if (callback) callback(null, null);
      return;
    }
    dispatchMessageToTab(tab, message, callback);
  });
}

export function dispatchMessageToTab(
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
