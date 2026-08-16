/**
 * Form Secretary - Test DOM & Chrome API Simulation Helper
 * Provides a lightweight, high-fidelity DOM and WebExtension environment for Node.js native test runner.
 */

export class MockDOMTokenList {
  constructor(element) {
    this.element = element;
    this._tokens = new Set();
  }

  add(...tokens) {
    tokens.forEach((t) => {
      if (t) this._tokens.add(t);
    });
    this._sync();
  }

  remove(...tokens) {
    tokens.forEach((t) => this._tokens.delete(t));
    this._sync();
  }

  toggle(token, force) {
    if (force !== undefined) {
      if (force) this._tokens.add(token);
      else this._tokens.delete(token);
    } else {
      if (this._tokens.has(token)) this._tokens.delete(token);
      else this._tokens.add(token);
    }
    this._sync();
    return this._tokens.has(token);
  }

  contains(token) {
    return this._tokens.has(token);
  }

  _sync() {
    this.element.className = Array.from(this._tokens).join(" ");
  }

  _fromClassName(className) {
    this._tokens.clear();
    if (className) {
      className
        .split(/\s+/)
        .filter(Boolean)
        .forEach((t) => this._tokens.add(t));
    }
  }
}

export class MockElement {
  constructor(tagName = "div", ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.ownerDocument = ownerDocument;
    this.attributes = {};
    this.children = [];
    this.parentElement = null;
    this.eventListeners = {};
    this.style = {};
    this.dataset = {};
    this._classList = new MockDOMTokenList(this);
    this._value = "";
    this._innerText = "";
    this._textContent = "";
    this._innerHTML = "";
    this.shadowRoot = null;
    this.id = "";
    this.name = "";
    this.title = "";
    this.type = "text";
    this.placeholder = "";
    this.disabled = false;
    this.readOnly = false;
    this.isContentEditable = false;
    this.checked = false;
    this.selected = false;
    this.selectedIndex = 0;
    this.options = [];
    this.labels = [];
    this.download = "";
    this.href = "";
  }

  get classList() {
    return this._classList;
  }

  get className() {
    return Array.from(this._classList._tokens).join(" ");
  }

  set className(val) {
    this._classList._fromClassName(val);
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._value = String(val);
  }

  get textContent() {
    if (this._textContent) return this._textContent;
    if (this._innerText) return this._innerText;
    if (this._innerHTML) {
      return this._innerHTML.replace(/<[^>]*>/g, "");
    }
    return this.children.map((c) => c.textContent || "").join(" ");
  }

  set textContent(val) {
    this._textContent = String(val);
    this._innerText = String(val);
  }

  get innerText() {
    if (this._innerText) return this._innerText;
    if (this._textContent) return this._textContent;
    if (this._innerHTML) {
      return this._innerHTML.replace(/<[^>]*>/g, "");
    }
    return this.children.map((c) => c.innerText || "").join(" ");
  }

  set innerText(val) {
    this._innerText = String(val);
    this._textContent = String(val);
  }

  get text() {
    return this.innerText || this.textContent || this.value || "";
  }

  set text(val) {
    this.innerText = String(val);
  }

  get innerHTML() {
    if (this._innerHTML) return this._innerHTML;
    if (this.children.length > 0) {
      return this.children
        .map((c) => {
          if (c.tagName === "#TEXT") return c.textContent || "";
          const tag = (c.tagName || "div").toLowerCase();
          return `<${tag}>${c.innerHTML || c.textContent || ""}</${tag}>`;
        })
        .join("");
    }
    return "";
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    if (!html) return;
    parseSimpleHTML(html, this);
  }

  get offsetWidth() {
    return 100;
  }

  get offsetHeight() {
    return 28;
  }

