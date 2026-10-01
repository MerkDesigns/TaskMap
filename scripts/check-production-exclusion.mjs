// Production builds must keep stable/development identities apart and ship no development tooling.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const stable = await readJson("src-tauri/tauri.conf.json");
const development = await readJson("src-tauri/tauri.dev.conf.json");
const mainSource = await readFile("src-tauri/src/main.rs", "utf8");
const databaseApplication = await readFile("src/app/database/DatabaseApplication.tsx", "utf8");

if (stable.identifier !== "com.merkdesigns.taskmap") throw new Error("stable identifier is wrong");
if (development.identifier !== "com.merkdesigns.taskmap.dev") {
  throw new Error("development identifier is wrong");
}
if (/\bphase2_\w+/.test(mainSource)) {
  throw new Error("the removed development database harness commands must not return");
}
if (
  !databaseApplication.includes("const DevelopmentVisualWorkbench = import.meta.env.DEV") ||
  !databaseApplication.includes('import("../development/DevelopmentVisualWorkbench")') ||
  !databaseApplication.includes('runtime.edition === "development"') ||
  databaseApplication.includes("import { DevelopmentVisualWorkbench }")
) {
  throw new Error(
    "UI workbench must be a DEV-only dynamic import within the development database runtime",
  );
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
      }),
    )
  ).flat();
}

// Markers of development-only tooling and preview fixtures that must never reach the stable bundle.
const DEVELOPMENT_MARKERS = [
  "TaskMap UI Lab",
  "data-taskmap-ui-lab",
  "taskmap-workbench",
  "taskmap-stable-glass-plane",
  "taskmap-stable-glass-surface",
  "Workspace admitted (preview)",
  "recovered-preview-token",
  "Entry preview — simulated files",
];

for (const path of (await files("dist")).filter((item) => /\.(?:js|html|css)$/.test(item))) {
  const content = await readFile(path, "utf8");
  const marker = DEVELOPMENT_MARKERS.find((value) => content.includes(value));
  if (marker)
    throw new Error(`stable frontend bundle contains development content "${marker}": ${path}`);
}

console.log("Stable frontend excludes development tooling and preview fixtures.");
