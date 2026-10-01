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
    // The 16 large-fixture *.performance / *.stress suites check structure (localized transactions,
    // no serialization), never wall time. They take ~1 s locally but 5–6 s on loaded CI runners, so
    // the 5 s default made CI fail at random; a genuinely hung test still fails.
    testTimeout: 20_000,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
