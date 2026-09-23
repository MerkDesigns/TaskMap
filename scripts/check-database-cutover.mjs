import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(path, "utf8");
const main = await read("src-tauri/src/main.rs");
for (const module of ["storage", "images", "portable", "model", "discord", "error"]) {
  assert.ok(!main.includes(`mod ${module};`), `${module} must not enter the product module graph`);
}
assert.ok(!main.includes("initialize_storage"));
assert.ok(!main.includes("gc_images_at_startup"));
const capability = JSON.parse(await read("src-tauri/capabilities/default.json"));
assert.ok(
  !capability.permissions.some((value) => typeof value === "string" && value.startsWith("allow-")),
);
const shell = await read("src/app/AppShell.tsx");
assert.ok(shell.includes("<DatabaseApplication />"));
assert.ok(!shell.includes("LegacyApplication"));
const commands = await read("src-tauri/src/commands.rs");
assert.ok(!commands.includes("run_saved_commands"));
for (const file of ["tauri.dev.conf.json", "tauri.mcp.dev.conf.json"]) {
  const config = JSON.parse(await read(`src-tauri/${file}`));
  assert.equal(config.build.beforeDevCommand, "npm run dev");
  assert.equal(config.build.beforeBuildCommand, "npm run build");
  assert.deepEqual(config.plugins.updater.endpoints, [], "Dev must not inherit stable updates");
}
console.log(
  "Database cutover: product boot owns one runtime; legacy storage and execution are disconnected.",
);
