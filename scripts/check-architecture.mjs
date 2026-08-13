import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { findMaterialArchitectureViolations } from "./material-architecture-rules.mjs";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "src");
const RUST_ROOT = path.join(ROOT, "src-tauri", "src");
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
const MATERIAL_SOURCE_EXTENSIONS = new Set([".css", ".ts", ".tsx"]);
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
    const allowedImports = new Set([
      "react",
      "../ui/renderer-v2-prototype/RendererV2Prototype",
      "./errors/ApplicationErrorBoundary",
      "./errors/applicationErrorReporter",
    ]);
    for (const specifier of importSpecifiers(source)) {
      if (!allowedImports.has(specifier)) {
        violations.push(`${rel}: AppShell may contain composition imports only`);
      }
    }
  }

  if (rel.startsWith("src/ui/motion/")) {
    const forbiddenMotionImports = importSpecifiers(source).filter(
      (specifier) =>
        /(?:^|\/)(?:domain|platform|legacy|features|app)(?:\/|$)/.test(specifier) ||
        /(?:@tauri-apps|react-redux|@reduxjs\/toolkit)/.test(specifier),
    );
    if (forbiddenMotionImports.length > 0) {
      violations.push(
        `${rel}: motion must not import application, domain, persistence, Redux, or Tauri code`,
      );
    }
  }

  if (
    rel.startsWith("src/ui/primitives/") &&
    importSpecifiers(source).some((specifier) =>
      /(?:materials\/compositor|materialCompositorCoordinator)/.test(specifier),
    )
  ) {
    violations.push(`${rel}: primitives must use the material boundary, not compositor internals`);
  }

  if (
    rel.startsWith("src/ui/dev/") &&
    importSpecifiers(source).some(
      (specifier) =>
        /(?:^|\/)(?:domain|platform|legacy|persistence)(?:\/|$)/.test(specifier) ||
        /(?:@tauri-apps|react-redux|@reduxjs\/toolkit)/.test(specifier),
    )
  ) {
    violations.push(`${rel}: development UI must not import production state or persistence`);
  }

  if (lines > 400 && !LEGACY_TARGET_FILES.has(rel)) {
    violations.push(`${rel}: new architecture files must not exceed 400 lines`);
  }
}

const reduxStateFiles = targetFiles.filter((file) => {
  const rel = relative(file);
  return rel === "src/app/store.ts" || /(?:Slice|Store)\.ts$/.test(rel);
});
for (const file of reduxStateFiles) {
  const source = await readFile(file, "utf8");
  if (/\bpassword\w*\s*[?:]/i.test(source)) {
    violations.push(`${relative(file)}: raw password fields must not enter Redux state`);
  }
}

const newRustRoots = ["commands", "crypto", "database", "files", "session", "settings"];
const newRustFiles = (
  await Promise.all(
    newRustRoots.map((directory) =>
      collectFiles(path.join(RUST_ROOT, directory), new Set([".rs"])),
    ),
  )
).flat();
for (const file of newRustFiles) {
  const source = await readFile(file, "utf8");
  const rel = relative(file);
  const lines = source.split(/\r?\n/).length;
  if (lines > 400) {
    violations.push(`${rel}: new Rust architecture files must not exceed 400 lines`);
  }
  if (/\b(?:keyring|pbkdf2)\b|\b(?:migrate|migration|legacy)_\w*/i.test(source)) {
    violations.push(
      `${rel}: new Phase 2 modules must not contain legacy migration or keyring code`,
    );
  }
}

for (const legacyFile of ["storage.rs", "model.rs"]) {
  const file = path.join(RUST_ROOT, legacyFile);
  const source = await readFile(file, "utf8");
  if (
    /\b(?:argon2|chacha20poly1305|zeroize|fs2)\b|\b(?:format_info|encrypted_document)\b/.test(
      source,
    )
  ) {
    violations.push(
      `${relative(file)}: Phase 2 database, crypto, session, and locking logic belongs in new Rust modules`,
    );
  }
}

const materialSourceFiles = await collectFiles(SOURCE_ROOT, MATERIAL_SOURCE_EXTENSIONS);
const materialSources = await Promise.all(
  materialSourceFiles.map(async (file) => ({
    path: relative(file),
    source: await readFile(file, "utf8"),
  })),
);
violations.push(...findMaterialArchitectureViolations(materialSources));

if (violations.length) {
  console.error("Architecture boundary violations:\n");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`Architecture boundaries passed for ${targetFiles.length} target-architecture files.`);
