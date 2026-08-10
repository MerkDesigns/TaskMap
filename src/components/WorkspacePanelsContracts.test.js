// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = new URL("../App.tsx", import.meta.url);
const appShellPath = new URL("../app/AppShell.tsx", import.meta.url);
const canvasManagerPath = new URL("./CanvasManager.tsx", import.meta.url);
const extensionsPanelPath = new URL("./ExtensionsPanel.tsx", import.meta.url);
const panelPatternPath = new URL(
  "../ui/patterns/workspace/WorkspaceSidePanel.tsx",
  import.meta.url,
);
const panelCssPath = new URL("../ui/patterns/workspace/WorkspaceSidePanel.css", import.meta.url);
const panelMotionPath = new URL(
  "../ui/patterns/workspace/useWorkspaceSidePanelMotion.ts",
  import.meta.url,
);

describe("Phase 4.5C2C workspace-panel architecture contracts", () => {
  it("keeps one chrome layer containing only toolbar and non-overlay side panels", async () => {
    const appSource = await readFile(appPath, "utf8");
    const layerStart = appSource.indexOf("<WorkspaceChromeLayer>");
    const layerEnd = appSource.indexOf("</WorkspaceChromeLayer>", layerStart);
    const layerContents = appSource.slice(layerStart, layerEnd);

    expect(appSource.match(/<WorkspaceChromeLayer>/g)).toHaveLength(1);
    for (const component of ["FloatingToolbar", "CanvasManager", "ExtensionsPanel"]) {
      expect(layerContents).toMatch(new RegExp(`<${component}\\b`));
    }
    expect(layerContents).not.toMatch(
      /<(?:QuickExtensionsMenu|Minimap|SettingsModal|ToastStack|\w*ContextMenu)\b/,
    );
    for (const component of ["QuickExtensionsMenu", "Minimap", "SettingsModal", "ToastStack"]) {
      expect(appSource.indexOf(`<${component}`, layerEnd)).toBeGreaterThan(layerEnd);
    }
  });

  it("keeps open/closing lifecycle and timers in App", async () => {
    const appSource = await readFile(appPath, "utf8");

    expect(appSource).toContain("const CANVAS_MANAGER_ANIMATION_MS = 120");
    expect(appSource).toContain("setCanvasManagerClosing(true)");
    expect(appSource).toContain("setExtensionsClosing(true)");
    expect(appSource).toContain("closing={canvasManagerClosing}");
    expect(appSource).toContain("closing={extensionsClosing}");
    expect(appSource.match(/CANVAS_MANAGER_ANIMATION_MS/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("uses one Acrylic Large pattern with shared scheduled motion and no local compositor layer", async () => {
    const [appShell, pattern, patternCss, motion] = await Promise.all([
      readFile(appShellPath, "utf8"),
      readFile(panelPatternPath, "utf8"),
      readFile(panelCssPath, "utf8"),
      readFile(panelMotionPath, "utf8"),
    ]);
    const boundary = `${pattern}\n${patternCss}\n${motion}`;

    expect(pattern).toContain('material="acrylic-large"');
    expect(pattern).not.toContain('elevation="none"');
    for (const token of [
      "--taskmap-chrome-inset",
      "--taskmap-toolbar-height",
      "--taskmap-chrome-gap",
      "--taskmap-panel-width",
      "--taskmap-panel-padding",
    ]) {
      expect(patternCss).toContain(`var(${token})`);
    }
    expect(motion).toContain("useMotionFrameScheduler");
    expect(motion).toContain("useMaterialSurfaceGeometryInvalidation");
    expect(boundary).not.toMatch(
      /backdrop-filter|z-index|createBrowserAcrylicRuntime|acrylicCache|MaterialCompositorProvider|requestAnimationFrame/i,
    );
    expect(appShell.match(/<MaterialCompositorProvider\b/g)).toHaveLength(1);
  });

  it("retains embedded and portal boundaries as later C2 slices migrate panel contents", async () => {
    const [canvasManager, extensionsPanel] = await Promise.all([
      readFile(canvasManagerPath, "utf8"),
      readFile(extensionsPanelPath, "utf8"),
    ]);

    expect(canvasManager).toContain("embedded ? (");
    expect(extensionsPanel).toContain("if (embedded)");
    expect(canvasManager).toContain("<WorkspaceSidePanel");
    expect(extensionsPanel).toContain("<WorkspaceSidePanel");
    expect(canvasManager).not.toContain("fixed left-4 top-16 z-30");
    expect(extensionsPanel).not.toContain("fixed left-4 top-16 z-30");
    expect(canvasManager).toContain("createPortal(");
    expect(extensionsPanel).toContain("createPortal(dragPreview, document.body)");
    expect(extensionsPanel).toContain('placeholder="Search extensions"');
    expect(extensionsPanel).toContain("<ExtensionBrowserCard");
    expect(extensionsPanel).toContain("data-extension-filter-menu");
    expect(canvasManager).toContain("data-canvas-card-id");
  });
});
