// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const panelPath = new URL("./ExtensionsPanel.tsx", import.meta.url);
const patternPath = new URL("../ui/patterns/workspace/ExtensionBrowserCard.tsx", import.meta.url);
const patternCssPath = new URL(
  "../ui/patterns/workspace/ExtensionBrowserCard.css",
  import.meta.url,
);
const quickCssPath = new URL("./QuickExtensionsMenu.css", import.meta.url);
const dragPath = new URL("../extensions/useExtensionDrag.ts", import.meta.url);
const appShellPath = new URL("../app/AppShell.tsx", import.meta.url);

describe("Phase 4.5C2E Extensions panel architecture contracts", () => {
  it("owns accepted card/icon geometry and production/embedded material mapping in one pattern", async () => {
    const [pattern, css] = await Promise.all([
      readFile(patternPath, "utf8"),
      readFile(patternCssPath, "utf8"),
    ]);

    expect(pattern).toContain('material={embedded ? "opaque" : "acrylic-small"}');
    expect(pattern).toContain('material="cutout"');
    expect(pattern).toContain("radius = 8");
    expect(pattern).toContain("radius = 6");
    expect(css).toContain("min-height: 58px");
    expect(css).toContain("height: 58px");
    expect(css).toContain("width: 32px");
    expect(css).toContain("height: 32px");
    expect(`${pattern}\n${css}`).not.toMatch(/backdrop-filter|left-panel-card/i);
  });

  it("uses C1 search/icon controls and target-token filter application state", async () => {
    const [source, css] = await Promise.all([
      readFile(panelPath, "utf8"),
      readFile(patternCssPath, "utf8"),
    ]);
    const main = source.slice(source.indexOf("export function ExtensionsPanel"));

    expect(main).toContain("<SearchField");
    expect(main).toContain("prefixSlot={<IconSearch");
    expect(main).toContain("<IconButton");
    expect(main).toContain("aria-expanded={filterOpen}");
    expect(main).not.toContain("aria-pressed");
    expect(css).toContain("var(--taskmap-accent)");
    expect(css).toContain("var(--taskmap-accent-rgb)");
    expect(`${main}\n${css}`).not.toMatch(/#2dd8c8|45\s*,\s*216\s*,\s*200/i);
  });

  it("routes the filter portal and Quick Extensions through the accepted material patterns", async () => {
    const [source, quickCss] = await Promise.all([
      readFile(panelPath, "utf8"),
      readFile(quickCssPath, "utf8"),
    ]);
    const quickStart = source.indexOf("export function QuickExtensionsMenu");
    const mainStart = source.indexOf("export function ExtensionsPanel");
    const quick = source.slice(quickStart, mainStart);
    const main = source.slice(mainStart);

    expect(quick).toContain("data-quick-extensions-menu");
    expect(quick).toContain("<MaterialSurface");
    expect(quick).toContain('material="acrylic-large"');
    expect(quick).toContain("<SearchField");
    expect(quick).toContain("<ExtensionBrowserCard");
    expect(quick).toContain("quick-extensions-scroll");
    expect(quick).toContain("useSurfacePresence(menuRef");
    expect(quick).toContain("effects: FadeLift");
    expect(quick).not.toMatch(/frosted-glass|backdrop-filter/);
    expect(quickCss).not.toMatch(/@keyframes\s+taskmap-quick-extensions|animation\s*:/);

    expect(main).toContain("data-extension-filter-menu");
    expect(main).toContain("context-menu-panel context-menu-enter");
    expect(main).toContain("createPortal(");
    expect(main).toContain("<MaterialSurface");
    expect(main).toContain('material="opaque"');
    expect(main).not.toMatch(/frosted-glass|backdrop-filter/);
    expect(main).not.toMatch(/QuickExtensionsMenu|Minimap|Settings/);
  });

  it("keeps extension cards inside their columns while reserving an internal shadow gutter", async () => {
    const [patternCss, quickCss] = await Promise.all([
      readFile(patternCssPath, "utf8"),
      readFile(quickCssPath, "utf8"),
    ]);

    expect(patternCss).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(patternCss).toContain("margin-inline: calc(0px - var(--taskmap-panel-padding))");
    expect(patternCss).toContain(
      "padding: 1px var(--taskmap-panel-padding) var(--taskmap-panel-padding)",
    );
    expect(quickCss).toContain("margin-inline: calc(0px - var(--taskmap-space-3))");
    expect(quickCss).toContain("padding: var(--taskmap-space-3)");
    expect(quickCss).toContain("var(--taskmap-material-presence-progress, 1)");
  });

  it("retains drag ownership without new compositor, cache, provider, or animation-frame work", async () => {
    const [source, pattern, drag, appShell] = await Promise.all([
      readFile(panelPath, "utf8"),
      readFile(patternPath, "utf8"),
      readFile(dragPath, "utf8"),
      readFile(appShellPath, "utf8"),
    ]);
    const main = source.slice(source.indexOf("export function ExtensionsPanel"));
    const boundary = `${main}\n${pattern}`;

    expect(main).toContain("useExtensionDrag({");
    expect(main).toContain("data-extension-drag-preview");
    expect(main).toContain("createPortal(dragPreview, document.body)");
    expect(drag).toContain('window.addEventListener("pointermove"');
    expect(drag).toContain('window.addEventListener("pointerup"');
    expect(drag).toContain('window.addEventListener("pointercancel"');
    expect(boundary).not.toMatch(
      /requestAnimationFrame|useMaterialSurfaceMaskOpacity|createBrowserAcrylicRuntime|acrylicCache|MaterialCompositorProvider/i,
    );
    expect(appShell.match(/<MaterialCompositorProvider\b/g)).toHaveLength(1);
  });
});
