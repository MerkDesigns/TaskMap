// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";
import { MINIMAP_MAX_SIZE } from "../constants";

const appPath = new URL("../App.tsx", import.meta.url);
const appShellPath = new URL("../app/AppShell.tsx", import.meta.url);
const minimapPath = new URL("./Minimap.tsx", import.meta.url);
const patternPath = new URL("../ui/patterns/workspace/MinimapSurface.tsx", import.meta.url);
const patternCssPath = new URL("../ui/patterns/workspace/MinimapSurface.css", import.meta.url);
const motionPath = new URL(
  "../ui/patterns/workspace/useMinimapVisibilityMotion.ts",
  import.meta.url,
);
const themePath = new URL("../ui/theme/theme.css", import.meta.url);

describe("Phase 4.5C2F Minimap architecture contracts", () => {
  it("places only the Minimap addition inside the existing WorkspaceChromeLayer", async () => {
    const app = await readFile(appPath, "utf8");
    const start = app.indexOf("<WorkspaceChromeLayer>");
    const end = app.indexOf("</WorkspaceChromeLayer>", start);
    const layer = app.slice(start, end);

    expect(app.match(/<WorkspaceChromeLayer>/g)).toHaveLength(1);
    for (const component of ["FloatingToolbar", "CanvasManager", "ExtensionsPanel", "Minimap"]) {
      expect(layer).toMatch(new RegExp(`<${component}\\b`));
    }
    expect(layer).not.toMatch(
      /<(?:QuickExtensionsMenu|SettingsModal|ToastStack|DevelopmentFpsCounter|\w*ContextMenu)\b/,
    );
    expect(app.indexOf("<ToastStack", end)).toBeGreaterThan(end);
    expect(app).toContain("minimapEnabled && minimapMounted");
    expect(app).toContain("visible={minimapVisible}");
    expect(app).toContain("MINIMAP_VISIBILITY_DURATION_MS");
  });

  it("uses shared materials and exact shell/interior geometry without local stacking or blur", async () => {
    const [minimap, pattern, css, theme] = await Promise.all([
      readFile(minimapPath, "utf8"),
      readFile(patternPath, "utf8"),
      readFile(patternCssPath, "utf8"),
      readFile(themePath, "utf8"),
    ]);
    const boundary = `${minimap}\n${pattern}\n${css}`;
    const shellWidth = readPixelValue(css, "width");
    const horizontalPadding = readPixelValue(theme, "--taskmap-space-2");

    expect(pattern).toContain('material="acrylic-large"');
    expect(pattern).toContain("radius={12}");
    expect(pattern).toContain('material="cutout"');
    expect(pattern).toContain("radius={6}");
    expect(css).toContain("box-sizing: border-box");
    expect(shellWidth).toBe(192);
    expect(shellWidth).toBeGreaterThanOrEqual(MINIMAP_MAX_SIZE + horizontalPadding * 2);
    expect(css).toContain("right: var(--taskmap-chrome-inset)");
    expect(css).toContain("bottom: var(--taskmap-chrome-inset)");
    expect(css).toContain("padding: var(--taskmap-space-2)");
    expect(boundary).not.toMatch(
      /frosted-glass|backdrop-blur|backdrop-filter|z-index:\s*(?:20|40|41|9999)/i,
    );
  });

  it("uses semantic spatial tokens and preserves content-owned accent projection", async () => {
    const [minimap, css] = await Promise.all([
      readFile(minimapPath, "utf8"),
      readFile(patternCssPath, "utf8"),
    ]);

    expect(css).toContain("var(--taskmap-minimap-viewport)");
    expect(css).toContain("var(--taskmap-minimap-element)");
    expect(minimap).not.toMatch(/#c8dae8|#7aa2c8/i);
    expect(minimap).toContain("borderColor: element.accent");
    expect(minimap).toContain("borderColor: image.accent");
    expect(minimap).toContain("getTextCardAccent(card.accent)");
    expect(minimap).toContain("createMinimapProjection(");
    expect(minimap).toContain("MINIMAP_MAX_SIZE");
  });

  it("shares opacity motion without new compositor infrastructure or animation loops", async () => {
    const [appShell, motion, pattern, minimap] = await Promise.all([
      readFile(appShellPath, "utf8"),
      readFile(motionPath, "utf8"),
      readFile(patternPath, "utf8"),
      readFile(minimapPath, "utf8"),
    ]);
    const boundary = `${motion}\n${pattern}\n${minimap}`;

    expect(motion).toContain("useMotionFrameScheduler");
    expect(motion).not.toContain("useMaterialSurfaceMaskOpacity");
    expect(motion).not.toContain("useMaterialSurfaceGeometryInvalidation");
    expect(boundary).not.toMatch(
      /requestAnimationFrame|createBrowserAcrylicRuntime|acrylicCache|MaterialCompositorProvider/i,
    );
    expect(appShell.match(/<MaterialCompositorProvider\b/g)).toHaveLength(1);
  });

  it("keeps reset-only behavior and does not add navigation handlers", async () => {
    const minimap = await readFile(minimapPath, "utf8");
    expect(minimap).toContain('aria-label="Reset zoom"');
    expect(minimap).toContain("onClick={onResetZoom}");
    expect(minimap).not.toMatch(/onPointerMove|onPointerDown|onWheel|onPan|onViewportChange/);
  });
});

function readPixelValue(source, property) {
  const match = source.match(new RegExp(`${property.replaceAll("-", "\\-")}\\s*:\\s*(\\d+)px`));
  if (!match) throw new Error(`Missing pixel value for ${property}`);
  return Number(match[1]);
}
