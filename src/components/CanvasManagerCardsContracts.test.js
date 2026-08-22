// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const canvasManagerPath = new URL("./CanvasManager.tsx", import.meta.url);
const extensionsPanelPath = new URL("./ExtensionsPanel.tsx", import.meta.url);
const appShellPath = new URL("../app/AppShell.tsx", import.meta.url);
const patternPath = new URL("../ui/patterns/workspace/CanvasBrowserCard.tsx", import.meta.url);
const patternCssPath = new URL("../ui/patterns/workspace/CanvasBrowserCard.css", import.meta.url);
const browserCssPath = new URL("../ui/patterns/workspace/CanvasBrowser.css", import.meta.url);
const panelCssPath = new URL("../ui/patterns/workspace/WorkspaceSidePanel.css", import.meta.url);
const runtimePath = new URL("../ui/patterns/workspace/CanvasBrowserRuntime.ts", import.meta.url);
const interactionPath = new URL(
  "../ui/patterns/workspace/canvasBrowserInteraction.ts",
  import.meta.url,
);

describe("Phase 4.5C2D Canvas Browser architecture contracts", () => {
  it("owns accepted card/preview geometry and token-based application states in one pattern", async () => {
    const [pattern, css, browserCss, panelCss] = await Promise.all([
      readFile(patternPath, "utf8"),
      readFile(patternCssPath, "utf8"),
      readFile(browserCssPath, "utf8"),
      readFile(panelCssPath, "utf8"),
    ]);

    expect(pattern).toContain('material={embedded ? "opaque" : "acrylic-small"}');
    expect(pattern).toContain('backdropSource={embedded ? undefined : "shared"}');
    expect(pattern).toContain('material="cutout"');
    expect(pattern).toContain('mode === "minimal" ? 8 : undefined');
    expect(css).toContain("min-height: 84px");
    expect(css).toContain("height: 40px");
    expect(css).toContain("width: 114.4px");
    expect(css).toContain("height: 66px");
    expect(css).toContain('font-family: "Segoe UI", system-ui, sans-serif');
    expect(css).toContain("padding: 9px");
    expect(css).not.toContain("overflow-clip-margin");
    expect(pattern).toContain('className="taskmap-canvas-browser-card__content-mask"');
    expect(css).toMatch(
      /\.taskmap-canvas-browser-card__content-mask\s*\{[^}]*overflow:\s*hidden;[^}]*border-radius:\s*calc\(/s,
    );
    expect(browserCss).toMatch(
      /\.taskmap-canvas-browser__cards-layer\s*\{[^}]*pointer-events:\s*none;/s,
    );
    expect(browserCss).toMatch(
      /\.taskmap-canvas-browser-card-host\s*\{[^}]*pointer-events:\s*none;/s,
    );
    expect(browserCss).toMatch(
      /\.taskmap-canvas-browser-card-host\s*>\s*\.taskmap-canvas-browser-card\s*\{[^}]*pointer-events:\s*auto;/s,
    );
    expect(css).not.toContain("margin-left: 2px");
    expect(css).toContain("gap: 10px");
    expect(css).toContain("font-size: 14px");
    expect(css).toContain("font-size: 11px");
    expect(css).toContain("height: 22px");
    expect(css).toContain("right: 11px");
    expect(browserCss).toContain("var(--taskmap-toolbar-height)");
    expect(browserCss).toContain("var(--taskmap-chrome-gap)");
    expect(panelCss).toContain("left: var(--taskmap-chrome-inset-inline)");
    expect(browserCss).toContain("width: 288px");
    expect(browserCss).toContain("flex: 0 0 58px");
    expect(browserCss).toContain("left: 12px");
    expect(browserCss).toContain("width: 264px");
    expect(browserCss).toContain(
      '.taskmap-workspace-panel-header__icon-toggle[aria-pressed="true"]',
    );
    expect(browserCss).toContain("background: transparent");
    expect(browserCss).toContain("color: var(--taskmap-accent)");
    expect(browserCss).toContain("box-shadow: none");
    expect(css).toContain("var(--taskmap-accent)");
    expect(css).toContain("var(--taskmap-accent-rgb)");
    expect(css).not.toContain(".taskmap-canvas-browser-card:hover");
    expect(css).not.toContain("var(--taskmap-accent-wash)");
    expect(`${pattern}\n${css}`).not.toContain("bright-selection");
    expect(`${pattern}\n${css}`).not.toMatch(/#2dd8c8|45\s*,\s*216\s*,\s*200/i);
  });

  it("uses production primitives and the transient browser runtime while retaining overlays", async () => {
    const [manager, runtime, interaction, extensions] = await Promise.all([
      readFile(canvasManagerPath, "utf8"),
      readFile(runtimePath, "utf8"),
      readFile(interactionPath, "utf8"),
      readFile(extensionsPanelPath, "utf8"),
    ]);

    expect(manager).toContain("<CanvasBrowserCard");
    expect(manager).toContain("<CanvasPreview>");
    expect(manager).toContain("<Field");
    expect(manager).toContain("<TextField");
    expect(manager).toContain("<IconButton");
    expect(manager).toContain("new CanvasBrowserRuntime<string>");
    expect(manager).toContain("useMaterialSurfaceGeometryInvalidation");
    expect(manager).toContain("<SharedSmallGlassPlane");
    expect(manager).not.toContain("useMaterialSurfaceMaskOpacity");
    expect(runtime).toContain("private readonly tick");
    expect(runtime).toContain("if (this.needsFrame()) this.requestFrame()");
    expect(interaction).toContain("CANVAS_CARD_SLOT_TRANSITION_MS = 190");
    expect(manager).not.toContain("applyLocalFlip(");
    expect(manager).toContain("createPortal(");
    expect(manager).toContain("data-new-canvas-menu");
    expect(manager).toContain("data-context-menu");
    expect(manager).not.toContain("left-panel-card");
    expect(extensions).toContain("<ExtensionBrowserCard");
  });

  it("uses stable portal hosts for the actual card and introduces no clone/compositor path", async () => {
    const [manager, pattern, browserCss, runtime, appShell] = await Promise.all([
      readFile(canvasManagerPath, "utf8"),
      readFile(patternPath, "utf8"),
      readFile(browserCssPath, "utf8"),
      readFile(runtimePath, "utf8"),
      readFile(appShellPath, "utf8"),
    ]);
    const boundary = `${manager}\n${pattern}\n${browserCss}\n${runtime}`;

    expect(manager).toContain("cardPortalHostsRef");
    expect(manager).toContain("return createPortal(");
    expect(runtime).toContain("this.dragLayer.append(record.host)");
    expect(runtime).toContain("this.options.cardsLayer.append(record.host)");
    expect(browserCss).toContain(".taskmap-canvas-browser-drag-layer");
    expect(boundary).not.toMatch(/cloneNode|drag-preview|canvas-card-placeholder/);
    expect(boundary).not.toMatch(
      /backdrop-filter|createBrowserAcrylicRuntime|createMaterialSurfaceRegistry|MaterialCompositorProvider|acrylicCache/i,
    );
    expect(appShell.match(/<MaterialCompositorProvider\b/g)).toHaveLength(1);
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
