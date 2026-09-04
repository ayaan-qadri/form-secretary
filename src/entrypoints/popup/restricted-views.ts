/**
 * Form Secretary - Restricted Page State Views
 * Renders user-friendly explanatory cards for restricted domains (AMO, file://, chrome://, disconnected).
 */

import { copyToClipboard } from "../../shared/utils";
import { createIconElement } from "../../shared/icons";

export interface RestrictedViewContext {
  showToast: (msg: string) => void;
  switchToTab: (tabName: string) => void;
  scanActiveTab: () => Promise<void>;
  pageFieldsCount?: HTMLElement | null;
  scannerBadge?: HTMLElement | null;
  scannerActionsBar?: HTMLElement | null;
  scannerFilterBar?: HTMLElement | null;
}

export function renderRestrictedPageState(
  container: HTMLElement,
  tab: chrome.tabs.Tab | null,
  reason: "amo" | "restricted" | "file" | "disconnected",
  ctx: RestrictedViewContext,
): void {
  container.replaceChildren();

  const card = document.createElement("div");
  card.className =
    "p-4 bg-white border border-slate-200/90 rounded-xl flex flex-col gap-3 shadow-2xs text-left select-text";

  const header = document.createElement("div");
  header.className = "flex items-start gap-2.5";

  const icon = createIconElement(
    reason === "file"
      ? "warning"
      : reason === "disconnected"
        ? "connect"
        : "help",
    {
      size: 18,
      class:
        reason === "file"
          ? "text-amber-500 shrink-0 mt-0.5"
          : "text-blue-600 shrink-0 mt-0.5",
    },
  );
  if (icon) header.appendChild(icon);

  const titleCol = document.createElement("div");
  titleCol.className = "flex flex-col gap-0.5 flex-1";

  const titleH4 = document.createElement("h4");
  titleH4.className = "text-xs font-semibold text-slate-800 select-text";
  titleH4.textContent =
    reason === "amo"
      ? "Firefox Protected Page (AMO)"
      : reason === "restricted"
        ? "Browser Protected Page"
        : reason === "file"
          ? "Local File Access Required"
          : "Page Not Connected";
  titleCol.appendChild(titleH4);

  const descP = document.createElement("p");
  descP.className = "text-[11.5px] text-slate-500 leading-normal select-text";
  descP.textContent =
    reason === "amo"
      ? "Firefox restricts all browser extensions from running on addons.mozilla.org by default for security."
      : reason === "restricted"
        ? "Browser security policies prevent extensions from interacting with internal browser and web store pages."
        : reason === "file"
          ? "Browser security restricts extensions from accessing local file:/// URLs by default."
          : "The extension could not establish a connection to this page.";
  titleCol.appendChild(descP);
  header.appendChild(titleCol);
  card.appendChild(header);

  const noteP = document.createElement("p");
  noteP.className = "text-[11.5px] text-slate-600 leading-normal select-text";
  noteP.textContent =
    "Browser security restrictions block automated form scanning and 1-click clipboard actions on this page. You can open your Fields Manager in a separate tab, or manually highlight and copy values (Ctrl+C) from My Fields.";
  card.appendChild(noteP);

  if (reason === "amo") {
    const amoBox = document.createElement("div");
    amoBox.className =
      "p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2 text-[11px] text-slate-600 leading-relaxed select-text";

    const amoTitle = document.createElement("div");
    amoTitle.className = "font-medium text-slate-700 select-text";
    amoTitle.textContent =
      "To allow extension access on Mozilla Add-ons Hub:";
    amoBox.appendChild(amoTitle);

    const createClickableBadge = (textToCopy: string, displayLabel?: string) => {
      const codeEl = document.createElement("code");
      codeEl.className =
        "font-mono text-blue-600 bg-blue-50/90 hover:bg-blue-100 hover:text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer select-all transition-all inline-flex items-center gap-1 font-medium text-[10.5px] break-all shadow-2xs";
      codeEl.title = `Click to copy or select: "${textToCopy}"`;
      codeEl.textContent = displayLabel || textToCopy;

      codeEl.addEventListener("click", async (e) => {
        e.stopPropagation();
        await copyToClipboard(textToCopy);
        ctx.showToast(`Copied ${textToCopy} to clipboard`);
        const originalText = displayLabel || textToCopy;
        codeEl.className =
          "font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-400 cursor-pointer select-all transition-all inline-flex items-center gap-1 font-bold text-[10.5px] break-all shadow-xs";
        codeEl.textContent = `Copied!`;

        setTimeout(() => {
          codeEl.className =
            "font-mono text-blue-600 bg-blue-50/90 hover:bg-blue-100 hover:text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer select-all transition-all inline-flex items-center gap-1 font-medium text-[10.5px] break-all shadow-2xs";
          codeEl.textContent = originalText;
        }, 1400);
      });

      return codeEl;
    };

    const step1 = document.createElement("div");
    step1.className = "text-[11px] leading-relaxed select-text";
    step1.appendChild(document.createTextNode("1. Open "));
    step1.appendChild(createClickableBadge("about:config"));
    step1.appendChild(document.createTextNode(" in Firefox."));
    amoBox.appendChild(step1);

    const step2 = document.createElement("div");
    step2.className =
      "text-[11px] leading-relaxed flex flex-wrap items-center gap-1 select-text";
    step2.appendChild(document.createTextNode("2. Search:"));
    step2.appendChild(
      createClickableBadge("extensions.webextensions.restrictedDomains"),
    );
    amoBox.appendChild(step2);

    const step3 = document.createElement("div");
    step3.className = "text-[11px] text-slate-500 leading-relaxed select-text";
    step3.textContent =
      "3. Remove addons.mozilla.org from the list, then reload this page.";
    amoBox.appendChild(step3);

    card.appendChild(amoBox);
  }

  const actionsRow = document.createElement("div");
  actionsRow.className =
    "flex items-center gap-2 pt-1 border-t border-slate-100";

  const btnGoMyFields = document.createElement("button");
  btnGoMyFields.className =
    "px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5 border-none";
  const listIcon = createIconElement("fields", { size: 13 });
  if (listIcon) btnGoMyFields.appendChild(listIcon);
  const myFieldsSpan = document.createElement("span");
  myFieldsSpan.textContent = "Go to My Fields";
  btnGoMyFields.appendChild(myFieldsSpan);
  btnGoMyFields.addEventListener("click", () => {
    ctx.switchToTab("rules");
  });
  actionsRow.appendChild(btnGoMyFields);

  if (reason === "amo" || reason === "restricted") {
    const btnOpenManager = document.createElement("button");
    btnOpenManager.className =
      "px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-slate-200 inline-flex items-center gap-1.5";
    const extIcon = createIconElement("export", { size: 13 });
    if (extIcon) btnOpenManager.appendChild(extIcon);
    const managerSpan = document.createElement("span");
    managerSpan.textContent = "Open in New Tab";
    btnOpenManager.appendChild(managerSpan);
    btnOpenManager.title = "Open Fields Manager in a dedicated browser tab";
    btnOpenManager.addEventListener("click", () => {
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.openOptionsPage
      ) {
        chrome.runtime.openOptionsPage();
      } else if (
        typeof chrome !== "undefined" &&
        chrome.tabs &&
        chrome.tabs.create
      ) {
        chrome.tabs.create({
          url: chrome.runtime.getURL("options.html"),
        });
      } else {
        window.open("options.html", "_blank");
      }
    });
    actionsRow.appendChild(btnOpenManager);
  }

  if (reason === "file") {
    const btnOpenExt = document.createElement("button");
    btnOpenExt.className =
      "px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-slate-200 inline-flex items-center gap-1.5";
    const settIcon = createIconElement("settings", { size: 13 });
    if (settIcon) btnOpenExt.appendChild(settIcon);
    const span = document.createElement("span");
    span.textContent = "Extension Details";
    btnOpenExt.appendChild(span);
    btnOpenExt.addEventListener("click", () => {
      const extId =
        typeof chrome !== "undefined" && chrome.runtime?.id
          ? chrome.runtime.id
          : "";
      if (typeof chrome !== "undefined" && chrome.tabs?.create) {
        chrome.tabs.create({ url: `chrome://extensions/?id=${extId}` });
      }
    });
    actionsRow.appendChild(btnOpenExt);
  } else if (reason === "disconnected" && tab && tab.id) {
    const btnConn = document.createElement("button");
    btnConn.className =
      "px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-slate-200 inline-flex items-center gap-1.5";
    const connIcon = createIconElement("connect", { size: 13 });
    if (connIcon) btnConn.appendChild(connIcon);
    const connSpan = document.createElement("span");
    connSpan.textContent = "Try Connecting";
    btnConn.appendChild(connSpan);
    btnConn.addEventListener("click", async () => {
      btnConn.textContent = "Connecting...";
      (btnConn as HTMLButtonElement).disabled = true;
      if (
        typeof chrome !== "undefined" &&
        chrome.scripting &&
        chrome.scripting.executeScript &&
        tab.id !== undefined
      ) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content-scripts/content.js"],
          });
        } catch (e) {}
      }
      setTimeout(() => ctx.scanActiveTab(), 100);
    });
    actionsRow.appendChild(btnConn);
  }

  card.appendChild(actionsRow);
  container.appendChild(card);

  if (ctx.pageFieldsCount) ctx.pageFieldsCount.textContent = "0";
  if (ctx.scannerBadge) ctx.scannerBadge.style.display = "none";
  if (ctx.scannerActionsBar) ctx.scannerActionsBar.style.display = "none";
  if (ctx.scannerFilterBar) ctx.scannerFilterBar.style.display = "none";
}
