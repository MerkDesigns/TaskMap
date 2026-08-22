export const FROZEN_LEGACY_MATERIAL_USAGE = Object.freeze({
  directBackdropFilter: Object.freeze({
    "src/index.css": 4,
    "src/ui/materials/FrostedSurface.css": 2,
    "src/ui/materials/MaterialSurface.css": 4,
    "src/ui/materials/SharedSmallGlassPlane.css": 2,
  }),
  tailwindBackdropBlur: Object.freeze({
    "src/App.tsx": 1,
    "src/components/CanvasManager.tsx": 2,
    "src/components/ExtensionsPanel.tsx": 1,
    "src/components/FloatingToolbar.tsx": 2,
    "src/components/FrostedGlassTuner.tsx": 1,
    "src/components/Minimap.tsx": 1,
    "src/components/ToastStack.tsx": 1,
  }),
  legacyFrostedClass: Object.freeze({
    "src/App.tsx": 1,
    "src/components/CanvasManager.tsx": 2,
    "src/components/ExtensionsPanel.tsx": 2,
    "src/components/FloatingToolbar.tsx": 2,
    "src/components/FrostedGlassTuner.tsx": 1,
    "src/components/Minimap.tsx": 1,
    "src/components/Modals.tsx": 1,
    "src/index.css": 2,
  }),
  frostedSurfaceImport: Object.freeze({
    "src/features/phase2-database/Phase2DatabaseHarness.tsx": 1,
    "src/ui/materials/FrostedSurface.test.tsx": 1,
  }),
  frostedSurfaceElement: Object.freeze({
    "src/features/phase2-database/Phase2DatabaseHarness.tsx": 1,
    "src/ui/materials/FrostedSurface.test.tsx": 1,
  }),
});

const MATERIAL_PATTERNS = Object.freeze([
  {
    name: "direct backdrop-filter declaration",
    expression: /(?:^|[^\w-])(?:-webkit-)?backdrop-filter\s*:/gm,
    allowance: FROZEN_LEGACY_MATERIAL_USAGE.directBackdropFilter,
  },
  {
    name: "Tailwind backdrop-blur utility",
    expression: /\bbackdrop-blur-(?:none|sm|md|lg|xl|2xl|3xl|\[[^\]\s"'`]+\])/g,
    allowance: FROZEN_LEGACY_MATERIAL_USAGE.tailwindBackdropBlur,
  },
  {
    name: "legacy frosted-glass class",
    expression: /\bfrosted-glass(?:-toolbar)?\b/g,
    allowance: FROZEN_LEGACY_MATERIAL_USAGE.legacyFrostedClass,
  },
  {
    name: "FrostedSurface consumer",
    expression: /from\s+["'][^"']*\/FrostedSurface["']/g,
    allowance: FROZEN_LEGACY_MATERIAL_USAGE.frostedSurfaceImport,
  },
  {
    name: "FrostedSurface element",
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

    const ownsMaterialImplementation = path.startsWith("src/ui/materials/compositor/");
    const combinesAcrylicAndCanvas2d =
      /acrylic/i.test(source) &&
      /(?:getContext\(\s*["']2d["']|CanvasRenderingContext2D)/.test(source);
    if (!ownsMaterialImplementation && combinesAcrylicAndCanvas2d) {
      violations.push(
        `${path}: acrylic Canvas2D implementation belongs under src/ui/materials/compositor`,
      );
    }

    if (ownsMaterialImplementation && /\bnew\s+Blob\s*\(/.test(source)) {
      violations.push(`${path}: acrylic workers must be Vite module workers, not Blob workers`);
    }

    const isTestSource = /(?:^|\.)test\.[cm]?[jt]sx?$/.test(path);
    if (
      !isTestSource &&
      ownsMaterialImplementation &&
      /\b(?:querySelector(?:All)?|getElementsBy(?:ClassName|TagName)|closest)\s*\(/.test(source)
    ) {
      violations.push(
        `${path}: compositor runtime must not discover presentation through DOM scans`,
      );
    }

    if (
      !isTestSource &&
      path.startsWith("src/legacy/materials/") &&
      /\b(?:querySelector(?:All)?|getElementsBy(?:ClassName|TagName)|getBoundingClientRect)\s*\(/.test(
        source,
      )
    ) {
      violations.push(
        `${path}: legacy backdrop projection must read models, not world DOM geometry`,
      );
    }

    if (ownsMaterialImplementation) {
      const imports = [
        ...source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
        ...source.matchAll(/\bimport\s*(?:\(\s*)?["']([^"']+)["']/g),
      ].map((match) => match[1]);
      const forbidden = imports.find(
        (specifier) =>
          /(?:^|\/)(?:app|domain|elements|features|legacy|platform)(?:\/|$)/.test(specifier) ||
          /^(?:react(?:-dom)?|react-redux|@reduxjs\/toolkit|@tauri-apps\/)/.test(specifier),
      );
      if (forbidden) {
        violations.push(
          `${path}: compositor runtime must not import forbidden boundary ${forbidden}`,
        );
      }
    }
  }

  return violations;
}
