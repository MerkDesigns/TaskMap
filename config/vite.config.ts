import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  css: {
    postcss: "./config",
  },
  // @liquid-dom/core is patched after installation for WebView2's current
  // CanvasDrawElement copy signature. Serving it directly prevents Vite from
  // retaining an obsolete optimized copy across installs.
  optimizeDeps: {
    exclude: ["@liquid-dom/core"],
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
