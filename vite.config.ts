/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // channels.test.mjs is the registry sync check and predates vitest: it
    // runs top-level under bare node and calls process.exit, which would kill
    // a vitest worker. `npm test` runs it separately.
    exclude: ["node_modules/**", "api/admin/channels.test.mjs"],
  },
});
