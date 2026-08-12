import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Renderer V2 production composition", () => {
  it("uses one coarse Liquid root and keeps benchmark runtimes out of production", async () => {
    const workspace = await readFile(
      "src/features/workspace-chrome/RendererV2ApplicationWorkspace.tsx",
      "utf8",
    );
    expect(workspace.match(/<LiquidDomRoot/g)).toHaveLength(1);
    expect(workspace).toContain("backdrop={");
    expect(workspace).toContain("<RendererV2CanvasViewport");
    expect(workspace).not.toContain("liquidSceneBenchmarkRuntime");
    expect(workspace).not.toContain("@liquid-dom/core");
  });

  it("keeps feature UI behind the shared material boundary", async () => {
    const sources = await Promise.all([
      readFile("src/features/canvases/CanvasBrowser.tsx", "utf8"),
      readFile("src/features/canvases/CanvasCard.tsx", "utf8"),
      readFile("src/features/workspace-chrome/RendererV2ApplicationChrome.tsx", "utf8"),
    ]);
    expect(sources.join("\n")).not.toContain("@liquid-dom/core");
    expect(sources.join("\n")).not.toContain("backdrop-filter");
  });

  it("keeps Canvas Browser scrolling invisible and active selection short and orange", async () => {
    const css = await readFile(
      "src/features/workspace-chrome/RendererV2ApplicationChrome.css",
      "utf8",
    );
    expect(css).toMatch(/\.taskmap-canvas-browser__list\s*\{[^}]*scrollbar-width:\s*none/s);
    expect(css).toContain(".taskmap-canvas-browser__list::-webkit-scrollbar");
    expect(css).toMatch(
      /\.taskmap-canvas-card__active-bar\s*\{[^}]*height:\s*22px[^}]*background:\s*#ff922b/s,
    );
  });

  it("keeps the ephemeral workspace bootstrap development-only", async () => {
    const bootstrap = await readFile(
      "src/features/workspace-chrome/useDevelopmentWorkspaceBootstrap.ts",
      "utf8",
    );
    expect(bootstrap).toContain("if (!import.meta.env.DEV");
    expect(bootstrap).toContain("autosavePermitted: false");
  });

  it("loads refraction test elements only in development", async () => {
    const workspace = await readFile(
      "src/features/workspace-chrome/RendererV2ApplicationWorkspace.tsx",
      "utf8",
    );
    expect(workspace).toContain("import.meta.env.DEV");
    expect(workspace).toContain(
      'import("../../ui/dev/refraction-test/DevelopmentRefractionTestLayer")',
    );
    expect(workspace).not.toContain(
      'import { DevelopmentRefractionTestLayer } from "../../ui/dev/refraction-test',
    );
  });
});
