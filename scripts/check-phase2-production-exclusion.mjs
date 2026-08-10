import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const stable = await readJson("src-tauri/tauri.conf.json");
const development = await readJson("src-tauri/tauri.dev.conf.json");
const defaultCapability = await readFile("src-tauri/capabilities/default.json", "utf8");
const developmentCapability = await readFile(
  "src-tauri/capabilities/phase2-development.json",
  "utf8",
);
const mainSource = await readFile("src-tauri/src/main.rs", "utf8");
const appShell = await readFile("src/app/AppShell.tsx", "utf8");

if (stable.identifier !== "com.merkdesigns.taskmap") throw new Error("stable identifier is wrong");
if (development.identifier !== "com.merkdesigns.taskmap.dev") {
  throw new Error("development identifier is wrong");
}
if (defaultCapability.includes("phase2")) {
  throw new Error("stable default capability exposes Phase 2 permissions");
}
if (!developmentCapability.includes("allow-phase2-confirm-unlock")) {
  throw new Error("development capability is missing the pending-unlock command");
}
const stableHandler = mainSource.match(
  /#\[cfg\(not\(feature = "phase2-development"\)\)\][\s\S]*?macro_rules! taskmap_invoke_handler \{([\s\S]*?)\n\}/,
)?.[1];
if (!stableHandler || stableHandler.includes("phase2_")) {
  throw new Error("stable Rust invoke handler contains a Phase 2 command");
}
if (
  !appShell.includes('import.meta.env.MODE === "phase2"') ||
  appShell.includes("import { DevelopmentPhase2Entry }")
) {
  throw new Error("Phase 2 frontend entry is not a development-only dynamic import");
}
if (
  !appShell.includes('import.meta.env.DEV && import.meta.env.VITE_TASKMAP_UI_LAB === "1"') ||
  !appShell.includes('import("../ui/dev/DevelopmentUiLab")') ||
  appShell.includes("import { DevelopmentUiLab }")
) {
  throw new Error("UI Lab frontend entry is not a DEV-and-opt-in dynamic import");
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

const stableAssets = await files("dist");
for (const path of stableAssets.filter((item) => /\.(?:js|html|css)$/.test(item))) {
  const content = await readFile(path, "utf8");
  if (
    content.includes("phase2_create_database") ||
    content.includes("Phase 2 encrypted database harness") ||
    content.includes("TaskMap UI Lab") ||
    content.includes("Acrylic compositor playground") ||
    content.includes("data-taskmap-ui-lab")
  ) {
    throw new Error(`stable frontend bundle contains Phase 2 harness content: ${path}`);
  }
}

console.log("Stable frontend excludes Phase 2 IPC and the development-only UI Lab.");
