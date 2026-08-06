import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ROOTS = ["src", "src-tauri/src", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".rs", ".mjs"]);

async function collect(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return collect(target);
      return EXTENSIONS.has(path.extname(entry.name)) ? [target] : [];
    }),
  );
  return nested.flat();
}

const rows = [];
for (const root of ROOTS) {
  for (const file of await collect(path.join(ROOT, root))) {
    const source = await readFile(file, "utf8");
    rows.push({
      file: path.relative(ROOT, file).replaceAll(path.sep, "/"),
      lines: source.split(/\r?\n/).length,
    });
  }
}

rows.sort((left, right) => right.lines - left.lines || left.file.localeCompare(right.file));
console.log("Lines  Status   File");
for (const row of rows) {
  const status = row.lines > 400 ? "REVIEW" : row.lines > 250 ? "WATCH" : "OK";
  console.log(`${String(row.lines).padStart(5)}  ${status.padEnd(7)}  ${row.file}`);
}

const reviewCount = rows.filter(({ lines }) => lines > 400).length;
console.log(`\n${rows.length} files inspected; ${reviewCount} files exceed 400 lines.`);
