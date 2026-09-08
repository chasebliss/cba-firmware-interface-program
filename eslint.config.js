import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import { house, houseTs, allowDefault } from "../house-lint.mjs";

export default defineConfig([
  globalIgnores(["dist", "design_handoff"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  ...house,
  ...houseTs,
  // Vercel functions default-export their handler.
  ...allowDefault(["api/**/*.js", "middleware.js"]),
]);
