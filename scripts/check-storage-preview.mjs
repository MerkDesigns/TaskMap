import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (path) => (await readFile(path, "utf8")).replaceAll("\r\n", "\n");
const json = async (path) => JSON.parse(await read(path));
const config = await json("src-tauri/tauri.storage-preview.conf.json");
assert.equal(config.identifier, "com.merkdesigns.taskmap.storage-preview");
assert.deepEqual(config.app.security.capabilities, ["storage-free-preview", "mcp-development"]);
assert.equal(config.bundle.active, false);
assert.equal(config.plugins.updater, null);
assert.equal(config.build.devUrl, "http://127.0.0.1:6971/storage-preview.html");
const capability = await json("src-tauri/capabilities/storage-free-preview.json");
assert.equal(capability.local, true);
assert.equal(capability.remote, undefined);
assert.deepEqual(capability.windows, ["main"]);
assert.deepEqual(capability.permissions, [
  "allow-load-app-data",
  "core:app:allow-version",
  "core:event:allow-listen",
  "core:event:allow-unlisten",
  "core:window:allow-close",
  "core:window:allow-destroy",
  "core:window:allow-is-maximized",
  "core:window:allow-minimize",
  "core:window:allow-set-content-protected",
  "core:window:allow-start-dragging",
  "core:window:allow-toggle-maximize",
]);
const main = await read("src-tauri/src/main.rs");
assert.ok(main.indexOf("storage_preview::validate_launch(") < main.indexOf("let builder ="));
assert.match(main, /if storage_preview::ENABLED \{[^}]*return Ok\(\(\)\);/);
assert.match(main, /on_window_event[\s\S]*?if storage_preview::ENABLED \{\s*return;/);
const policy = await read("src-tauri/src/storage_preview.rs");
assert.ok(policy.includes("not(debug_assertions)"));
assert.ok(policy.includes("compile_error!("));
assert.ok(policy.includes("enabled != (identifier == IDENTIFIER)"));
assert.ok(!main.includes("mod storage;"));
assert.ok(policy.includes("pub(crate) fn load_app_data()"));
assert.ok(policy.includes('Err("Legacy storage is unavailable".into())'));
const pkg = await json("package.json");
assert.equal(
  pkg.scripts["app:preview:mcp"],
  "tauri dev --features storage-free-preview,mcp-development --config src-tauri/tauri.storage-preview.conf.json",
);
// The workspace services own the update check; the storage-free preview must never run it.
const services = await read("src/legacy/useWorkspaceServices.tsx");
assert.equal(
  services.split('checkOnStartup: import.meta.env.MODE !== "storage-preview"').length - 1,
  1,
);
// The canvas saves only through the database session; no legacy autosave may come back.
for (const path of ["src/App.tsx", "src/legacy/useWorkspaceServices.tsx"])
  assert.ok(!(await read(path)).includes("useAutosave("));
for (const path of ["tauri.conf.json", "tauri.dev.conf.json", "tauri.mcp.dev.conf.json"]) {
  assert.ok(!(await read(`src-tauri/${path}`)).includes("storage-preview"));
}
assert.ok((await read("storage-preview.html")).includes("nothing is saved"));
assert.ok((await read("database-entry-preview.html")).includes("simulated files, nothing saved"));
const entryPreview = await read("src/features/database-entry/preview/main.tsx");
assert.ok(
  entryPreview.includes('!import.meta.env.DEV || import.meta.env.MODE !== "storage-preview"'),
);
assert.ok(!entryPreview.includes("createTauriDatabaseSessionController"));
assert.ok(entryPreview.includes("createDatabaseEntryPreview(tauriWindowPrivacyClient)"));
console.log(
  "Storage-free preview: dedicated identity, debug-only, empty baseline, no database/keyring authority.",
);
