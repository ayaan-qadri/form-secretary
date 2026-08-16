import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  publicDir: "public",
  manifest: {
    name: "Form Secretary - Smart Autofill Assistant",
    description:
      "Smartly detects form fields on any page and autofills your custom values with a single click.",
    version: "1.0.0",
    permissions: ["storage", "activeTab", "scripting", "contextMenus", "tabs"],
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "Form Secretary",
      default_icon: {
        "16": "icons/icon16.png",
        "32": "icons/icon32.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
      },
    },
    icons: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
    browser_specific_settings: {
      gecko: {
        id: "form-secretary@ayaanqadri.dev",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
    web_accessible_resources: [
      {
        resources: ["icons/*"],
        matches: ["<all_urls>"],
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
