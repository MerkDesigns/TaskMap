// @vitest-environment node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, URL } from "node:url";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const rootUrl = new URL("../../../", import.meta.url);
const root = fileURLToPath(rootUrl);
const read = (path) => readFile(new URL(path, rootUrl), "utf8");

describe("UI Lab Surface architecture", () => {
  it("reuses the one production boundary without duplicating material recipes", async () => {
    const [material, surface, prototype] = await Promise.all([
      read("src/ui-lab/system/Material.ts"),
      read("src/ui-lab/system/Surface.tsx"),
      read("src/ui-lab/SurfaceMaterialPrototype.tsx"),
    ]);
    const sources = `${material}\n${surface}\n${prototype}`;

    expect(surface).toContain('from "../../ui/materials/MaterialSurface"');
    expect(surface).not.toMatch(/\.css["']/);
    expect(sources).not.toMatch(
      /backdrop-filter|\bblur\b|\bpreblur\b|\boverscan\b|\btint\b|\brim\b|\bbox-shadow\b/i,
    );
  });

  it("adds no product, state, persistence, database, motion, or layout-system ownership", async () => {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "--unified=0", "HEAD", "--", "src/ui-lab"],
      { cwd: root },
    );
    const additions = stdout
      .split(/\r?\n/)
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .join("\n");

    expect(additions).not.toMatch(
      /\b(?:opacity|overflow|scroll(?:ing)?|motion|redux|persistence|database|AppShell|LegacyApplication|AppProviders)\b/i,
    );
    expect(additions).not.toMatch(/@tauri-apps\//);
  });

  it("does not style the primitive with implicit geometry or containment defaults", async () => {
    const css = await read("src/ui-lab/uiLab.css");

    expect(css).not.toMatch(/\.taskmap-ui-lab-surface\s*\{/);
  });

  it("leaves every production material source unchanged from HEAD", async () => {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "--name-only", "HEAD", "--", "src/ui/materials"],
      { cwd: root },
    );

    expect(stdout.trim()).toBe("");
  });
});
