export const FROZEN_LEGACY_MATERIAL_USAGE = Object.freeze({
  directBackdropFilter: Object.freeze({
    "src/ui/materials/MaterialSurface.css": 2,
    "src/ui/materials/nativeGlassRecipe.css": 4,
  }),
  tailwindBackdropBlur: Object.freeze({
    "src/components/ToastStack.tsx": 1,
  }),
  legacyFrostedClass: Object.freeze({}),
  // FrostedSurface was removed; the patterns stay as zero-allowance guards.
  frostedSurfaceImport: Object.freeze({}),
  frostedSurfaceElement: Object.freeze({}),
});

const MATERIAL_PATTERNS = Object.freeze([
  {
    name: "direct backdrop-filter declaration",
    allowanceKey: "directBackdropFilter",
    expression: /(?:^|[^\w-])(?:-webkit-)?backdrop-filter\s*:/gm,
    allowance: FROZEN_LEGACY_MATERIAL_USAGE.directBackdropFilter,
  },
  {
    name: "Tailwind backdrop-blur utility",
    allowanceKey: "tailwindBackdropBlur",
    expression: /\bbackdrop-blur-(?:none|sm|md|lg|xl|2xl|3xl|\[[^\]\s"'`]+\])/g,
    allowance: FROZEN_LEGACY_MATERIAL_USAGE.tailwindBackdropBlur,
  },
  {
    name: "legacy frosted-glass class",
    allowanceKey: "legacyFrostedClass",
    expression: /\bfrosted-glass(?:-toolbar)?\b/g,
    allowance: FROZEN_LEGACY_MATERIAL_USAGE.legacyFrostedClass,
  },
  {
    name: "FrostedSurface consumer",
    allowanceKey: "frostedSurfaceImport",
    expression: /from\s+["'][^"']*\/FrostedSurface["']/g,
    allowance: FROZEN_LEGACY_MATERIAL_USAGE.frostedSurfaceImport,
  },
  {
    name: "FrostedSurface element",
    allowanceKey: "frostedSurfaceElement",
    expression: /<FrostedSurface\b/g,
    allowance: FROZEN_LEGACY_MATERIAL_USAGE.frostedSurfaceElement,
  },
]);

function matchCount(source, expression) {
  return [...source.matchAll(expression)].length;
}

export function findMaterialArchitectureViolations(entries) {
  const violations = [];

  for (const { path, source } of entries) {
    for (const rule of MATERIAL_PATTERNS) {
      const count = matchCount(source, rule.expression);
      const allowed = rule.allowance[path] ?? 0;
      if (count > allowed) {
        violations.push(
          `${path}: ${rule.name} has ${count} occurrence(s); frozen legacy allowance is ${allowed}`,
        );
      }
    }

    // The cached Canvas2D acrylic compositor was retired; materials are native glass.
    const combinesAcrylicAndCanvas2d =
      /acrylic/i.test(source) &&
      /(?:getContext\(\s*["']2d["']|CanvasRenderingContext2D)/.test(source);
    if (combinesAcrylicAndCanvas2d) {
      violations.push(
        `${path}: acrylic Canvas2D rendering was retired; use MaterialSurface native glass`,
      );
    }
  }

  return violations;
}
