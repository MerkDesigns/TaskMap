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
    expect(pattern).toContain("radius={8}");
    expect(pattern).toContain("radius={6}");
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

  it("keeps the filter portal legacy and Quick Extensions structurally unmigrated", async () => {
    const source = await readFile(panelPath, "utf8");
    const quickStart = source.indexOf("export function QuickExtensionsMenu");
    const mainStart = source.indexOf("export function ExtensionsPanel");
    const quick = source.slice(quickStart, mainStart);
    const main = source.slice(mainStart);

    expect(quick).toContain("data-quick-extensions-menu");
    expect(quick).toContain("frosted-glass context-menu-enter");
    expect(quick).toContain("<input");
    expect(quick).toContain("h-[43px]");
    expect(quick).toContain("quick-extensions-scroll");
    expect(quick).not.toMatch(/ExtensionBrowserCard|SearchField/);

    expect(main).toContain("data-extension-filter-menu");
    expect(main).toContain("context-menu-panel context-menu-enter");
    expect(main).toContain("createPortal(");
    expect(main).not.toMatch(/ContextMenu\b|material="(?:opaque|acrylic-small)"/);
    expect(main).not.toMatch(/QuickExtensionsMenu|Minimap|Settings/);
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
    expect(appShell).toContain("<RendererV2Prototype />");
  });
});
