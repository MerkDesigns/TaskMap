import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  findMaterialArchitectureViolations,
  FROZEN_LEGACY_MATERIAL_USAGE,
} from "./material-architecture-rules.mjs";

describe("transitional material architecture rules", () => {
  it("accepts the exact frozen legacy production occurrences", async () => {
    const paths = new Set(
      Object.values(FROZEN_LEGACY_MATERIAL_USAGE).flatMap((allowance) => Object.keys(allowance)),
    );
    const entries = await Promise.all(
      [...paths].map(async (path) => ({ path, source: await readFile(path, "utf8") })),
    );

    expect(findMaterialArchitectureViolations(entries)).toEqual([]);
  });

  it("rejects a new direct backdrop-filter declaration", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/features/example/Panel.css",
          source: ".panel { backdrop-filter: blur(8px); }",
        },
      ]),
    ).toEqual([
      "src/features/example/Panel.css: direct backdrop-filter declaration has 1 occurrence(s); frozen legacy allowance is 0",
    ]);
  });

  it("rejects direct Liquid DOM imports outside the shared runtime", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/features/example/Panel.tsx",
          source: 'import { Glass } from "@liquid-dom/core";',
        },
      ]),
    ).toEqual([
      "src/features/example/Panel.tsx: @liquid-dom/core may only be instantiated by the shared Liquid DOM runtime",
    ]);
  });

  it("rejects Liquid DOM imports from the production canvas", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/canvas/RendererV2CanvasViewport.tsx",
          source: 'import { Glass } from "@liquid-dom/core";',
        },
      ]),
    ).toEqual([
      "src/canvas/RendererV2CanvasViewport.tsx: @liquid-dom/core may only be instantiated by the shared Liquid DOM runtime",
    ]);
  });

  it("accepts the shared Liquid DOM runtime dependency", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/ui/materials/liquid-dom/liquidDomRuntime.ts",
          source: 'import { Glass } from "@liquid-dom/core";',
        },
      ]),
    ).toEqual([]);
  });

  it.each([
    "src/ui/dev/renderer-benchmark/liquidCanvasBrowserRuntime.ts",
    "src/ui/dev/renderer-benchmark/liquidCanvasCardGeometry.ts",
    "src/ui/dev/renderer-benchmark/liquidSceneBenchmarkRuntime.ts",
  ])("accepts an isolated development benchmark Liquid DOM adapter: %s", (path) => {
    expect(
      findMaterialArchitectureViolations([
        {
          path,
          source: 'import { Group, Html } from "@liquid-dom/core";',
        },
      ]),
    ).toEqual([]);
  });

  it("rejects a new Tailwind backdrop-blur utility", () => {
    expect(
      findMaterialArchitectureViolations([
        { path: "src/features/example/Panel.tsx", source: 'className="backdrop-blur-md"' },
      ]),
    ).toEqual([
      "src/features/example/Panel.tsx: Tailwind backdrop-blur utility has 1 occurrence(s); frozen legacy allowance is 0",
    ]);
  });

  it("rejects growth even inside a frozen legacy file", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/components/FpsCounter.tsx",
          source: '"backdrop-blur-md backdrop-blur-sm"',
        },
      ]),
    ).toEqual([
      "src/components/FpsCounter.tsx: Tailwind backdrop-blur utility has 2 occurrence(s); frozen legacy allowance is 1",
    ]);
  });

  it.each(["src/features/example/AcrylicPreview.ts", "src/ui/materials/BadAcrylic.ts"])(
    "rejects acrylic Canvas2D outside the compositor subtree: %s",
    (path) => {
      expect(
        findMaterialArchitectureViolations([
          { path, source: 'const acrylic = canvas.getContext("2d");' },
        ]),
      ).toEqual([
        `${path}: acrylic Canvas2D implementation belongs under src/ui/materials/compositor`,
      ]);
    },
  );

  it("accepts acrylic Canvas2D inside the compositor subtree", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/ui/materials/compositor/example.ts",
          source: 'const acrylic = canvas.getContext("2d");',
        },
      ]),
    ).toEqual([]);
  });

  it("accepts ordinary non-acrylic Canvas2D rendering elsewhere", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/features/minimap/renderMinimap.ts",
          source: 'const context = canvas.getContext("2d");',
        },
      ]),
    ).toEqual([]);
  });

  it("rejects Blob-based acrylic workers", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/ui/materials/compositor/badWorker.ts",
          source: 'const worker = new Worker(URL.createObjectURL(new Blob(["source"])));',
        },
      ]),
    ).toEqual([
      "src/ui/materials/compositor/badWorker.ts: acrylic workers must be Vite module workers, not Blob workers",
    ]);
  });

  it.each(["../../../legacy/TaskCanvas", "../../../elements/registry", "react-redux"])(
    "rejects forbidden compositor imports: %s",
    (specifier) => {
      expect(
        findMaterialArchitectureViolations([
          {
            path: "src/ui/materials/compositor/badBoundary.ts",
            source: `import value from "${specifier}";`,
          },
        ]),
      ).toEqual([
        `src/ui/materials/compositor/badBoundary.ts: compositor runtime must not import forbidden boundary ${specifier}`,
      ]);
    },
  );

  it("accepts the Vite module-worker construction form", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/ui/materials/compositor/acrylicWorkerFactory.ts",
          source:
            'new Worker(new URL("./acrylicCache.worker.ts", import.meta.url), { type: "module" });',
        },
      ]),
    ).toEqual([]);
  });

  it("rejects compositor DOM discovery", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/ui/materials/compositor/domCapture.ts",
          source: 'document.querySelectorAll("[data-element]");',
        },
      ]),
    ).toEqual([
      "src/ui/materials/compositor/domCapture.ts: compositor runtime must not discover presentation through DOM scans",
    ]);
  });

  it("rejects legacy backdrop world-element measurement", () => {
    expect(
      findMaterialArchitectureViolations([
        {
          path: "src/legacy/materials/domBackdrop.ts",
          source: "element.getBoundingClientRect();",
        },
      ]),
    ).toEqual([
      "src/legacy/materials/domBackdrop.ts: legacy backdrop projection must read models, not world DOM geometry",
    ]);
  });
});
