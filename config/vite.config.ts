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
  },
  test: {
    // Bound concurrent jsdom instances on developer machines and Windows CI runners.
    maxWorkers: 4,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
