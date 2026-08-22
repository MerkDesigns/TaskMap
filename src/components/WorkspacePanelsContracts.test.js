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
const toolbarPath = new URL("./FloatingToolbar.tsx", import.meta.url);
const toolbarCssPath = new URL(
  "../ui/patterns/workspace/FloatingCanvasToolbar.css",
  import.meta.url,
);
const windowChromeCssPath = new URL("../ui/patterns/workspace/WindowChrome.css", import.meta.url);
const canvasBrowserCssPath = new URL("../ui/patterns/workspace/CanvasBrowser.css", import.meta.url);

describe("Phase 4.5C2C workspace-panel architecture contracts", () => {
  it("keeps one chrome layer containing workspace chrome without overlays", async () => {
    const appSource = await readFile(appPath, "utf8");
    const layerStart = appSource.indexOf("<WorkspaceChromeLayer>");
    const layerEnd = appSource.indexOf("</WorkspaceChromeLayer>", layerStart);
    const layerContents = appSource.slice(layerStart, layerEnd);

    expect(appSource.match(/<WorkspaceChromeLayer>/g)).toHaveLength(1);
    for (const component of ["FloatingToolbar", "CanvasManager", "ExtensionsPanel", "Minimap"]) {
      expect(layerContents).toMatch(new RegExp(`<${component}\\b`));
    }
    expect(layerContents.indexOf("<WorkspaceSidePanel")).toBeLessThan(
      layerContents.indexOf("<WindowChrome"),
    );
    expect(layerContents.indexOf("<WorkspaceSidePanel")).toBeLessThan(
      layerContents.indexOf("<FloatingToolbar"),
    );
    expect(layerContents).not.toMatch(
      /<(?:QuickExtensionsMenu|SettingsModal|ToastStack|\w*ContextMenu)\b/,
    );
    for (const component of ["QuickExtensionsMenu", "SettingsModal", "ToastStack"]) {
      expect(appSource.indexOf(`<${component}`, layerEnd)).toBeGreaterThan(layerEnd);
    }
  });

  it("keeps the panel selector mounted and structurally clear of an open side panel", async () => {
    const [toolbar, toolbarCss, canvasBrowserCss, windowChromeCss] = await Promise.all([
      readFile(toolbarPath, "utf8"),
      readFile(toolbarCssPath, "utf8"),
      readFile(canvasBrowserCssPath, "utf8"),
      readFile(windowChromeCssPath, "utf8"),
    ]);

    expect(toolbar).not.toContain("data-side-panel-open");
    expect(toolbarCss).not.toContain("data-side-panel-open");
    expect(toolbarCss).toContain("left: var(--taskmap-chrome-inset-inline)");
    expect(canvasBrowserCss).toContain("var(--taskmap-toolbar-height)");
    expect(canvasBrowserCss).toContain("var(--taskmap-chrome-gap)");
    expect(toolbarCss).not.toContain("z-index");
    expect(windowChromeCss).toContain(
      ".taskmap-workspace-chrome-layer > .taskmap-floating-canvas-toolbar",
    );
    expect(windowChromeCss).toContain("z-index: 1");
  });

  it("keeps open/closing lifecycle and timers in App", async () => {
    const appSource = await readFile(appPath, "utf8");

    expect(appSource).toContain(
      "const CANVAS_MANAGER_ANIMATION_MS = WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS",
    );
    expect(appSource).toContain("setCanvasManagerClosing(true)");
    expect(appSource).toContain("setExtensionsClosing(true)");
    expect(appSource).toContain(
      "const leftPanelClosing = canvasManagerClosing || extensionsClosing",
    );
    expect(appSource.match(/closing=\{leftPanelClosing\}/g)).toHaveLength(3);
    expect(appSource).toContain("panelSwitchTimeoutRef.current = window.setTimeout");
    expect(appSource).toContain("window.clearTimeout(panelSwitchTimeoutRef.current)");
    expect(appSource.match(/CANVAS_MANAGER_ANIMATION_MS/g)?.length).toBeGreaterThanOrEqual(4);
    expect(appSource).toContain("<WorkspaceSidePanelContentSwitcher");
    expect(appSource.match(/sharedPanel/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the Acrylic Large shell on its proven local two-pass path", async () => {
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
      "--taskmap-chrome-inset-top",
      "--taskmap-chrome-inset-inline",
      "--taskmap-chrome-inset-bottom",
      "--taskmap-toolbar-height",
      "--taskmap-chrome-gap",
      "--taskmap-panel-width",
      "--taskmap-panel-padding",
    ]) {
      expect(patternCss).toContain(`var(${token})`);
    }
    expect(motion).toContain("useMotionFrameScheduler");
    expect(motion).not.toContain("useMaterialSurfaceGeometryInvalidation");
    expect(pattern).not.toContain('backdropSource="shared"');
    expect(pattern).not.toContain("data-glass-batch-target");
    expect(pattern).not.toContain("data-side-panel-reveal-cover");
    expect(pattern).toContain("WorkspaceSidePanelContentSwitcher");
    expect(patternCss).toContain("z-index: 0");
    expect(patternCss).not.toContain("taskmap-workspace-side-panel__reveal-cover");
    expect(patternCss).not.toContain("data-content-motion");
    expect(motion).toContain("WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS = 240");
    expect(motion).toContain("WORKSPACE_SIDE_PANEL_OFFSCREEN_MARGIN_PX = 32");
    expect(motion).toContain("easeInCubic");
    expect(motion).toContain("easeOutCubic");
    expect(motion).toMatch(/panel\.style\.(?:transform|willChange)/);
    expect(motion).not.toMatch(/panel\.style\.(?:opacity|filter|backdropFilter)/);
    expect(boundary).not.toMatch(
      /(?:-webkit-)?backdrop-filter\s*:|createBrowserAcrylicRuntime|acrylicCache|MaterialCompositorProvider|requestAnimationFrame/i,
    );
    expect(appShell.match(/<MaterialCompositorProvider\b/g)).toHaveLength(1);
  });

  it("retains embedded and portal boundaries as later C2 slices migrate panel contents", async () => {
    const [canvasManager, extensionsPanel] = await Promise.all([
      readFile(canvasManagerPath, "utf8"),
      readFile(extensionsPanelPath, "utf8"),
    ]);

    expect(canvasManager).toContain("return embedded || sharedPanel ? (");
    expect(extensionsPanel).toContain("if (embedded || sharedPanel)");
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
