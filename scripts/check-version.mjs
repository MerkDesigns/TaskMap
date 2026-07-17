import { readFile } from "node:fs/promises";
import process from "node:process";

const readText = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const packageJson = JSON.parse(await readText("package.json"));
const packageLock = JSON.parse(await readText("package-lock.json"));
const cargoToml = await readText("src-tauri/Cargo.toml");
const cargoLock = await readText("src-tauri/Cargo.lock");
const tauriConfig = JSON.parse(await readText("src-tauri/tauri.conf.json"));
const readme = await readText("README.md");
const version = packageJson.version;

check(/^\d+\.\d+\.\d+$/.test(version), `package.json has an invalid version: ${version}`);
check(packageLock.version === version, "package-lock.json top-level version does not match");
check(
  packageLock.packages?.[""]?.version === version,
  "package-lock.json root package version does not match",
);

const cargoPackage = cargoToml.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m);
check(cargoPackage?.[1] === version, "src-tauri/Cargo.toml package version does not match");

const cargoLockPackage = [
  ...cargoLock.matchAll(/^\[\[package\]\]\r?\nname = "taskmap"\r?\nversion = "([^"]+)"/gm),
];
check(
  cargoLockPackage.length === 1,
  "src-tauri/Cargo.lock must contain exactly one taskmap package",
);
check(cargoLockPackage[0]?.[1] === version, "src-tauri/Cargo.lock taskmap version does not match");
check(tauriConfig.version === version, "src-tauri/tauri.conf.json version does not match");
check(
  readme.includes(`TaskMap_${version}_x64-setup.exe`),
  "README Windows installer link does not match",
);

const gitHubRef = process.env.GITHUB_REF;
if (process.env.GITHUB_REF_TYPE === "tag" || gitHubRef?.startsWith("refs/tags/")) {
  const tag = process.env.GITHUB_REF_NAME ?? gitHubRef?.replace("refs/tags/", "");
  check(tag === `v${version}`, `release tag ${tag} does not match v${version}`);
}

if (failures.length > 0) {
  console.error(
    ["Version consistency check failed:", ...failures.map((item) => `- ${item}`)].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(`Version consistency check passed (${version}).`);
}