  get previousElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return idx > 0 ? siblings[idx - 1] : null;
  }

  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  }

  setAttribute(name, value) {
    const strVal = String(value);
    this.attributes[name] = strVal;
    if (name === "id") this.id = strVal;
    if (name === "name") this.name = strVal;
    if (name === "class") this.className = strVal;
    if (name === "type") this.type = strVal;
    if (name === "placeholder") this.placeholder = strVal;
    if (name === "title") this.title = strVal;
    if (name === "download") this.download = strVal;
    if (name === "href") this.href = strVal;
    if (name === "value") this._value = strVal;
    if (name === "checked") this.checked = true;
    if (name.startsWith("data-")) {
      const camelKey = name
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[camelKey] = strVal;
    }
  }

  getAttribute(name) {
    if (this.attributes[name] !== undefined) return this.attributes[name];
    if (name === "type" && this.type) return this.type;
    if (name === "id" && this.id) return this.id;
    if (name === "name" && this.name) return this.name;
    if (name === "placeholder" && this.placeholder) return this.placeholder;
    if (
      name === "contenteditable" &&
      (this.isContentEditable ||
        this.attributes["contenteditable"] !== undefined)
    ) {
      return this.attributes["contenteditable"] !== undefined
        ? this.attributes["contenteditable"]
        : "true";
    }
    return null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === "id") this.id = "";
    if (name === "name") this.name = "";
    if (name === "class") this.className = "";
    if (name === "value") this._value = "";
    if (name === "checked") this.checked = false;
  }

  hasAttribute(name) {
    return this.attributes[name] !== undefined;
  }

  appendChild(child) {
    if (!child) return null;
    if (child.parentElement) {
      child.parentElement.removeChild(child);
    }
    child.parentElement = this;
    const doc = this.ownerDocument || (this.tagName === "HTML" ? this : null);
    const setOwnerDoc = (el, d) => {
      if (!el) return;
      el.ownerDocument = d;
      if (el.children) {
        for (const c of el.children) setOwnerDoc(c, d);
      }
    };
    setOwnerDoc(child, doc);
    this.children.push(child);
    if (this.tagName === "SELECT" && child.tagName === "OPTION") {
      this.options.push(child);
    }
    return child;
  }

  replaceChildren(...newChildren) {
    while (this.children.length > 0) {
      this.removeChild(this.children[0]);
    }
    for (const child of newChildren) {
      if (!child) continue;
      if (typeof child === "string") {
        const textNode = new MockElement("#text", this.ownerDocument);
        textNode.textContent = child;
        this.appendChild(textNode);
      } else {
        this.appendChild(child);
      }
    }
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    if (this.tagName === "SELECT") {
      const optIdx = this.options.indexOf(child);
      if (optIdx !== -1) this.options.splice(optIdx, 1);
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  contains(other) {
    if (!other) return false;
    if (other === this) return true;
    let curr = other.parentElement;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentElement;
    }
    return false;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (matchesSelector(curr, selector)) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  querySelectorAll(selector) {
    const matched = [];
    function traverse(node) {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) {
          matched.push(child);
        }
        traverse(child);
      }
    }
    traverse(this);
    return matched;
  }

  getElementById(id) {
    let found = null;
    function traverse(node) {
      if (found) return;
      for (const child of node.children) {
        if (child.id === id) {
          found = child;
          return;
        }
        traverse(child);
      }
    }
    traverse(this);
    return found;
  }

  getElementsByTagName(tagName) {
    const tag = tagName.toUpperCase();
    const results = [];
    function traverse(node) {
      for (const child of node.children) {
        if (tag === "*" || child.tagName === tag) {
          results.push(child);
        }
        traverse(child);
      }
    }
    traverse(this);
    return results;
  }

  getElementsByClassName(className) {
    const results = [];
    function traverse(node) {
      for (const child of node.children) {
        if (child.classList.contains(className)) {
          results.push(child);
        }
        traverse(child);
      }
    }
    traverse(this);
    return results;
  }

  attachShadow(options) {
    this.shadowRoot = new MockElement("#shadow-root", this.ownerDocument);
    this.shadowRoot.host = this;
    return this.shadowRoot;
  }

  getBoundingClientRect() {
    if (this.style?.display === "none" || this.hidden) {
      return {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
      };
    }
    return {
      top: 100,
      left: 100,
      bottom: 130,
      right: 300,
      width: 200,
      height: 30,
      x: 100,
      y: 100,
    };
  }


  addEventListener(type, listener, options) {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push({ listener, options });
  }

  removeEventListener(type, listener) {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter(
      (l) => l.listener !== listener,
    );
  }

  dispatchEvent(event) {
    if (!event) return true;
    if (!event.target) event.target = this;
    event.currentTarget = this;

    // Trigger local listeners
    const listeners = (this.eventListeners[event.type] || []).slice();
    for (const { listener } of listeners) {
      try {
        listener.call(this, event);
      } catch (err) {
        console.error("Error in mock event listener:", err);
      }
    }

    // Bubbling
    if (event.bubbles && this.parentElement) {
      this.parentElement.dispatchEvent(event);
    }
    return !event.defaultPrevented;
  }

  scrollIntoView(options) {
    this._scrolledIntoView = true;
    this._scrollOptions = options;
  }

  focus() {
    if (this.style?.display === "none" || this.hidden) {
      return;
    }
    const doc = this.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (doc) {
      doc.activeElement = this;
    }
    this.dispatchEvent(new MockEvent("focus", { bubbles: true }));
  }



  blur() {
    if (this.ownerDocument && this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = this.ownerDocument.body;
    }
    this.dispatchEvent(new MockEvent("blur", { bubbles: true }));
  }

  click() {
    this.dispatchEvent(new MockMouseEvent("click", { bubbles: true }));
  }

  select() {
    this.dispatchEvent(new MockEvent("select", { bubbles: true }));
  }

  reset() {
    if (this.tagName === "FORM") {
      const inputs = this.querySelectorAll("input, select, textarea");
      inputs.forEach((input) => {
        if (input.type === "checkbox" || input.type === "radio") {
          input.checked = false;
        } else {
          input.value = "";
        }
      });
    }
  }

  cloneNode(deep = false) {
    const clone = new MockElement(this.tagName, this.ownerDocument);
    clone.id = this.id;
    clone.name = this.name;
    clone.type = this.type;
    clone.className = this.className;
    clone.placeholder = this.placeholder;
    clone.attributes = { ...this.attributes };
    clone.dataset = { ...this.dataset };
    clone._value = this._value;
    clone._innerText = this._innerText;
    clone._textContent = this._textContent;
    clone._innerHTML = this._innerHTML;

    if (deep) {
      for (const child of this.children) {
        clone.appendChild(child.cloneNode(true));
      }
    }
    return clone;
  }
}

