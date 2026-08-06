import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "src");
const TARGET_DIRS = ["app", "domain", "canvas", "elements", "extensions", "features", "platform", "ui"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory) {
  if (!(await pathExists(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(absolute);
      return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [absolute] : [];
    }),
  );
  return files.flat();
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function importsTauri(source) {
  return /(?:from\s+["']@tauri-apps\/|import\s*\(["']@tauri-apps\/)/.test(source);
}

function importsReactOrDom(source) {
  return /(?:from\s+["']react(?:-dom)?(?:\/[^"']*)?["']|lib\.dom|\bdocument\.|\bwindow\.)/.test(source);
}

function importsUi(source) {
  return /from\s+["'][^"']*(?:\/ui\/|\/components\/)/.test(source);
}

const violations = [];
const files = (
  await Promise.all(TARGET_DIRS.map((directory) => collectFiles(path.join(SOURCE_ROOT, directory))))
).flat();

for (const file of files) {
  const source = await readFile(file, "utf8");
  const rel = relative(file);
  const area = path.relative(SOURCE_ROOT, file).split(path.sep)[0];

  if (importsTauri(source) && area !== "platform") {
    violations.push(`${rel}: only src/platform may import @tauri-apps packages`);
  }
  if (area === "domain" && importsReactOrDom(source)) {
    violations.push(`${rel}: domain code must not depend on React or browser globals`);
  }
  if (area === "platform" && importsUi(source)) {
    violations.push(`${rel}: platform adapters must not import UI modules`);
  }
  if (/\/AppShell\.tsx$/.test(rel) && source.split(/\r?\n/).length > 250) {
    violations.push(`${rel}: AppShell must remain below 250 lines`);
  }
}

if (violations.length) {
  console.error("Architecture boundary violations:\n");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`Architecture boundaries passed for ${files.length} target-architecture files.`);
