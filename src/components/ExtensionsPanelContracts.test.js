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

describe("Phase 4.5C2E Extensions panel architecture contracts", () => {
  it("owns accepted card/icon geometry and production/embedded material mapping in one pattern", async () => {
    const [pattern, css] = await Promise.all([
      readFile(patternPath, "utf8"),
      readFile(patternCssPath, "utf8"),
    ]);

    expect(pattern).toContain('material={embedded ? "opaque" : "acrylic-small"}');
    expect(pattern).toContain('material="cutout"');
    expect(pattern).toContain("radius = 10");
    expect(pattern).toContain("radius = 6");
    expect(pattern).toContain("radius={radius}");
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
    // The filter opens a menu: its active state uses the primitive's data-selected, not a press.
    expect(main).toContain("data-selected={!allTargetsSelected || undefined}");
    expect(main).toContain("aria-pressed={favorited}");
    expect(main.match(/aria-pressed/g)).toHaveLength(1);
    // Card actions are 90% of the compact control by user direction; no local rim/state overrides.
    expect(css).toContain("calc(var(--taskmap-control-height-compact) * 0.9)");
    expect(css).not.toMatch(/data-filter-active|data-favorited/);
    expect(`${main}\n${css}`).not.toMatch(/#2dd8c8|45\s*,\s*216\s*,\s*200/i);
  });

  it("keeps the filter portal boundary while Quick Extensions uses shared glass patterns", async () => {
    const source = await readFile(panelPath, "utf8");
    const quickStart = source.indexOf("export function QuickExtensionsMenu");
    const mainStart = source.indexOf("export function ExtensionsPanel");
    const quick = source.slice(quickStart, mainStart);
    const main = source.slice(mainStart);

    expect(quick).toContain("data-quick-extensions-menu");
    expect(quick).toContain("<MaterialSurface");
    expect(quick).toContain("<SearchField");
    expect(quick).toContain("<GlassListFrame");
    expect(quick).toContain("taskmap-scrollbar-hidden");
    expect(quick).toContain("<ExtensionBrowserCard");
    expect(quick).not.toContain("frosted-glass");

    // The filter uses the shared ContextMenu (portaled, checkable items), not a local panel.
    expect(main).toContain("<ContextMenu");
    expect(main).toContain("checked={selectedTargets.includes(target)}");
    expect(main).not.toMatch(/context-menu-panel|context-menu-enter/);
    expect(main).not.toMatch(/QuickExtensionsMenu|Minimap|Settings/);
  });

  it("retains drag ownership without new compositor, cache, provider, or animation-frame work", async () => {
    const [source, pattern, drag] = await Promise.all([
      readFile(panelPath, "utf8"),
      readFile(patternPath, "utf8"),
      readFile(dragPath, "utf8"),
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
  });
});