export class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles || false;
    this.cancelable = options.cancelable || false;
    this.composed = options.composed || false;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {}
  stopImmediatePropagation() {}
}

export class MockKeyboardEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.key = options.key || "";
    this.code = options.code || "";
    this.ctrlKey = options.ctrlKey || false;
    this.shiftKey = options.shiftKey || false;
    this.altKey = options.altKey || false;
    this.metaKey = options.metaKey || false;
  }
}

export class MockMouseEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.clientX = options.clientX || 0;
    this.clientY = options.clientY || 0;
    this.button = options.button || 0;
  }
}

export class MockCustomEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.detail = options.detail !== undefined ? options.detail : null;
  }
}

export class MockFileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.result = null;
  }

  readAsText(file) {
    setTimeout(() => {
      if (!file || file._forceError) {
        if (this.onerror) this.onerror(new Error("Failed to read file"));
      } else {
        this.result =
          file._content !== undefined
            ? file._content
            : typeof file === "string"
              ? file
              : JSON.stringify(file);
        if (this.onload) this.onload({ target: { result: this.result } });
      }
    }, 10);
  }
}

export class MockBlob {
  constructor(chunks = [], options = {}) {
    this.chunks = chunks;
    this.type = options.type || "";
    this.size = chunks.reduce((acc, c) => acc + (c ? String(c).length : 0), 0);
  }
}

