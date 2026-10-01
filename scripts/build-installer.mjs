// Builds the release installer: the edition's NSIS installer first, then the installer bootstrapper
// that embeds it. Usage: node scripts/build-installer.mjs [--beta] [--skip-app]
// --beta builds the development-identity edition, shown as "TaskMap Beta", which installs next to
// stable and legacy TaskMap.
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const beta = process.argv.includes("--beta");
const skipApp = process.argv.includes("--skip-app");

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
};

const readJson = async (file) => JSON.parse(await readFile(path.join(ROOT, file), "utf8"));
const base = await readJson("src-tauri/tauri.conf.json");
const overlay = beta ? await readJson("src-tauri/tauri.dev.conf.json") : {};
const productName = overlay.productName ?? base.productName;
const version = base.version;

if (!skipApp) run("npm", ["run", beta ? "bundle:dev" : "bundle:stable"]);

const nsisFolder = path.join(ROOT, "src-tauri/target/release/bundle/nsis");
const payloadName = `${productName}_${version}_x64-setup.exe`;
if (!(await readdir(nsisFolder)).includes(payloadName)) {
  throw new Error(`missing NSIS installer ${payloadName} in ${nsisFolder}`);
}

run("npx", ["tauri", "build"], {
  cwd: path.join(ROOT, "installer"),
  env: {
    ...process.env,
    TASKMAP_INSTALLER_PAYLOAD: path.join(nsisFolder, payloadName),
    ...(beta ? { TASKMAP_INSTALLER_EDITION_CONFIG: "tauri.dev.conf.json" } : {}),
  },
});

// Tauri names the binary after mainBinaryName only when bundling, which the installer skips.
const releaseFolder = path.join(ROOT, "installer/target/release");
const candidates = (await readdir(releaseFolder)).filter((name) =>
  ["taskmap_installer.exe", "taskmap-installer.exe"].includes(name.toLowerCase()),
);
if (candidates.length === 0) throw new Error(`no installer binary in ${releaseFolder}`);

const outputName = beta ? "TaskMap_Beta_Installer.exe" : "TaskMap_Installer.exe";
await mkdir(path.join(ROOT, "release"), { recursive: true });
await copyFile(path.join(releaseFolder, candidates[0]), path.join(ROOT, "release", outputName));
console.log(`Installer ready: release/${outputName} (embeds ${payloadName})`);
