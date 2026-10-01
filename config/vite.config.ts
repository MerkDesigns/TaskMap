import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  css: {
    postcss: "./config",
  },
  server: {
    host: "127.0.0.1",
    port: 6969,
    strictPort: true,
    watch: {
      // Formatters and bulk edits rewrite files in place; reading mid-write cached empty modules
      // (blank or unstyled components) until the file changed again. Wait for writes to settle.
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 25 },
    },
  },
  test: {
    // Bound concurrent jsdom instances on developer machines and Windows CI runners.
    maxWorkers: 4,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
