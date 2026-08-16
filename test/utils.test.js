import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setupTestEnvironment,
  MockElement,
  MockBlob,
} from "./helpers/test-dom-helper.js";

setupTestEnvironment();
import * as utils from "../src/shared/utils.ts";

describe("FormSecretaryUtils", () => {
  describe("escapeHtml", () => {
    it("returns empty string for null, undefined, or empty string", () => {
      assert.strictEqual(utils.escapeHtml(null), "");
      assert.strictEqual(utils.escapeHtml(undefined), "");
      assert.strictEqual(utils.escapeHtml(""), "");
    });

    it("converts non-string primitives safely to escaped strings", () => {
      assert.strictEqual(utils.escapeHtml(12345), "12345");
      assert.strictEqual(utils.escapeHtml(true), "true");
      assert.strictEqual(utils.escapeHtml(0), ""); // 0 is falsy, escapeHtml returns empty string
    });

    it("escapes special characters correctly (&, <, >, \", ')", () => {
      assert.strictEqual(
        utils.escapeHtml("<script>alert(\"xss\") & 'test'</script>"),
        "&lt;script&gt;alert(&quot;xss&quot;) &amp; &#039;test&#039;&lt;/script&gt;",
      );
    });

    it("handles multiple occurrences of special characters", () => {
      assert.strictEqual(
        utils.escapeHtml("A & B & C < D > E \" F \" ' G '"),
        "A &amp; B &amp; C &lt; D &gt; E &quot; F &quot; &#039; G &#039;",
      );
    });

    it("returns unmutated clean strings", () => {
      assert.strictEqual(utils.escapeHtml("Clean text 123"), "Clean text 123");
    });
  });

  describe("truncateText", () => {
    it("returns empty string for null, undefined, or empty string", () => {
      assert.strictEqual(utils.truncateText(null), "");
      assert.strictEqual(utils.truncateText(undefined), "");
      assert.strictEqual(utils.truncateText(""), "");
    });

    it("returns original string if within max length", () => {
      assert.strictEqual(utils.truncateText("Short label", 24), "Short label");
      assert.strictEqual(utils.truncateText("Email Address", 24), "Email Address");
    });

    it("truncates string with ellipsis when exceeding max length", () => {
      const longLabel = "If you were referred by a Phantom employee, please provide their name";
      assert.strictEqual(utils.truncateText(longLabel, 24), "If you were referred by…");
    });
  });



  describe("showToast", () => {
    it("does nothing when element is null or undefined", () => {
      assert.doesNotThrow(() => {
        utils.showToast(null, "Hello");
        utils.showToast(undefined, "Hello");
      });
    });

    it("sets message text and triggers show animation classes", async () => {
      const toastEl = new MockElement("div");
      utils.showToast(toastEl, "Saved successfully ✨", 50);

      assert.strictEqual(toastEl.textContent, "Saved successfully ✨");
      assert.strictEqual(toastEl.style.display, "block");
      assert.strictEqual(toastEl.classList.contains("show"), true);
      assert.strictEqual(toastEl.classList.contains("closing"), false);
      assert.ok(toastEl._toastTimer);

      // Wait for toast duration to expire and closing animation
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.strictEqual(toastEl.classList.contains("closing"), true);

      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.strictEqual(toastEl.style.display, "none");
      assert.strictEqual(toastEl.classList.contains("show"), false);
      assert.strictEqual(toastEl.classList.contains("closing"), false);
    });

    it("clears previous timers when called consecutively in rapid succession", () => {
      const toastEl = new MockElement("div");
      utils.showToast(toastEl, "First Toast", 500);
      const firstTimer = toastEl._toastTimer;
      assert.ok(firstTimer);

      utils.showToast(toastEl, "Second Toast", 500);
      assert.strictEqual(toastEl.textContent, "Second Toast");
      assert.notStrictEqual(toastEl._toastTimer, firstTimer);

      clearTimeout(toastEl._toastTimer);
    });
  });

  describe("copyToClipboard", () => {
    it("returns false for empty or null text without performing actions", async () => {
      const res1 = await utils.copyToClipboard("");
      const res2 = await utils.copyToClipboard(null);
      const res3 = await utils.copyToClipboard(undefined);

      assert.strictEqual(res1, false);
      assert.strictEqual(res2, false);
      assert.strictEqual(res3, false);
    });

    it("uses navigator.clipboard.writeText when available", async () => {
      let writtenText = null;
      globalThis.navigator.clipboard = {
        writeText: async (t) => {
          writtenText = t;
          return true;
        },
      };

      const result = await utils.copyToClipboard("test copy text");
      assert.strictEqual(result, true);
      assert.strictEqual(writtenText, "test copy text");
    });

    it("falls back to document.execCommand when navigator.clipboard fails", async () => {
      globalThis.navigator.clipboard = {
        writeText: async () => {
          throw new Error("Clipboard permission denied");
        },
      };

      let execCommandCalled = false;
      globalThis.document.execCommand = (cmd) => {
        if (cmd === "copy") execCommandCalled = true;
        return true;
      };

      const result = await utils.copyToClipboard("fallback copy text");
      assert.strictEqual(result, true);
      assert.strictEqual(execCommandCalled, true);
    });

    it("handles total copy failure gracefully and returns false", async () => {
      globalThis.navigator.clipboard = null;
      globalThis.document.body.appendChild = () => {
        throw new Error("DOM manipulation error");
      };

      const result = await utils.copyToClipboard("fail copy");
      assert.strictEqual(result, false);

      // Restore
      setupTestEnvironment();
    });
  });

  describe("exportJsonFile", () => {
    it("creates Blob, ObjectURL, triggers download link click, and revokes ObjectURL", () => {
      let objectUrlCreated = null;
      let revokedUrl = null;
      let clicked = false;

      globalThis.URL = {
        createObjectURL: (blob) => {
          objectUrlCreated = blob;
          return "blob:mock-export-url";
        },
        revokeObjectURL: (url) => {
          revokedUrl = url;
        },
      };

      MockElement.prototype.click = function () {
        if (this.tagName === "A") {
          clicked = true;
          assert.strictEqual(this.download, "backup.json");
          assert.strictEqual(this.href, "blob:mock-export-url");
        }
      };

      const testData = { fields: [{ id: "1", label: "Test" }] };
      utils.exportJsonFile("backup.json", testData);

      assert.strictEqual(clicked, true);
      assert.strictEqual(revokedUrl, "blob:mock-export-url");
      assert.ok(objectUrlCreated instanceof MockBlob);
      assert.strictEqual(objectUrlCreated.type, "application/json");
    });
  });

  describe("readJsonFile", () => {
    it("rejects when no file is passed", async () => {
      await assert.rejects(async () => utils.readJsonFile(null), {
        message: "No file provided",
      });
      await assert.rejects(async () => utils.readJsonFile(undefined), {
        message: "No file provided",
      });
    });

    it("resolves parsed JSON object when file content is valid JSON", async () => {
      const mockFile = {
        _content: JSON.stringify({
          version: "1.0.0",
          fields: ["email", "phone"],
        }),
      };

      const parsed = await utils.readJsonFile(mockFile);
      assert.deepEqual(parsed, {
        version: "1.0.0",
        fields: ["email", "phone"],
      });
    });

    it("rejects with error when file content contains invalid JSON", async () => {
      const mockFile = {
        _content: "{ invalid_json: true, }",
      };

      await assert.rejects(
        async () => utils.readJsonFile(mockFile),
        /Invalid JSON format:/,
      );
    });

    it("rejects with error when FileReader encounters an error", async () => {
      const mockFile = {
        _forceError: true,
      };

      await assert.rejects(async () => utils.readJsonFile(mockFile), {
        message: "Failed to read file",
      });
    });
  });

  describe("debounce", () => {
    it("uses 300ms as default wait time when not specified", async () => {
      let callCount = 0;
      const fn = utils.debounce(() => {
        callCount++;
      });

      fn();
      assert.strictEqual(callCount, 0);

      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.strictEqual(callCount, 0);

      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.strictEqual(callCount, 1);
    });

    it("delays execution until wait time has elapsed", async () => {
      let callCount = 0;
      let lastArg = null;
      const fn = utils.debounce((val) => {
        callCount++;
        lastArg = val;
      }, 50);

      fn("test");
      assert.strictEqual(callCount, 0);

      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.strictEqual(callCount, 1);
      assert.strictEqual(lastArg, "test");
    });

    it("debounces rapid consecutive calls and uses latest arguments", async () => {
      let callCount = 0;
      let lastArg = null;
      const fn = utils.debounce((val) => {
        callCount++;
        lastArg = val;
      }, 50);

      fn("a");
      fn("b");
      fn("c");

      assert.strictEqual(callCount, 0);

      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.strictEqual(callCount, 1);
      assert.strictEqual(lastArg, "c");
    });

    it("maintains execution context and arguments", async () => {
      let capturedResult = null;
      const obj = {
        multiplier: 5,
        calculate: utils.debounce(function (val) {
          capturedResult = this.multiplier * val;
        }, 50),
      };

      obj.calculate(10);
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.strictEqual(capturedResult, 50);
    });

    it("executes immediately on leading edge when immediate is true", async () => {
      let callCount = 0;
      let lastArg = null;
      const fn = utils.debounce(
        (val) => {
          callCount++;
          lastArg = val;
        },
        50,
        true,
      );

      fn("first");
      assert.strictEqual(callCount, 1);
      assert.strictEqual(lastArg, "first");

      fn("second");
      assert.strictEqual(callCount, 1);

      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.strictEqual(callCount, 1);

      fn("third");
      assert.strictEqual(callCount, 2);
      assert.strictEqual(lastArg, "third");
    });

    it("cancels pending invocation with cancel()", async () => {
      let callCount = 0;
      const fn = utils.debounce(() => {
        callCount++;
      }, 50);

      fn();
      assert.strictEqual(callCount, 0);
      fn.cancel();

      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.strictEqual(callCount, 0);
    });

    it("flushes pending invocation immediately with flush()", () => {
      let callCount = 0;
      const fn = utils.debounce(() => {
        callCount++;
        return "executed";
      }, 50);

      fn();
      assert.strictEqual(callCount, 0);
      const res = fn.flush();
      assert.strictEqual(callCount, 1);
      assert.strictEqual(res, "executed");
    });

    it("flush does nothing if no call is pending", () => {
      let callCount = 0;
      const fn = utils.debounce(() => {
        callCount++;
      }, 50);

      const res = fn.flush();
      assert.strictEqual(callCount, 0);
      assert.strictEqual(res, undefined);
    });
  });

  describe("isElementVisible", () => {
    it("returns false for null or undefined or element without tagName", () => {
      assert.strictEqual(utils.isElementVisible(null), false);
      assert.strictEqual(utils.isElementVisible(undefined), false);
      assert.strictEqual(utils.isElementVisible({}), false);
    });


    it("returns false for template tags and hidden attributes", () => {
      const template = new MockElement("template");
      assert.strictEqual(utils.isElementVisible(template), false);

      const hiddenInput = new MockElement("input");
      hiddenInput.hidden = true;
      assert.strictEqual(utils.isElementVisible(hiddenInput), false);

      const hiddenAttrInput = new MockElement("input");
      hiddenAttrInput.setAttribute("hidden", "");
      assert.strictEqual(utils.isElementVisible(hiddenAttrInput), false);
    });

    it("returns false when element has aria-hidden=true or is inside aria-hidden container", () => {
      const ariaHiddenInput = new MockElement("input");
      ariaHiddenInput.setAttribute("aria-hidden", "true");
      assert.strictEqual(utils.isElementVisible(ariaHiddenInput), false);

      const hiddenContainer = new MockElement("div");
      hiddenContainer.setAttribute("aria-hidden", "true");
      const childInput = new MockElement("input");
      hiddenContainer.appendChild(childInput);
      assert.strictEqual(utils.isElementVisible(childInput), false);
    });

    it("returns false when display is none or visibility is hidden", () => {
      const noneInput = new MockElement("input");
      noneInput.style.display = "none";
      assert.strictEqual(utils.isElementVisible(noneInput), false);

      const hiddenVisInput = new MockElement("input");
      hiddenVisInput.style.visibility = "hidden";
      assert.strictEqual(utils.isElementVisible(hiddenVisInput), false);
    });

    it("returns false when dimensions are 0x0 or 1x1 invisible clips", () => {
      const zeroInput = new MockElement("input");
      zeroInput.getBoundingClientRect = () => ({
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
      });
      assert.strictEqual(utils.isElementVisible(zeroInput), false);

      const onePixelInput = new MockElement("input");
      onePixelInput.getBoundingClientRect = () => ({
        top: 0,
        left: 0,
        bottom: 1,
        right: 1,
        width: 1,
        height: 1,
        x: 0,
        y: 0,
      });
      assert.strictEqual(utils.isElementVisible(onePixelInput), false);
    });

    it("returns true for standard visible elements", () => {
      const visibleInput = new MockElement("input");
      assert.strictEqual(utils.isElementVisible(visibleInput), true);
    });

    it("returns true for custom styled proxy checkboxes or radios inside visible containers even if input itself has display:none", () => {
      const fieldEntry = new MockElement("div");
      fieldEntry.className = "_fieldEntry_1e3gg_28";
      const yesNoContainer = new MockElement("div");
      yesNoContainer.className = "_container_1svni_28 _yesno_1e3gg_148";
      const btnYes = new MockElement("button");
      btnYes.innerText = "Yes";
      const btnNo = new MockElement("button");
      btnNo.innerText = "No";
      const proxyCheckbox = new MockElement("input");
      proxyCheckbox.type = "checkbox";
      proxyCheckbox.style.display = "none";

      yesNoContainer.appendChild(btnYes);
      yesNoContainer.appendChild(btnNo);
      yesNoContainer.appendChild(proxyCheckbox);
      fieldEntry.appendChild(yesNoContainer);

      assert.strictEqual(utils.isElementVisible(proxyCheckbox), true);
    });

    it("returns false for proxy checkboxes when the enclosing container is also hidden", () => {
      const hiddenContainer = new MockElement("div");
      hiddenContainer.style.display = "none";
      const proxyCheckbox = new MockElement("input");
      proxyCheckbox.type = "checkbox";
      proxyCheckbox.style.display = "none";
      hiddenContainer.appendChild(proxyCheckbox);

      assert.strictEqual(utils.isElementVisible(proxyCheckbox), false);
    });

    it("returns false when element is disconnected from document", () => {
      const el = new MockElement("input");
      el.isConnected = false;
      assert.strictEqual(utils.isElementVisible(el), false);
    });

    it("returns false for template tags and elements with hidden attribute", () => {
      const tpl = new MockElement("template");
      assert.strictEqual(utils.isElementVisible(tpl), false);

      const hiddenEl = new MockElement("input");
      hiddenEl.hidden = true;
      assert.strictEqual(utils.isElementVisible(hiddenEl), false);

      const hiddenAttrEl = new MockElement("input");
      hiddenAttrEl.setAttribute("hidden", "");
      assert.strictEqual(utils.isElementVisible(hiddenAttrEl), false);
    });

    it("returns false when offsetParent is null and position is not fixed", () => {
      const el = new MockElement("input");
      el.offsetParent = null;
      el.style.position = "static";
      assert.strictEqual(utils.isElementVisible(el), false);
    });

    it("returns true when offsetParent is null but position is fixed", () => {
      const el = new MockElement("input");
      el.offsetParent = null;
      el.style.position = "fixed";
      assert.strictEqual(utils.isElementVisible(el), true);
    });
  });

  describe("debounce additional edge cases", () => {
    it("handles cancel and flush when no invocation is pending", () => {
      let callCount = 0;
      const fn = utils.debounce(() => {
        callCount++;
      }, 100);

      assert.doesNotThrow(() => {
        fn.cancel();
        assert.strictEqual(fn.flush(), undefined);
      });
      assert.strictEqual(callCount, 0);
    });

    it("handles immediate execution without trailing repeat", async () => {
      let callCount = 0;
      const fn = utils.debounce(
        () => {
          callCount++;
        },
        50,
        true,
      );

      fn();
      assert.strictEqual(callCount, 1);

      // Call again rapidly during debounce window
      fn();
      assert.strictEqual(callCount, 1);

      await new Promise((r) => setTimeout(r, 70));
      assert.strictEqual(callCount, 1);
    });
  });
});


