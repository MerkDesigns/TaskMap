// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const canvasManagerPath = new URL("./CanvasManager.tsx", import.meta.url);
const extensionsPanelPath = new URL("./ExtensionsPanel.tsx", import.meta.url);
const appShellPath = new URL("../app/AppShell.tsx", import.meta.url);
const patternPath = new URL("../ui/patterns/workspace/CanvasBrowserCard.tsx", import.meta.url);
const patternCssPath = new URL("../ui/patterns/workspace/CanvasBrowserCard.css", import.meta.url);
const layoutMotionPath = new URL("../ui/motion/layoutMotion.ts", import.meta.url);

describe("Phase 4.5C2D Canvas Browser architecture contracts", () => {
  it("owns accepted card/preview geometry and token-based application states in one pattern", async () => {
    const [pattern, css] = await Promise.all([
      readFile(patternPath, "utf8"),
      readFile(patternCssPath, "utf8"),
    ]);

    expect(pattern).toContain('material={embedded ? "opaque" : "acrylic-small"}');
    expect(pattern).toContain('material="cutout"');
    expect(pattern).toContain('mode === "minimal" ? 8 : 12');
    expect(css).toContain("min-height: 84px");
    expect(css).toContain("height: 40px");
    expect(css).toContain("width: 96px");
    expect(css).toContain("height: 64px");
    expect(css).toContain("var(--taskmap-accent)");
    expect(css).toContain("var(--taskmap-accent-rgb)");
    expect(`${pattern}\n${css}`).not.toMatch(/#2dd8c8|45\s*,\s*216\s*,\s*200/i);
  });

  it("uses primitives and shared motion while retaining interaction and overlay ownership", async () => {
    const [manager, motion, extensions] = await Promise.all([
      readFile(canvasManagerPath, "utf8"),
      readFile(layoutMotionPath, "utf8"),
      readFile(extensionsPanelPath, "utf8"),
    ]);

    expect(manager).toContain("<CanvasBrowserCard");
    expect(manager).toContain("<CanvasPreview>");
    expect(manager).toContain("<Field");
    expect(manager).toContain("<TextField");
    expect(manager).toContain("<IconButton");
    expect(manager).toContain("applyLocalFlip(");
    expect(manager).toContain("useMaterialSurfaceGeometryInvalidation");
    expect(manager).toContain("useMaterialSurfaceMaskOpacity");
    expect(motion).toContain("scheduler.subscribe");
    expect(manager).toContain("requestAnimationFrame(runDragFrame)");
    expect(manager).toContain("requestAnimationFrame(rebuildDragLayout)");
    expect(manager).toContain("createPortal(");
    expect(manager).toContain("data-new-canvas-menu");
    expect(manager).toContain("data-context-menu");
    expect(manager).not.toContain("left-panel-card");
    expect(extensions).toContain("<ExtensionBrowserCard");
  });

  it("keeps drag clones opaque/unregistered and introduces no compositor infrastructure", async () => {
    const [manager, pattern, appShell] = await Promise.all([
      readFile(canvasManagerPath, "utf8"),
      readFile(patternPath, "utf8"),
      readFile(appShellPath, "utf8"),
    ]);
    const boundary = `${manager}\n${pattern}`;

    expect(manager).toContain("prepareCanvasBrowserDragPreview(cloneNode)");
    expect(pattern).toContain('clone.classList.add("taskmap-target-theme"');
    expect(pattern).toContain('clone.removeAttribute("data-material")');
    expect(pattern).toContain('clone.removeAttribute("data-material-surface-id")');
    expect(pattern).toContain('clone.style.removeProperty("transform")');
    expect(pattern).toContain('clone.style.removeProperty("transform-origin")');
    expect(pattern).toContain('clone.style.removeProperty("will-change")');
    expect(pattern).toContain('clone.style.setProperty("--taskmap-material-tint-opacity", "1")');
    expect(boundary).not.toMatch(
      /backdrop-filter|createBrowserAcrylicRuntime|createMaterialSurfaceRegistry|MaterialCompositorProvider|acrylicCache/i,
    );
    expect(appShell).toContain("<RendererV2Prototype />");
  });

  it("keeps Canvas C2D boundaries intact after the isolated C2E Extensions migration", async () => {
    const [manager, extensions] = await Promise.all([
      readFile(canvasManagerPath, "utf8"),
      readFile(extensionsPanelPath, "utf8"),
    ]);

    expect(manager).toContain("frosted-glass context-menu-panel");
    expect(manager).toContain("MENU_ITEM_CLASS");
    expect(extensions).toContain('placeholder="Search extensions"');
    expect(extensions).toContain("data-quick-extensions-menu");
    expect(manager).not.toMatch(/Minimap|SettingsModal/);
  });
});
