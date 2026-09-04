/**
 * Form Secretary - Conflict Resolution Modal Controller
 * Provides an interactive side-by-side diff card modal for resolving detected field value conflicts.
 */

export interface ConflictFieldItem {
  id: string;
  label: string;
  category: string;
  pattern: string;
  savedValue: string;
  newValue: string;
  currentValue: string;
  action: "override" | "keep" | "remove";
}

export interface ConflictModalElements {
  modal: HTMLElement | null;
  list: HTMLElement | null;
  subtitle: HTMLElement | null;
  btnClose?: HTMLElement | null;
  btnCancel?: HTMLElement | null;
  btnApply?: HTMLElement | null;
  btnOverrideAll?: HTMLElement | null;
  btnKeepAll?: HTMLElement | null;
}

export class ConflictModalController {
  private el: ConflictModalElements;
  private activeConflicts: ConflictFieldItem[] = [];
  private onApplyCallback:
    | ((resolved: ConflictFieldItem[]) => Promise<void>)
    | null = null;

  constructor(elements: ConflictModalElements) {
    this.el = elements;
    this.initEventListeners();
  }

  private initEventListeners(): void {
    if (this.el.btnOverrideAll) {
      this.el.btnOverrideAll.addEventListener("click", () => {
        this.activeConflicts.forEach((c) => (c.action = "override"));
        this.renderConflictCards();
      });
    }

    if (this.el.btnKeepAll) {
      this.el.btnKeepAll.addEventListener("click", () => {
        this.activeConflicts.forEach((c) => (c.action = "keep"));
        this.renderConflictCards();
      });
    }

    if (this.el.btnClose) {
      this.el.btnClose.addEventListener("click", () => this.close());
    }

    if (this.el.btnCancel) {
      this.el.btnCancel.addEventListener("click", () => this.close());
    }

    if (this.el.btnApply) {
      this.el.btnApply.addEventListener("click", async () => {
        const applyCb = this.onApplyCallback;
        const resolved = [...this.activeConflicts];
        this.close();
        if (applyCb) {
          await applyCb(resolved);
        }
      });
    }

    if (this.el.modal) {
      this.el.modal.addEventListener("mousedown", (e) => {
        if (e.target === this.el.modal) {
          this.close();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.el.modal && this.el.modal.style.display !== "none") {
        this.close();
      }
    });
  }

  public open(
    conflicts: ConflictFieldItem[],
    onApply: (resolved: ConflictFieldItem[]) => Promise<void>,
  ): void {
    this.activeConflicts = [...conflicts];
    this.onApplyCallback = onApply;

    if (this.el.subtitle) {
      this.el.subtitle.textContent = `Review ${this.activeConflicts.length} field${
        this.activeConflicts.length === 1 ? "" : "s"
      } with differing values`;
    }

    this.renderConflictCards();
    if (this.el.modal) this.el.modal.style.display = "flex";
  }

  public close(): void {
    if (this.el.modal) this.el.modal.style.display = "none";
    if (this.el.list) this.el.list.replaceChildren();
    this.activeConflicts = [];
    this.onApplyCallback = null;
  }

  public renderConflictCards(): void {
    if (!this.el.list) return;
    this.el.list.replaceChildren();

    this.activeConflicts.forEach((item) => {
      const card = document.createElement("div");
      card.className =
        "fs-conflict-card bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col gap-2 transition-all";
      card.dataset.id = item.id;

      if (item.action === "remove") {
        card.classList.add("opacity-50", "bg-slate-50");
      }

      // Row 1: Label + Category on Left, Mini Segmented Control on Right
      const topRow = document.createElement("div");
      topRow.className = "flex items-center justify-between gap-1.5 min-w-0";

      const left = document.createElement("div");
      left.className = "flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden";

      const title = document.createElement("span");
      title.className = "text-xs font-bold text-slate-900 truncate min-w-0 flex-1";
      title.title = item.label;
      title.textContent = item.label;
      left.appendChild(title);

      const catBadge = document.createElement("span");
      catBadge.className =
        "text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0 max-w-[80px] truncate";
      catBadge.textContent = item.category;
      catBadge.title = item.category;
      left.appendChild(catBadge);

      topRow.appendChild(left);

      // Segmented Control: [ Override | Keep | Skip ]
      const actionsBar = document.createElement("div");
      actionsBar.className =
        "flex items-center bg-slate-100 p-0.5 rounded-lg shrink-0 gap-0.5 border border-slate-200/60";

      const btnOverride = document.createElement("button");
      btnOverride.type = "button";
      btnOverride.className = `fs-conflict-btn-override px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all border-none cursor-pointer ${
        item.action === "override"
          ? "bg-blue-600 text-white shadow-2xs"
          : "bg-transparent text-slate-600 hover:text-slate-900"
      }`;
      btnOverride.textContent = "Override";
      btnOverride.addEventListener("click", () => {
        item.action = "override";
        this.renderConflictCards();
      });

      const btnKeep = document.createElement("button");
      btnKeep.type = "button";
      btnKeep.className = `fs-conflict-btn-keep px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all border-none cursor-pointer ${
        item.action === "keep"
          ? "bg-slate-700 text-white shadow-2xs"
          : "bg-transparent text-slate-600 hover:text-slate-900"
      }`;
      btnKeep.textContent = "Keep";
      btnKeep.addEventListener("click", () => {
        item.action = "keep";
        this.renderConflictCards();
      });

      const btnSkip = document.createElement("button");
      btnSkip.type = "button";
      btnSkip.className = `fs-conflict-btn-skip px-1.5 py-0.5 text-[10px] font-semibold rounded-md transition-all border-none cursor-pointer ${
        item.action === "remove"
          ? "bg-rose-600 text-white shadow-2xs"
          : "bg-transparent text-slate-400 hover:text-rose-600"
      }`;
      btnSkip.textContent = "Skip";
      btnSkip.title = "Skip / Remove from saving";
      btnSkip.addEventListener("click", () => {
        item.action = item.action === "remove" ? "override" : "remove";
        this.renderConflictCards();
      });

      actionsBar.appendChild(btnOverride);
      actionsBar.appendChild(btnKeep);
      actionsBar.appendChild(btnSkip);
      topRow.appendChild(actionsBar);

      // Row 2: Saved Value
      const savedBox = document.createElement("div");
      savedBox.className =
        "flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200/80 rounded-lg min-w-0 w-full overflow-hidden";
      savedBox.title = item.savedValue;
      const savedTag = document.createElement("span");
      savedTag.className =
        "text-[9px] font-bold text-slate-400 uppercase shrink-0";
      savedTag.textContent = "Saved:";
      const savedVal = document.createElement("span");
      savedVal.className =
        "text-[11px] text-slate-600 truncate flex-1 min-w-0 font-mono select-all";
      savedVal.textContent = item.savedValue;
      savedVal.title = item.savedValue;
      savedBox.appendChild(savedTag);
      savedBox.appendChild(savedVal);

      // Row 3: New / Editable Value Input
      const editBox = document.createElement("div");
      editBox.className = "relative flex items-center min-w-0 w-full";
      const editInput = document.createElement("input");
      editInput.type = "text";
      editInput.className =
        "fs-conflict-input w-full min-w-0 h-7 px-2.5 text-xs bg-white border border-blue-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono transition-all placeholder-slate-400";
      editInput.value = item.currentValue;
      editInput.placeholder = "New value...";
      editInput.dataset.id = item.id;
      editInput.title = item.currentValue;
      editInput.disabled = item.action === "remove";
      editInput.addEventListener("input", () => {
        item.currentValue = editInput.value;
        editInput.title = editInput.value;
      });
      editBox.appendChild(editInput);

      card.appendChild(topRow);
      card.appendChild(savedBox);
      card.appendChild(editBox);

      this.el.list?.appendChild(card);
    });
  }
}
