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
});
