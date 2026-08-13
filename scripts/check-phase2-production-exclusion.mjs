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
const rendererEntry = await readFile("src/main.tsx", "utf8");

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
  !appShell.includes(
    'import { RendererV2Prototype } from "../ui/renderer-v2-prototype/RendererV2Prototype"',
  ) ||
  !appShell.includes("<RendererV2Prototype />")
) {
  throw new Error("Renderer V2 Prototype is not the canonical application entry");
}
if (
  appShell.includes("import(") ||
  rendererEntry.includes("import(") ||
  !rendererEntry.includes("<AppShell />")
) {
  throw new Error("An obsolete alternate frontend entry remains wired into the application");
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
    content.includes("data-taskmap-ui-lab") ||
    content.includes("Add test element")
  ) {
    throw new Error(`stable frontend bundle contains Phase 2 harness content: ${path}`);
  }
}

console.log("Stable frontend uses the canonical prototype and excludes obsolete alternate UIs.");
