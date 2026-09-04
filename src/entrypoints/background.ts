/**
 * Form Secretary - Background Service Worker (WXT + Manifest V3)
 * Handles context menus, badge counts, and cross-tab actions.
 */

import { defineBackground } from "wxt/utils/define-background";
import type {
  DetectedPageField,
  ExtensionMessageRequest,
  ExtensionMessageResponse,
  FormSecretaryField,
} from "../types";
import { saveField } from "../shared/storage";

export default defineBackground(() => {
  // Initialize context menus and inject content script into existing open tabs
  chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.create({
      id: "fs_fill_page",
      title: "Autofill All Matching Fields",
      contexts: ["page", "editable"],
    });

    chrome.contextMenus.create({
      id: "fs_save_selection",
      title: 'Save "%s" to Form Secretary',
      contexts: ["selection"],
    });

    // Auto-inject content script into open tabs so users don't need to reload
    if (
      typeof chrome !== "undefined" &&
      chrome.scripting &&
      chrome.scripting.executeScript &&
      chrome.tabs &&
      chrome.tabs.query
    ) {
      try {
        const tabs = await chrome.tabs.query({
          url: ["http://*/*", "https://*/*"],
        });
        for (const tab of tabs) {
          if (
            tab.id &&
            tab.url &&
            !tab.url.startsWith("chrome://") &&
            !tab.url.startsWith("edge://") &&
            !tab.url.startsWith("about:") &&
            !tab.url.startsWith("chrome-extension://") &&
            !tab.url.startsWith("moz-extension://")
          ) {
            chrome.scripting
              .executeScript({
                target: { tabId: tab.id, allFrames: true },
                files: ["content-scripts/content.js"],
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        console.warn("[FormSecretary Background] Auto-injection warning:", err);
      }
    }
  });

  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id) return;

    if (info.menuItemId === "fs_fill_page") {
      const msg: ExtensionMessageRequest = { action: "FILL_ALL_MATCHES" };
      chrome.tabs.sendMessage(tab.id, msg, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[FormSecretary Background] Error filling page:",
            chrome.runtime.lastError,
          );
        }
      });
    } else if (info.menuItemId === "fs_save_selection" && info.selectionText) {
      const selectedText = info.selectionText;
      const label =
        "Selected: " +
        (selectedText.length > 20
          ? selectedText.substring(0, 20) + "..."
          : selectedText);

      saveField({
        label,
        value: selectedText,
        pattern: selectedText,
        matchType: "smart",
        targetProperty: "all",
        category: "Personal",
        enabled: true,
      })
        .then(() => {
          if (tab.id) {
            const refreshMsg: ExtensionMessageRequest = {
              action: "REFRESH_FIELDS",
            };
            chrome.tabs.sendMessage(tab.id, refreshMsg, () => {
              void chrome.runtime.lastError;
            });
          }
        })
        .catch((err) => {
          console.warn(
            "[FormSecretary Background] Error saving selection:",
            err,
          );
        });
    }
  });

  // Listen for tab activation to update badge count if needed
  chrome.tabs.onActivated.addListener((activeInfo) => {
    updateBadgeForTab(activeInfo.tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (
      changeInfo.status === "complete" &&
      tab.url &&
      !tab.url.startsWith("chrome://") &&
      !tab.url.startsWith("edge://") &&
      !tab.url.startsWith("about:") &&
      !tab.url.startsWith("chrome-extension://") &&
      !tab.url.startsWith("moz-extension://")
    ) {
      updateBadgeForTab(tabId);
    }
  });

  function updateBadgeForTab(tabId?: number): void {
    if (!tabId) return;

    const actionAPI =
      typeof chrome !== "undefined" && chrome.action
        ? chrome.action
        : typeof browser !== "undefined" && (browser as any).action
          ? (browser as any).action
          : (chrome as any).browserAction || null;
    if (!actionAPI) return;

    const getMsg: ExtensionMessageRequest = { action: "GET_PAGE_FIELDS" };
    chrome.tabs.sendMessage(
      tabId,
      getMsg,
      (response: ExtensionMessageResponse) => {
        if (chrome.runtime.lastError || !response || !response.fields) {
          actionAPI.setBadgeText({ text: "", tabId });
          return;
        }

        const matchedCount = response.fields.filter(
          (f: DetectedPageField) => f.matchesCount > 0,
        ).length;
        if (matchedCount > 0) {
          actionAPI.setBadgeText({ text: String(matchedCount), tabId });
          actionAPI.setBadgeBackgroundColor({ color: "#2563eb", tabId });
          if ((actionAPI as any).setBadgeTextColor) {
            (actionAPI as any).setBadgeTextColor({ color: "#ffffff", tabId });
          }
        } else {
          actionAPI.setBadgeText({ text: "", tabId });
        }
      },
    );
  }
});
