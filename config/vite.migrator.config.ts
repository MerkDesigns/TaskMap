import { resolve } from "node:path";
import { defineConfig } from "vite";

const repository = resolve(import.meta.dirname, "..");

// The legacy migrator's converter as one Node module: it reuses the app's document validation
// and canvas projection, so everything it imports is bundled in.
export default defineConfig({
  clearScreen: false,
  logLevel: "warn",
  root: repository,
  build: {
    ssr: resolve(repository, "tools/legacy-migrator/convertLegacyExport.ts"),
    outDir: resolve(repository, "dist-migrator"),
    emptyOutDir: true,
    target: "node20",
    rolldownOptions: { output: { entryFileNames: "convertLegacyExport.mjs" } },
  },
  ssr: { noExternal: true },
});
