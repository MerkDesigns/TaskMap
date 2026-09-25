// @vitest-environment node
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("production glass hot-path contracts", () => {
  it("masks local filter outputs without masking their ancestor, content, rim or shared batches", () => {
    const css = source("./MaterialSurface.css");
    const rule = css.match(
      /([^{}]+)\{([^{}]*mask-image: var\(--taskmap-material-output-mask\)[^{}]*)\}/,
    );
    expect(rule).not.toBeNull();
    expect(rule[1]).toContain('[data-material-backdrop-source="self"]');
    expect(rule[1]).toMatch(
      /> \.taskmap-material-native-glass__clip\s*> :is\(\.taskmap-native-glass-preblur, \.taskmap-native-glass-backdrop\)/,
    );
    for (const edge of ["top", "right", "bottom", "left"])
      expect(rule[2]).toContain(`--taskmap-material-overscan-${edge}`);
    expect(rule[2]).not.toMatch(/backdrop-filter|opacity|transform/);
    expect(source("./nativeGlassGeometry.ts")).not.toMatch(/output-mask|encodeURIComponent/);
  });
  it("keeps parked scene preparation and registry construction outside production composition", () => {
    for (const path of [
      "../../App.tsx",
      "../../app/AppShell.tsx",
      "../../legacy/LegacyApplication.tsx",
      "./MaterialCompositorProvider.tsx",
    ]) {
      expect(source(path)).not.toMatch(
        /projectLegacyBackdropScene|advanceLegacyBackdropSceneRevision|buildBackdropScene|createMaterialCompositorPresentationBridge|createMaterialSurfaceRegistry/,
      );
    }
  });

  it("keeps presentation-only motion independent of the parked material registry", () => {
    for (const path of [
      "../primitives/usePressSpringScale.ts",
      "../primitives/LiquidToggleSwitch.tsx",
      "../primitives/LiquidSelectionIndicator.tsx",
      "../patterns/overlays/ModalPresence.tsx",
      "../../components/FloatingToolbar.tsx",
    ]) {
      expect(source(path)).not.toContain("MaterialSurfaceRegistration");
    }
  });

  it("defines optical filter formulas once and contains no revision transform nudge", () => {
    expect(source("./nativeGlassRecipe.css")).toContain(
      "--taskmap-material-blur-presence-progress",
    );
    expect(source("./SharedSmallGlassPlane.css")).not.toContain("backdrop-filter:");
    expect(source("./SharedSmallGlassPlane.tsx")).not.toContain(
      'style.setProperty("backdrop-filter"',
    );
    expect(source("./MaterialSurface.css")).not.toContain("backdrop-filter: blur(");
    for (const path of [
      "./nativeGlassRecipe.css",
      "./MaterialSurface.css",
      "./materialGeometryInvalidation.ts",
    ]) {
      expect(source(path)).not.toMatch(/0\.01px|backdrop-revision/);
    }
  });
});
