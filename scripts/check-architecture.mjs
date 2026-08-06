import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "src");
const TARGET_DIRS = [
  "app",
  "domain",
  "canvas",
  "elements",
  "extensions",
  "features",
  "legacy",
  "platform",
  "ui",
];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const LEGACY_TAURI_IMPORTS = new Set([
  "src/App.tsx",
  "src/components/CommandRunnerModals.test.tsx",
  "src/components/CommandRunnerModals.tsx",
  "src/components/MarkdownContent.tsx",
  "src/components/TextCardNode.tsx",
  "src/hooks/useAppUpdates.ts",
  "src/hooks/useDiscordRpc.ts",
  "src/hooks/useImageCache.test.tsx",
  "src/hooks/useImageCache.ts",
]);
const LEGACY_TARGET_FILES = new Set([
  "src/app/appData.test.ts",
  "src/app/appData.ts",
  "src/app/appDataSchema.ts",
  "src/app/canvasDocument.test.ts",
  "src/app/canvasDocument.ts",
  "src/app/commandError.test.ts",
  "src/app/commandError.ts",
  "src/app/defaultData.ts",
  "src/app/history.test.ts",
  "src/app/history.ts",
  "src/extensions/copyPasteJson.test.ts",
  "src/extensions/copyPasteJson.ts",
  "src/extensions/registry.test.ts",
  "src/extensions/registry.ts",
  "src/extensions/useExtensionDrag.ts",
]);

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory, extensions = SOURCE_EXTENSIONS) {
  if (!(await pathExists(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(absolute, extensions);
      return extensions.has(path.extname(entry.name)) ? [absolute] : [];
    }),
  );
  return files.flat();
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function importSpecifiers(source) {
  const specifiers = [];
  const patterns = [/\bfrom\s+["']([^"']+)["']/g, /\bimport\s*(?:\(\s*)?["']([^"']+)["']/g];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

function importsTauri(source) {
  return importSpecifiers(source).some((specifier) => specifier.startsWith("@tauri-apps/"));
}

function importsArea(file, source, area) {
  const target = path.join(SOURCE_ROOT, area);
  return importSpecifiers(source).some((specifier) => {
    if (!specifier.startsWith(".")) return false;
    const resolved = path.resolve(path.dirname(file), specifier);
    return resolved === target || resolved.startsWith(`${target}${path.sep}`);
  });
}

function usesBrowserGlobals(source) {
  return /\b(?:window|navigator|localStorage|sessionStorage)\s*\.|\bglobalThis\.document\b|\bdocument\.(?:body|createElement|querySelector|addEventListener)\b|\b(?:HTMLElement|PointerEvent|requestAnimationFrame|cancelAnimationFrame)\b/.test(
    source,
  );
}

const violations = [];
const allSourceFiles = await collectFiles(SOURCE_ROOT);
const targetFiles = (
  await Promise.all(TARGET_DIRS.map((directory) => collectFiles(path.join(SOURCE_ROOT, directory))))
).flat();

for (const file of allSourceFiles) {
  const source = await readFile(file, "utf8");
  const rel = relative(file);
  const area = path.relative(SOURCE_ROOT, file).split(path.sep)[0];

  if (importsTauri(source) && area !== "platform" && !LEGACY_TAURI_IMPORTS.has(rel)) {
    violations.push(`${rel}: only src/platform may add @tauri-apps imports`);
  }
}

for (const file of targetFiles) {
  const source = await readFile(file, "utf8");
  const rel = relative(file);
  const area = path.relative(SOURCE_ROOT, file).split(path.sep)[0];
  const lines = source.split(/\r?\n/).length;

  if (area === "domain") {
    if (
      importsTauri(source) ||
      importSpecifiers(source).some((item) => /^react(?:-dom)?(?:\/|$)/.test(item))
    ) {
      violations.push(`${rel}: domain code must not depend on React or Tauri`);
    }
    if (usesBrowserGlobals(source)) {
      violations.push(`${rel}: domain code must not use DOM or browser globals`);
    }
    for (const forbiddenArea of ["ui", "elements", "extensions", "platform"]) {
      if (importsArea(file, source, forbiddenArea)) {
        violations.push(`${rel}: domain code must not import src/${forbiddenArea}`);
      }
    }
  }

  if (area === "platform" && importsArea(file, source, "ui")) {
    violations.push(`${rel}: platform adapters must not import UI modules`);
  }

  if (rel === "src/app/AppShell.tsx") {
    if (lines >= 250) violations.push(`${rel}: AppShell must remain below 250 lines`);
    const allowedImports = new Set(["../legacy/LegacyApplication", "./AppProviders"]);
    for (const specifier of importSpecifiers(source)) {
      if (!allowedImports.has(specifier)) {
        violations.push(`${rel}: AppShell may contain composition imports only`);
      }
    }
  }

  if (lines > 400 && !LEGACY_TARGET_FILES.has(rel)) {
    violations.push(`${rel}: new architecture files must not exceed 400 lines`);
  }
}

const cssFiles = await collectFiles(SOURCE_ROOT, new Set([".css"]));
for (const file of cssFiles) {
  const source = await readFile(file, "utf8");
  const rel = relative(file);
  if (
    /(?:-webkit-)?backdrop-filter\s*:/.test(source) &&
    rel !== "src/index.css" &&
    rel !== "src/ui/materials/FrostedSurface.css"
  ) {
    violations.push(`${rel}: frosted blur must be implemented by FrostedSurface`);
  }
}

if (violations.length) {
  console.error("Architecture boundary violations:\n");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`Architecture boundaries passed for ${targetFiles.length} target-architecture files.`);
