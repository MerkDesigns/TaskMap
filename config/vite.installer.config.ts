import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repository = resolve(import.meta.dirname, "..");

// The installer bootstrapper's UI: a separate root (installer/index.html) with its own output, so
// it is served at "/" and nothing from the main app's bundle (or its Tailwind layer) ships in it.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  root: resolve(repository, "installer"),
  server: {
    host: "127.0.0.1",
    port: 6972,
    strictPort: true,
    // The UI lives in src/installer and shares src/ui and the app icons.
    fs: { allow: [repository] },
  },
  build: {
    outDir: resolve(repository, "dist-installer"),
    emptyOutDir: true,
  },
});
