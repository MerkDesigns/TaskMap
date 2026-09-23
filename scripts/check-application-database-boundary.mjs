import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (path) => (await readFile(path, "utf8")).replaceAll("\r\n", "\n");
const json = async (path) => JSON.parse(await read(path));
const operations = [
  "create_database",
  "open_database",
  "unlock_database",
  "confirm_unlock",
  "cancel_pending_unlock",
  "read_document",
  "save_document",
  "full_backup",
  "lock_database",
  "close_database",
  "quit_application",
  "get_session_status",
  "choose_database_path",
  "list_recent_databases",
  "database_edition",
  "destroy_main_window",
  "media_transfer",
  "choose_image",
  "import_dropped_image",
  "view_state",
  "load_preferences",
  "save_preferences",
];
const capability = await json("src-tauri/capabilities/application-database.json");
assert.deepEqual(capability.windows, ["main"]);
assert.equal(capability.remote, undefined, "database capability must not authorize remote content");
assert.notEqual(capability.local, false);
assert.deepEqual(
  capability.permissions.toSorted(),
  operations.map((name) => `allow-app-${name.replaceAll("_", "-")}`).toSorted(),
);
for (const configPath of ["tauri.conf.json", "tauri.dev.conf.json", "tauri.mcp.dev.conf.json"]) {
  const config = await json(`src-tauri/${configPath}`);
  assert.ok(config.app.security.capabilities.includes("application-database"));
}
const uiLab = await json("src-tauri/tauri.ui-lab.conf.json");
assert.ok(!uiLab.app.security.capabilities.includes("application-database"));
const main = await read("src-tauri/src/main.rs");
for (const operation of operations) {
  assert.equal(
    main.split(`::app_${operation},`).length - 1,
    2,
    `${operation} must be registered in both product handlers`,
  );
}
const module = await read("src-tauri/src/commands.rs");
assert.ok(
  module.includes(
    '#[cfg(feature = "phase2-development")]\npub(crate) mod phase2_database_commands;',
  ),
);
const harness = await read("src-tauri/src/commands/phase2_database_commands.rs");
assert.equal(harness.split("ensure_phase2_development(&app)?;").length - 1, 14);
const database = await read("src-tauri/src/commands/database_commands.rs");
assert.equal(database.split("ensure_database_application(&app)?;").length - 1, 12);
assert.ok(database.includes("save_document_for_session("));
assert.ok(
  !database
    .slice(database.indexOf("fn app_save_document"), database.indexOf("fn app_full_backup"))
    .includes("state.get_status()"),
  "save identity cannot use an unlocked preflight check",
);
assert.ok(database.includes("deserialize_limited(&request, MAX_DOCUMENT_IPC_BYTES)"));
assert.ok(database.includes("DatabasePathAuthorizationKind::Create"));
assert.ok(database.includes("DatabasePathAuthorizationKind::Open"));
assert.ok(database.includes("DatabasePathAuthorizationKind::FullBackup"));
const windows = await read("src-tauri/src/commands/database_window_commands.rs");
assert.ok(windows.includes('cfg!(feature = "ui-lab-development")'));
assert.ok(windows.includes("app_config_dir()"));
const resources = await read("src-tauri/src/commands/application_resources.rs");
assert.equal(resources.split("ensure_database_application(&app)?;").length - 1, 4);
for (const limit of ["360 * 1024", "256 * 1024", "16 * 1024"]) {
  assert.ok(resources.includes(`deserialize_limited(&request, ${limit})`));
}
const picker = await read("src-tauri/src/commands/application_image_picker.rs");
assert.ok(picker.includes("ensure_database_application(&app)?;"));
assert.ok(picker.includes("authorize_media("));
assert.ok(picker.includes("import_media_file("));
for (const path of ["session_media_transfer", "session_media_file", "session_view_state"]) {
  const service = await read(`src-tauri/src/session/${path}.rs`);
  assert.ok(service.includes("authorized_session(&mut guard, database_id, session_id)?"));
}
console.log(
  "Application database IPC is explicitly scoped; harness, UI Lab and remote access remain isolated.",
);
