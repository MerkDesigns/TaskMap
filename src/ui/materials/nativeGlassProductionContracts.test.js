// @vitest-environment node
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("production glass hot-path contracts", () => {
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
