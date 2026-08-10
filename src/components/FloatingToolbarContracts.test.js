// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = new URL("../App.tsx", import.meta.url);
const appShellPath = new URL("../app/AppShell.tsx", import.meta.url);
const toolbarPath = new URL("./FloatingToolbar.tsx", import.meta.url);
const patternPath = new URL("../ui/patterns/workspace/FloatingCanvasToolbar.tsx", import.meta.url);
const patternCssPath = new URL(
  "../ui/patterns/workspace/FloatingCanvasToolbar.css",
  import.meta.url,
);

describe("Phase 4.5C2B toolbar architecture contracts", () => {
  it("keeps FloatingToolbar in the shared WorkspaceChromeLayer without later chrome", async () => {
    const appSource = await readFile(appPath, "utf8");
    const layerStart = appSource.indexOf("<WorkspaceChromeLayer>");
    const toolbarStart = appSource.indexOf("<FloatingToolbar", layerStart);
    const layerEnd = appSource.indexOf("</WorkspaceChromeLayer>", toolbarStart);
    const layerContents = appSource.slice(layerStart, layerEnd);

    expect(layerStart).toBeGreaterThan(-1);
    expect(toolbarStart).toBeGreaterThan(layerStart);
    expect(layerEnd).toBeGreaterThan(toolbarStart);
    expect(appSource.match(/<WorkspaceChromeLayer>/g)).toHaveLength(1);
    expect(layerContents).toMatch(/<CanvasManager\b/);
    expect(layerContents).toMatch(/<ExtensionsPanel\b/);
    expect(layerContents).not.toMatch(/<(?:Minimap|Settings|\w*ContextMenu)\b/);
  });

  it("uses the existing Acrylic Large material and shared primitive boundary", async () => {
    const [patternSource, toolbarSource] = await Promise.all([
      readFile(patternPath, "utf8"),
      readFile(toolbarPath, "utf8"),
    ]);

    expect(patternSource).toContain('material="acrylic-large"');
    expect(patternSource).toContain('elevation="none"');
    expect(toolbarSource).toContain("IconButton");
    expect(toolbarSource).toContain("ToggleButton");
    expect(toolbarSource).not.toMatch(/<button\b|buttonClass|frosted-glass-toolbar/);
  });

  it("has no local compositor layer, blur, cache, provider, or independent animation loop", async () => {
    const [appShellSource, patternCss, patternSource, toolbarSource] = await Promise.all([
      readFile(appShellPath, "utf8"),
      readFile(patternCssPath, "utf8"),
      readFile(patternPath, "utf8"),
      readFile(toolbarPath, "utf8"),
    ]);
    const toolbarBoundary = `${patternCss}\n${patternSource}\n${toolbarSource}`;

    expect(toolbarBoundary).not.toMatch(
      /backdrop-filter|z-index|createBrowserAcrylicRuntime|acrylicCache|MaterialCompositorProvider|requestAnimationFrame/i,
    );
    expect(patternCss).toContain("var(--taskmap-motion-fast)");
    expect(toolbarSource).toContain("useMaterialSurfaceGeometryInvalidation");
    expect(appShellSource.match(/<MaterialCompositorProvider\b/g)).toHaveLength(1);
  });

  it("leaves Settings behind its existing callback boundary", async () => {
    const [appSource, toolbarSource] = await Promise.all([
      readFile(appPath, "utf8"),
      readFile(toolbarPath, "utf8"),
    ]);

    expect(appSource).toContain("onOpenSettings={() => setSettingsOpen(true)}");
    expect(toolbarSource).not.toMatch(/SettingsModal|SettingsShell|SettingsPage|MaterialPlane/);
  });
});
