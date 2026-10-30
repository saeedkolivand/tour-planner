// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // tsc checks namespace members; the import plugin can't follow SDK 58's compiled `export *` (Notifications.AndroidImportance)
    files: ["**/*.{ts,tsx}"],
    rules: { "import/namespace": "off" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/shared/i18n.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "i18next", message: "Import useTranslation/t/getLanguage/setLanguage from '@/shared/i18n' instead." },
          { name: "react-i18next", message: "Import useTranslation/t/getLanguage/setLanguage from '@/shared/i18n' instead." },
        ],
      }],
    },
  },
]);
