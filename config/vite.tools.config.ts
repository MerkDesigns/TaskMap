import { resolve } from "node:path";
import { defineConfig } from "vite";

const repository = resolve(import.meta.dirname, "..");

// The TypeScript halves of the developer tools in tools/, as Node modules. They reuse the app's
// document validation and canvas projection, so everything they import is bundled in.
export default defineConfig({
  clearScreen: false,
  logLevel: "warn",
  root: repository,
  publicDir: false,
  build: {
    ssr: true,
    outDir: resolve(repository, "dist-tools"),
    emptyOutDir: true,
    target: "node20",
    rolldownOptions: {
      input: {
        convertLegacyExport: resolve(repository, "tools/legacy-migrator/convertLegacyExport.ts"),
        scrambleDocument: resolve(repository, "tools/db-scrambler/scrambleDocument.ts"),
      },
      output: { entryFileNames: "[name].mjs" },
    },
  },
  ssr: { noExternal: true },
});
