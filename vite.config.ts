// Build/dev config (Vite).
// Boilerplate — you shouldn't need to touch this.
// Adding a plugin is fair game if it genuinely helps; we may ask you to justify it.
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Project Pages path, e.g. `/concord-eng-exercise/`. Local/dev stays `/`. */
function pagesBase(): string {
  const fromEnv = process.env.BASE_PATH?.trim();
  if (fromEnv) {
    return fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`;
  }
  return "/";
}

export default defineConfig({
  base: pagesBase(),
  plugins: [react()],
  resolve: {
    // `@` → ./src, matching concord-next's apps/web.
    alias: [{ find: "@", replacement: resolve(import.meta.dirname, "./src") }],
  },
  server: {
    allowedHosts: ["vite.cosmo.local"],
  },
});
