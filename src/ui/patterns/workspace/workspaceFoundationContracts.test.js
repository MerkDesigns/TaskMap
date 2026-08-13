// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = new URL("../../../App.tsx", import.meta.url);
const appShellPath = new URL("../../../app/AppShell.tsx", import.meta.url);
const canvasCssPath = new URL("./CanvasFrame.css", import.meta.url);
const canvasSourcePath = new URL("./CanvasFrame.tsx", import.meta.url);
const compositorCssPath = new URL("../../materials/MaterialCompositor.css", import.meta.url);
const projectorPath = new URL("../../../legacy/materials/legacyBackdropScene.ts", import.meta.url);
const themeCssPath = new URL("../../theme/theme.css", import.meta.url);
const visualMirrorPath = new URL("../../theme/workspaceVisualValues.ts", import.meta.url);
const workspaceCssPath = new URL("./WorkspaceRoot.css", import.meta.url);
const workspaceSourcePath = new URL("./WorkspaceRoot.tsx", import.meta.url);

describe("Phase 4.5C2A workspace architecture contracts", () => {
  it("activates the target theme through the production workspace root only", async () => {
    const [appSource, workspaceSource] = await Promise.all([
      readFile(appPath, "utf8"),
      readFile(workspaceSourcePath, "utf8"),
    ]);

    expect(appSource).toContain("<WorkspaceRoot");
    expect(workspaceSource).toContain('"taskmap-target-theme"');
    expect(appSource).not.toMatch(/document(?:Element)?\.classList|document\.body\.classList/);
  });

  it("keeps canvas below the compositor and defines only the chrome stacking context above it", async () => {
    const [canvasCss, compositorCss, workspaceCss] = await Promise.all([
      readFile(canvasCssPath, "utf8"),
      readFile(compositorCssPath, "utf8"),
      readFile(workspaceCssPath, "utf8"),
    ]);
    const rootRule = cssRule(workspaceCss, ".taskmap-workspace-root");
    const backdropRule = cssRule(workspaceCss, ".taskmap-workspace-backdrop-layer");
    const chromeRule = cssRule(workspaceCss, ".taskmap-workspace-chrome-layer");
    const canvasRule = cssRule(canvasCss, ".taskmap-canvas-frame");
    const basePlaneRule = cssRule(compositorCss, ".taskmap-compositor-plane--base");

    expect(rootRule).not.toMatch(
      /(?:z-index|isolation|transform|filter|opacity|contain|will-change)\s*:/,
    );
    expect(canvasRule).not.toMatch(/(?:z-index|isolation|transform|filter|opacity)\s*:/);
    expect(backdropRule).toContain("z-index: 0");
    expect(basePlaneRule).toContain("z-index: 40");
    expect(chromeRule).toContain("z-index: var(--taskmap-layer-workspace-chrome)");
  });

  it("adds no blur, material surface, compositor provider, cache, or application state", async () => {
    const [appShell, canvasCss, canvasSource, workspaceCss, workspaceSource] = await Promise.all([
      readFile(appShellPath, "utf8"),
      readFile(canvasCssPath, "utf8"),
      readFile(canvasSourcePath, "utf8"),
      readFile(workspaceCssPath, "utf8"),
      readFile(workspaceSourcePath, "utf8"),
    ]);
    const patternSources = `${canvasCss}\n${canvasSource}\n${workspaceCss}\n${workspaceSource}`;

    expect(patternSources).not.toMatch(
      /backdrop-filter|MaterialSurface|MaterialCompositorProvider|createBrowserAcrylicRuntime|acrylicCache|Redux|persistence/i,
    );
    expect(appShell).toContain("<RendererV2Prototype />");
  });

  it("leaves all stage and world interaction ownership in App", async () => {
    const appSource = await readFile(appPath, "utf8");

    expect(appSource).toContain("<WorkspaceBackdropLayer");

    for (const handler of [
      "onPointerDownCapture={handleStagePointerDownCapture}",
      "onPointerDown={handleStagePointerDown}",
      "onPointerMove={handlePointerMove}",
      "onPointerUp={stopDrag}",
      "onPointerCancel={cancelDrag}",
      "onLostPointerCapture={cancelDrag}",
      "onWheel={handleWheel}",
      "onContextMenu={handleCanvasContextMenu}",
      "onPointerDown={handleWorldPointerDown}",
    ]) {
      expect(appSource).toContain(handler);
    }
    expect(appSource).toContain(
      "transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`",
    );
  });

  it("locks visible grid geometry and formulas to the DOM-free BackdropScene mirror", async () => {
    const [appSource, canvasCss, projectorSource, themeCss, visualMirrorSource] = await Promise.all(
      [
        readFile(appPath, "utf8"),
        readFile(canvasCssPath, "utf8"),
        readFile(projectorPath, "utf8"),
        readFile(themeCssPath, "utf8"),
        readFile(visualMirrorPath, "utf8"),
      ],
    );

    expect(themeCss).toContain("Normative owner for visible target-theme values");
    expect(visualMirrorSource).toContain("Typed, DOM-free mirror");
    expect(canvasCss).toContain(
      "background-size: var(--taskmap-canvas-grid-spacing) var(--taskmap-canvas-grid-spacing)",
    );
    expect(canvasCss.match(/var\(--taskmap-canvas-grid-major-spacing\)/g)).toHaveLength(4);
    expect(canvasCss.match(/var\(--taskmap-canvas-line-minor-opacity-scale\)/g)).toHaveLength(2);
    expect(canvasCss.match(/var\(--taskmap-canvas-line-major-opacity-scale\)/g)).toHaveLength(2);
    expect(appSource).toContain("clamp((zoom - 0.55) / 0.45, 0, 1)");
    expect(appSource).toContain('"--taskmap-canvas-dot-size": `${1.25 / zoom}px`');
    for (const mirroredValue of [
      "canvasGridSpacingWorld",
      "canvasGridMajorEvery",
      "canvasLineMinorOpacityScale",
      "canvasLineMajorOpacityScale",
      "canvasDotRadiusScreen",
      "canvasDotOpacityFadeStart",
      "canvasDotOpacityFadeSpan",
      "canvasCornerRadius",
    ]) {
      expect(projectorSource).toContain(`WORKSPACE_VISUAL_VALUES.${mirroredValue}`);
    }
  });
});

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}