function matchesSingleSelector(element, selector) {
  if (!selector || !element) return false;
  let sel = selector.trim();

  // Check :not(...)
  while (sel.includes(":not(")) {
    const notMatch = sel.match(/:not\(([^)]+)\)/);
    if (!notMatch) break;
    const inner = notMatch[1];
    if (matchesSingleSelector(element, inner)) return false;
    sel = sel.replace(notMatch[0], "");
  }

  if (!sel) return true;

  // Extract ID if any: #some-id
  const idMatch = sel.match(/#([a-zA-Z0-9_\-]+)/);
  if (idMatch) {
    if (element.id !== idMatch[1]) return false;
    sel = sel.replace(idMatch[0], "");
  }

  // Extract all classes: .cls1.cls2
  const classMatches = sel.match(/\.([a-zA-Z0-9_\-]+)/g);
  if (classMatches) {
    for (const cm of classMatches) {
      const cls = cm.slice(1);
      if (!element.classList.contains(cls)) return false;
      sel = sel.replace(cm, "");
    }
  }

  // Extract all attribute selectors: [attr=val], [attr*=val], [attr^=val], [attr$=val], or [attr]
  const attrMatches = sel.match(
    /\[([a-zA-Z0-9_\-]+)(?:([*^$]?=)([\"']?)(.*?)\3)?\]/g,
  );
  if (attrMatches) {
    for (const am of attrMatches) {
      const m = am.match(
        /^\[([a-zA-Z0-9_\-]+)(?:([*^$]?=)([\"']?)(.*?)\3)?\]$/,
      );
      if (m) {
        const attrName = m[1];
        const op = m[2];
        const attrVal = m[4];
        const actual =
          attrName === "class"
            ? element.className
            : element.getAttribute(attrName);
        if (actual === null || actual === undefined) return false;
        if (op === "=") {
          if (String(actual) !== attrVal) return false;
        } else if (op === "*=") {
          if (!String(actual).includes(attrVal)) return false;
        } else if (op === "^=") {
          if (!String(actual).startsWith(attrVal)) return false;
        } else if (op === "$=") {
          if (!String(actual).endsWith(attrVal)) return false;
        }
      }
      sel = sel.replace(am, "");
    }
  }


  // What remains (if anything) should be tag name
  sel = sel.trim();
  if (sel && sel !== "*") {
    if (element.tagName !== sel.toUpperCase()) return false;
  }

  return true;
}

function matchesSelector(element, selector) {
  if (!selector || !element) return false;
  if (selector.includes(",")) {
    return selector
      .split(",")
      .some((part) => matchesSelector(element, part.trim()));
  }

  const parts = selector.trim().split(/\s+/);
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    if (!matchesSingleSelector(element, lastPart)) return false;
    let curr = element.parentElement;
    for (let i = parts.length - 2; i >= 0; i--) {
      const ancestorPart = parts[i];
      let matched = false;
      while (curr) {
        if (matchesSingleSelector(curr, ancestorPart)) {
          matched = true;
          curr = curr.parentElement;
          break;
        }
        curr = curr.parentElement;
      }
      if (!matched) return false;
    }
    return true;
  }

  return matchesSingleSelector(element, selector);
}

function parseSimpleHTML(html, parentElement) {
  let pos = 0;
  while (pos < html.length) {
    const nextTagOpen = html.indexOf("<", pos);
    if (nextTagOpen === -1) {
      const text = html.slice(pos).trim();
      if (text) {
        parentElement.textContent = (parentElement.textContent ? parentElement.textContent + " " : "") + text;
      }
      break;
    }

    if (nextTagOpen > pos) {
      const text = html.slice(pos, nextTagOpen).trim();
      if (text) {
        // text between tags
      }
    }

    const tagClose = html.indexOf(">", nextTagOpen);
    if (tagClose === -1) break;

    const tagHeader = html.slice(nextTagOpen + 1, tagClose).trim();
    if (tagHeader.startsWith("/")) {
      pos = tagClose + 1;
      continue;
    }

    const isSelfClosing =
      tagHeader.endsWith("/") ||
      /^(input|img|br|hr|meta|link)$/i.test(tagHeader.split(/\s+/)[0]);
    const cleanHeader = tagHeader.endsWith("/")
      ? tagHeader.slice(0, -1).trim()
      : tagHeader;
    const tagNameMatch = cleanHeader.match(/^([a-zA-Z0-9_-]+)/);
    if (!tagNameMatch) {
      pos = tagClose + 1;
      continue;
    }
    const tagName = tagNameMatch[1];
    const rawAttrs = cleanHeader.slice(tagName.length);

    const el = new MockElement(tagName, parentElement.ownerDocument);
    const attrRegex = /([a-zA-Z0-9_-]+)(?:=([\"'])(.*?)\2)?/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      el.setAttribute(
        attrMatch[1],
        attrMatch[3] !== undefined ? attrMatch[3] : "",
      );
    }

    parentElement.appendChild(el);

    if (isSelfClosing) {
      pos = tagClose + 1;
      continue;
    }

    let searchPos = tagClose + 1;
    let depth = 1;
    const openPattern = new RegExp(`<${tagName}\\b`, "i");
    const closePattern = new RegExp(`</${tagName}>`, "i");

    while (depth > 0 && searchPos < html.length) {
      const nextOpen = html.slice(searchPos).search(openPattern);
      const nextClose = html.slice(searchPos).search(closePattern);

      if (nextClose === -1) {
        break;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        searchPos = searchPos + nextOpen + tagName.length + 1;
      } else {
        depth--;
        if (depth === 0) {
          const endPos = searchPos + nextClose;
          const inner = html.slice(tagClose + 1, endPos);
          if (inner.includes("<")) {
            parseSimpleHTML(inner, el);
          } else if (inner.trim()) {
            el.textContent = inner.trim();
          }
          pos = endPos + tagName.length + 3;
          break;
        }
        searchPos = searchPos + nextClose + tagName.length + 3;
      }
    }

    if (depth > 0) {
      pos = tagClose + 1;
    }
  }
}

export function createMockDocument() {
  const doc = new MockElement("#document");
  const html = new MockElement("html", doc);
  const head = new MockElement("head", doc);
  const body = new MockElement("body", doc);

  doc.ownerDocument = doc;
  doc.documentElement = html;
  doc.head = head;
  doc.body = body;
  doc.activeElement = body;

  html.appendChild(head);
  html.appendChild(body);
  doc.appendChild(html);

  doc.createElement = (tagName) => {
    return new MockElement(tagName, doc);
  };

  doc.createElementNS = (ns, tagName) => {
    return new MockElement(tagName, doc);
  };

  doc.createTextNode = (text) => {
    const node = new MockElement("#text", doc);
    node.textContent = String(text);
    return node;
  };

  doc.getElementById = (id) => {
    return doc.documentElement.getElementById(id);
  };

  doc.querySelector = (selector) => {
    return doc.documentElement.querySelector(selector);
  };

  doc.querySelectorAll = (selector) => {
    return doc.documentElement.querySelectorAll(selector);
  };

  doc.getElementsByTagName = (tagName) => {
    return doc.documentElement.getElementsByTagName(tagName);
  };

  doc.getElementsByClassName = (className) => {
    return doc.documentElement.getElementsByClassName(className);
  };

  doc.execCommand = (command) => {
    return true;
  };

  return doc;
}

export function createMockChrome() {
  const store = {};
  const messageListeners = [];
  const tabActivatedListeners = [];
  const tabUpdatedListeners = [];
  const installListeners = [];
  const contextMenuClickListeners = [];
  const menus = {};

  return {
    _store: store,
    _messageListeners: messageListeners,
    _tabActivatedListeners: tabActivatedListeners,
    _tabUpdatedListeners: tabUpdatedListeners,
    _installListeners: installListeners,
    _contextMenuClickListeners: contextMenuClickListeners,
    _menus: menus,

    runtime: {
      lastError: null,
      onInstalled: {
        addListener(cb) {
          installListeners.push(cb);
        },
      },
      onMessage: {
        addListener(cb) {
          messageListeners.push(cb);
        },
      },
      sendMessage(msg, cb) {
        for (const listener of messageListeners) {
          listener(msg, {}, (res) => {
            if (cb) cb(res);
          });
        }
      },
    },

    storage: {
      local: {
        get(keys, cb) {
          const result = {};
          if (Array.isArray(keys)) {
            keys.forEach((k) => {
              if (store[k] !== undefined) result[k] = store[k];
            });
          } else if (typeof keys === "string") {
            if (store[keys] !== undefined) result[keys] = store[keys];
          } else if (keys && typeof keys === "object") {
            for (const [k, def] of Object.entries(keys)) {
              result[k] = store[k] !== undefined ? store[k] : def;
            }
          } else {
            Object.assign(result, store);
          }
          if (cb) cb(result);
        },
        set(obj, cb) {
          Object.assign(store, obj);
          if (cb) cb();
        },
        clear(cb) {
          for (const k of Object.keys(store)) delete store[k];
          if (cb) cb();
        },
      },
    },

    contextMenus: {
      create(menuObj) {
        menus[menuObj.id] = menuObj;
      },
      onClicked: {
        addListener(cb) {
          contextMenuClickListeners.push(cb);
        },
      },
    },

    tabs: {
      onActivated: {
        addListener(cb) {
          tabActivatedListeners.push(cb);
        },
      },
      onUpdated: {
        addListener(cb) {
          tabUpdatedListeners.push(cb);
        },
      },
      query(queryInfo, cb) {
        const tabs = [
          { id: 101, url: "https://example.com/form", title: "Example Form" },
        ];
        if (cb) cb(tabs);
      },
      sendMessage(tabId, message, cb) {
        for (const listener of messageListeners) {
          listener(message, { tab: { id: tabId } }, (res) => {
            if (cb) cb(res);
          });
        }
      },
      reload(tabId, cb) {
        if (cb) cb();
      },
    },

    action: {
      _badgeText: {},
      _badgeBgColor: {},
      _badgeTextColor: {},
      setBadgeText({ text, tabId }) {
        this._badgeText[tabId] = text;
      },
      setBadgeBackgroundColor({ color, tabId }) {
        this._badgeBgColor[tabId] = color;
      },
      setBadgeTextColor({ color, tabId }) {
        this._badgeTextColor[tabId] = color;
      },
    },

    scripting: {
      executeScript({ target, files }) {
        return Promise.resolve();
      },
      insertCSS({ target, files }) {
        return Promise.resolve();
      },
    },
  };
}

export function setupTestEnvironment() {
  const document = createMockDocument();
  const chrome = createMockChrome();

  const window = {
    document,
    chrome,
    scrollX: 0,
    scrollY: 0,
    pageXOffset: 0,
    pageYOffset: 0,
    innerWidth: 1024,
    innerHeight: 768,
    HTMLInputElement: { prototype: MockElement.prototype },
    HTMLTextAreaElement: { prototype: MockElement.prototype },
    HTMLSelectElement: { prototype: MockElement.prototype },
    HTMLElement: MockElement,
    Event: MockEvent,
    CustomEvent: MockCustomEvent,
    KeyboardEvent: MockKeyboardEvent,
    MouseEvent: MockMouseEvent,
    FileReader: MockFileReader,
    Blob: MockBlob,
    URL: {
      createObjectURL: (blob) =>
        "blob:mock-url-" + Math.random().toString(36).slice(2),
      revokeObjectURL: (url) => {},
    },
    CSS: {
      escape: (str) =>
        String(str).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, "\\$1"),
    },
    navigator: {
      clipboard: {
        writeText: async (text) => true,
      },
    },
    addEventListener: (type, listener, options) =>
      document.addEventListener(type, listener, options),
    removeEventListener: (type, listener) =>
      document.removeEventListener(type, listener),
    dispatchEvent: (event) => document.dispatchEvent(event),
    close: () => {},
  };

  globalThis.window = window;
  globalThis.document = document;
  globalThis.chrome = chrome;
  globalThis.Event = MockEvent;
  globalThis.CustomEvent = MockCustomEvent;
  globalThis.KeyboardEvent = MockKeyboardEvent;
  globalThis.MouseEvent = MockMouseEvent;
  globalThis.FileReader = MockFileReader;
  globalThis.Blob = MockBlob;
  globalThis.CSS = window.CSS;
  if (globalThis.URL) {
    globalThis.URL.createObjectURL = window.URL.createObjectURL;
    globalThis.URL.revokeObjectURL = window.URL.revokeObjectURL;
  } else {
    globalThis.URL = window.URL;
  }

  try {
    Object.defineProperty(globalThis, "navigator", {
      value: window.navigator,
      configurable: true,
      writable: true,
    });
  } catch (e) {
    if (globalThis.navigator) {
      try {
        Object.defineProperty(globalThis.navigator, "clipboard", {
          value: window.navigator.clipboard,
          configurable: true,
          writable: true,
        });
      } catch (err) {
        globalThis.navigator.clipboard = window.navigator.clipboard;
      }
    }
  }

  return { window, document, chrome };
}
