// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const rootUrl = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, rootUrl), "utf8");

describe("UI Lab Surface architecture", () => {
  it("reuses the one production boundary without duplicating material recipes", async () => {
    const [material, surface, prototype] = await Promise.all([
      read("src/ui-lab/system/Material.ts"),
      read("src/ui-lab/system/Surface.tsx"),
      read("src/ui-lab/SurfaceMaterialPrototype.tsx"),
    ]);
    const sources = `${material}\n${surface}\n${prototype}`;

    expect(surface).toContain('from "../../ui/materials/MaterialSurface"');
    expect(surface).not.toMatch(/\.css["']/);
    expect(sources).not.toMatch(
      /backdrop-filter|\bblur\b|\bpreblur\b|\boverscan\b|\btint\b|\brim\b|\bbox-shadow\b/i,
    );
  });

  it("keeps the primitive dependency boundary limited to React and production materials", async () => {
    const [material, surface] = await Promise.all([
      read("src/ui-lab/system/Material.ts"),
      read("src/ui-lab/system/Surface.tsx"),
    ]);
    const imports = [...`${material}\n${surface}`.matchAll(/from\s+["']([^"']+)["']/g)].map(
      (match) => match[1],
    );

    expect(imports).toEqual([
      "../../ui/materials/materialTypes",
      "react",
      "../../ui/materials/MaterialSurface",
      "./Material",
    ]);
    expect(`${material}\n${surface}`).not.toMatch(
      /redux|persistence|database|AppShell|LegacyApplication|AppProviders|@tauri-apps|VisualGroup|OpacityGroup|motion|presence/i,
    );
  });

  it("does not style the primitive with implicit geometry or containment defaults", async () => {
    const css = await read("src/ui-lab/uiLab.css");

    expect(css).not.toMatch(/\.taskmap-ui-lab-surface\s*\{/);
  });

  it("documents exactly Surface, Material, and ordinary Content as core concepts", async () => {
    const [simple, reference] = await Promise.all([
      read("docs/ui-architecture/SIMPLE-UI-SYSTEM.md"),
      read("docs/ui-architecture/UI-SYSTEM-PART-REFERENCE.md"),
    ]);
    const documentation = `${simple}\n${reference}`;

    expect(documentation).toContain("The three core concepts");
    expect(documentation).toContain("### Surface");
    expect(documentation).toContain("### Material");
    expect(documentation).toContain("### Content");
    expect(documentation).toContain("does not require a universal component or wrapper");
    expect(documentation).toContain("material-aware presence");
    expect(documentation).not.toMatch(
      /VisualGroup|ContentLayer|OpacityGroup|four core concepts|group progress|group transform|alpha[- ]mask/i,
    );
    expect(simple).toContain("[TaskMap UI System Part Reference](UI-SYSTEM-PART-REFERENCE.md)");
    expect(reference).toContain("[TaskMap Simple UI System](SIMPLE-UI-SYSTEM.md)");
    expect(documentation).toContain(
      "Native glass must never be faded using ancestor opacity, masks, or `filter: opacity()`.",
    );
  });

  it("keeps the experimental fade seam in materials and behavior on the Surface ref", async () => {
    const [prototype, controller, hook, labCss, materialCss] = await Promise.all([
      read("src/ui-lab/MaterialAwarePresencePrototype.tsx"),
      read("src/ui-lab/system/presenceController.ts"),
      read("src/ui-lab/system/useSurfacePresence.ts"),
      read("src/ui-lab/materialAwarePresence.css"),
      read("src/ui/materials/MaterialSurface.css"),
    ]);

    expect(prototype).toContain("animatedRef={surfaceRef}");
    expect(hook).toContain("useMotionFrameScheduler");
    expect(controller).not.toMatch(/requestAnimationFrame|querySelector|querySelectorAll/);
    expect(labCss).not.toMatch(/(?:-webkit-)?backdrop-filter\s*:|box-shadow\s*:/);
    expect(materialCss).toContain("--taskmap-material-presence-progress");
  });
});
