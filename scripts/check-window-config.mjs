// The frameless window keeps native resizing, and the window controls keep their permissions.
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const configs = {
  stable: await readJson("src-tauri/tauri.conf.json"),
  development: await readJson("src-tauri/tauri.dev.conf.json"),
};
for (const [name, config] of Object.entries(configs)) {
  const window = config.app.windows[0];
  if (window.decorations !== false || window.resizable !== true) {
    throw new Error(`${name} window must be frameless (decorations off) and resizable`);
  }
}

const capability = await readJson("src-tauri/capabilities/default.json");
const required = [
  "core:window:allow-close",
  "core:window:allow-is-maximized",
  "core:window:allow-minimize",
  "core:window:allow-start-dragging",
  "core:window:allow-toggle-maximize",
];
const missing = required.filter((permission) => !capability.permissions.includes(permission));
if (missing.length) throw new Error(`default capability is missing ${missing.join(", ")}`);

console.log("Window configuration: frameless, resizable, window-control permissions granted.");
