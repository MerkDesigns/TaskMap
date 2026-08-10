// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const formsCssPath = new URL("./forms.css", import.meta.url);
const navigationCssPath = new URL("./navigation.css", import.meta.url);
const materialCssPath = new URL("../materials/MaterialSurface.css", import.meta.url);
const toggleCssPath = new URL("./acrylicToggleButton.css", import.meta.url);
const contextMenuCssPath = new URL("./contextMenu.css", import.meta.url);
const contextMenuPath = new URL("./ContextMenu.tsx", import.meta.url);
const confirmCssPath = new URL("./acrylicConfirmButton.css", import.meta.url);
const liquidToggleCssPath = new URL("./liquidToggleSwitch.css", import.meta.url);
const animatedCheckboxCssPath = new URL("./animatedCheckbox.css", import.meta.url);

describe("C1 visual-state contracts", () => {
  it("uses clear bright-selection glass with its inherited moving acrylic rim", async () => {
    const [materialCss, navigationCss] = await Promise.all([
      readFile(materialCssPath, "utf8"),
      readFile(navigationCssPath, "utf8"),
    ]);
    const selection = cssRule(
      materialCss,
      '.taskmap-material-surface--bright-selection[data-material-strategy="cached-acrylic"]',
    );
    const wash = cssRule(
      materialCss,
      '.taskmap-material-surface--bright-selection[data-material-strategy="cached-acrylic"]::before',
    );
    expect(selection).toContain("background: transparent");
    expect(wash).toContain("rgb(255 255 255 / 0.075)");
    expect(materialCss).toMatch(
      /\.taskmap-material-surface:is\(\s*\[data-material-strategy="cached-acrylic"\],\s*\[data-material-strategy="opaque"\]\s*\)::after\s*{[^}]*border-radius: inherit/s,
    );
    expect(navigationCss).not.toMatch(/taskmap-liquid-indicator::after\s*{[^}]*opacity:\s*0/s);
  });

  it("keeps LiquidTabs labels at unit scale with no scaling animation", async () => {
    const navigationCss = await readFile(navigationCssPath, "utf8");
    const label = cssRule(navigationCss, ".taskmap-liquid-tabs__label");
    expect(label).toContain("transform: none");
    expect(label).not.toContain("transition");
    expect(navigationCss).not.toContain("scale(1.04)");
  });

  it("uses a thin neutral focus border while preserving semantic invalid color", async () => {
    const formsCss = await readFile(formsCssPath, "utf8");
    for (const selector of [".taskmap-input-shell:focus-within", ".taskmap-input:focus-visible"]) {
      const rule = cssRule(formsCss, selector);
      expect(rule).toContain("border-color: rgb(255 255 255 / 0.23)");
      expect(rule).toContain("box-shadow: none");
      expect(rule).not.toContain("taskmap-accent");
    }
    expect(cssRule(formsCss, '.taskmap-input[aria-invalid="true"]')).toContain(
      "var(--taskmap-danger)",
    );
  });

  it("keeps acrylic controls free of hover highlights and context-menu motion CSS-only", async () => {
    const [toggleCss, contextMenuCss, contextMenuSource, materialCss] = await Promise.all([
      readFile(toggleCssPath, "utf8"),
      readFile(contextMenuCssPath, "utf8"),
      readFile(contextMenuPath, "utf8"),
      readFile(materialCssPath, "utf8"),
    ]);
    expect(toggleCss).toContain("background: transparent");
    expect(toggleCss).toContain('data-pressed="true"');
    expect(toggleCss).toContain("rgb(var(--taskmap-accent-rgb) / 0.27)");
    expect(toggleCss).not.toContain(":has(");
    expect(toggleCss).not.toContain("mix-blend-mode");
    expect(toggleCss).not.toContain("rgb(var(--taskmap-accent-rgb) / 0.3025)");
    expect(
      cssRule(
        toggleCss,
        ".taskmap-acrylic-toggle .taskmap-acrylic-toggle__button:hover:not(:disabled)",
      ),
    ).toContain("background: transparent");
    expect(contextMenuCss).toContain("taskmap-context-menu-enter");
    expect(contextMenuCss).toContain("taskmap-context-menu-exit");
    expect(contextMenuCss).toContain("width: 165px");
    expect(contextMenuCss).toContain("height: 29px");
    expect(contextMenuSource).toContain('material="opaque"');
    expect(contextMenuSource).toContain("readonly position: ContextMenuPosition");
    expect(contextMenuSource).not.toContain("anchorRef");
    expect(contextMenuSource).not.toContain("getBoundingClientRect");
    expect(contextMenuSource).not.toContain("menu-glass");
    expect(materialCss).toContain('[data-material-strategy="opaque"]');
    expect(materialCss).not.toContain("taskmap-material-surface--menu-glass");
    expect(`${contextMenuCss}\n${contextMenuSource}\n${materialCss}`).not.toContain(
      "backdrop-filter",
    );
    expect(contextMenuSource).not.toContain("requestAnimationFrame");
  });

  it("keeps the new button-material controls on shared tokens and real acrylic surfaces", async () => {
    const [confirmCss, liquidToggleCss, checkboxCss] = await Promise.all([
      readFile(confirmCssPath, "utf8"),
      readFile(liquidToggleCssPath, "utf8"),
      readFile(animatedCheckboxCssPath, "utf8"),
    ]);
    expect(confirmCss).toContain('data-treatment="glowing"');
    expect(confirmCss).toContain("color: #17100a");
    expect(confirmCss).toContain("rgb(var(--taskmap-accent-rgb) / 0.27)");
    expect(confirmCss).toContain("background: var(--taskmap-accent)");
    expect(confirmCss).not.toContain(":has(");
    expect(confirmCss).not.toContain("mix-blend-mode");
    expect(
      cssRule(
        confirmCss,
        ".taskmap-acrylic-confirm .taskmap-acrylic-confirm__button:hover:not(:disabled)",
      ),
    ).toContain("background: transparent");
    expect(liquidToggleCss).toContain("width: 52px");
    expect(liquidToggleCss).toContain("height: 30px");
    expect(liquidToggleCss).toContain("top: 50%");
    expect(liquidToggleCss).toContain("background: rgb(0 0 1 / 0.97)");
    expect(liquidToggleCss).toContain("background: var(--taskmap-accent)");
    expect(liquidToggleCss).toContain("box-shadow: 0 0 10px rgb(var(--taskmap-accent-rgb) / 0.28)");
    expect(liquidToggleCss).toContain('data-switch-state="off"');
    expect(liquidToggleCss).toContain('data-switch-state="on"');
    expect(liquidToggleCss).toContain("rgb(255 255 255 / 0.2)");
    expect(liquidToggleCss).toContain("rgb(0 0 0 / 0.42)");
    expect(cssRule(liquidToggleCss, ".taskmap-liquid-toggle:focus-visible")).toContain(
      "rgb(255 255 255 / 0.3)",
    );
    expect(cssRule(liquidToggleCss, ".taskmap-liquid-toggle:focus-visible")).not.toContain(
      "taskmap-accent",
    );
    expect(checkboxCss).toContain("var(--taskmap-motion-fast)");
    expect(checkboxCss).toContain("var(--taskmap-motion-normal)");
    expect(`${confirmCss}\n${liquidToggleCss}\n${checkboxCss}`).not.toContain("backdrop-filter");
  });
});

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  expect(match, `Missing CSS rule: ${selector}`).not.toBeNull();
  return match[1];
}
