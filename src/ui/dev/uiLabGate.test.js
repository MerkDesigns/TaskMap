// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const appShellPath = new URL("../../app/AppShell.tsx", import.meta.url);
const uiLabPath = new URL("./DevelopmentUiLab.tsx", import.meta.url);
const uiLabCssPath = new URL("./DevelopmentUiLab.css", import.meta.url);
const playgroundPath = new URL("./AcrylicCompositorPlayground.tsx", import.meta.url);
const playgroundCssPath = new URL("./AcrylicCompositorPlayground.css", import.meta.url);
const compositorCssPath = new URL("../materials/MaterialCompositor.css", import.meta.url);
const materialSurfaceCssPath = new URL("../materials/MaterialSurface.css", import.meta.url);

describe("development UI Lab gate", () => {
  it("requires both DEV and the explicit environment flag", async () => {
    const source = await readFile(appShellPath, "utf8");
    expect(source).toContain('import.meta.env.DEV && import.meta.env.VITE_TASKMAP_UI_LAB === "1"');
  });

  it("loads the lab dynamically instead of adding an eager production import", async () => {
    const source = await readFile(appShellPath, "utf8");
    expect(source).toContain('import("../ui/dev/DevelopmentUiLab")');
    expect(source).not.toContain("import { DevelopmentUiLab }");
  });

  it("scopes the target theme to the lab root", async () => {
    const [appShell, uiLab] = await Promise.all([
      readFile(appShellPath, "utf8"),
      readFile(uiLabPath, "utf8"),
    ]);
    expect(uiLab).toContain('className="taskmap-target-theme taskmap-ui-lab"');
    expect(appShell).not.toContain('className="taskmap-target-theme');
  });

  it("gates the playground with the Lab and reuses the existing compositor boundary", async () => {
    const [appShell, uiLab, playground, playgroundCss] = await Promise.all([
      readFile(appShellPath, "utf8"),
      readFile(uiLabPath, "utf8"),
      readFile(playgroundPath, "utf8"),
      readFile(playgroundCssPath, "utf8"),
    ]);
    expect(appShell).toContain("<DevelopmentUiLab presentation={materialPresentation}");
    expect(appShell).toContain("if (DevelopmentUiLab) return <DevelopmentUiLabShell />");
    expect(appShell.indexOf("<RendererV2ApplicationWorkspace />")).toBeGreaterThan(
      appShell.indexOf("if (DevelopmentUiLab) return <DevelopmentUiLabShell />"),
    );
    expect(uiLab).toContain("<AcrylicCompositorPlayground presentation={presentation}");
    expect(playground).toContain("MaterialCompositorPresentationPublisher");
    expect(playground).toContain("<MaterialSurface");
    expect(playground).not.toContain("MaterialCompositorProvider");
    expect(`${playground}\n${playgroundCss}`).not.toContain("backdrop-filter");
    expect(playground).not.toMatch(/(?:localStorage|redux|history|persistence)/i);
  });

  it("keeps focus-visible styling pseudo-class driven", async () => {
    const [uiLab, css] = await Promise.all([
      readFile(uiLabPath, "utf8"),
      readFile(uiLabCssPath, "utf8"),
    ]);
    expect(uiLab).toContain("Keyboard focus: press Tab");
    expect(css).toContain(".taskmap-ui-lab__focus-target:focus-visible");
    expect(uiLab).not.toMatch(/focus-visible.*className|className.*focus-visible/);
  });

  it("keeps Lab material content above the base compositor without a root stacking trap", async () => {
    const [uiLab, uiLabCss, compositorCss, materialSurfaceCss] = await Promise.all([
      readFile(uiLabPath, "utf8"),
      readFile(uiLabCssPath, "utf8"),
      readFile(compositorCssPath, "utf8"),
      readFile(materialSurfaceCssPath, "utf8"),
    ]);
    const labRoot = cssRule(uiLabCss, ".taskmap-ui-lab");
    const labSurface = cssRule(uiLabCss, ".taskmap-ui-lab .taskmap-material-surface");
    const basePlane = cssRule(compositorCss, ".taskmap-compositor-plane--base");
    const materialSurface = cssRule(materialSurfaceCss, ".taskmap-material-surface");

    expect(labRoot).toContain("position: absolute");
    expect(labRoot).not.toMatch(/\bz-index\s*:/);
    expect(basePlane).toContain("z-index: 40");
    expect(labSurface).toContain("z-index: 41");
    expect(materialSurface).toContain("position: relative");
    expect(materialSurface).toContain("isolation: isolate");
    expect(uiLab).not.toContain("zIndex");
  });

  it("orders the playground scene below the compositor and its fixed surface above it", async () => {
    const [playgroundCss, compositorCss] = await Promise.all([
      readFile(playgroundCssPath, "utf8"),
      readFile(compositorCssPath, "utf8"),
    ]);
    const scene = cssRule(playgroundCss, ".taskmap-acrylic-playground__scene");
    const testSurface = cssRule(playgroundCss, ".taskmap-acrylic-playground__surface");
    const basePlane = cssRule(compositorCss, ".taskmap-compositor-plane--base");

    expect(scene).not.toMatch(/\bz-index\s*:/);
    expect(basePlane).toContain("z-index: 40");
    expect(testSurface).toContain("z-index: 41");
  });
});

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  expect(match, `Missing CSS rule: ${selector}`).not.toBeNull();
  return match[1];
}
