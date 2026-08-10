// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = new URL("../App.tsx", import.meta.url);
const appShellPath = new URL("../app/AppShell.tsx", import.meta.url);
const modalsPath = new URL("./Modals.tsx", import.meta.url);
const colorPickerPath = new URL("./ColorPickerMenu.tsx", import.meta.url);
const compositorCssPath = new URL("../ui/materials/MaterialCompositor.css", import.meta.url);
const materialTypesPath = new URL("../ui/materials/materialTypes.ts", import.meta.url);
const themePath = new URL("../ui/theme/theme.css", import.meta.url);
const modalPatternPath = new URL("../ui/patterns/overlays/ModalLayer.tsx", import.meta.url);
const modalCssPath = new URL("../ui/patterns/overlays/ModalLayer.css", import.meta.url);
const settingsPatternPath = new URL(
  "../ui/patterns/settings/SettingsPatterns.tsx",
  import.meta.url,
);
const settingsCssPath = new URL("../ui/patterns/settings/SettingsPatterns.css", import.meta.url);

describe("Phase 4.5C3A Settings architecture contracts", () => {
  it("defines semantic scrim/compositor/content layers without changing the modal canvas layer", async () => {
    const [theme, compositorCss, modalPattern, modalCss] = await Promise.all([
      readFile(themePath, "utf8"),
      readFile(compositorCssPath, "utf8"),
      readFile(modalPatternPath, "utf8"),
      readFile(modalCssPath, "utf8"),
    ]);

    expect(theme).toContain("--taskmap-layer-modal-scrim: 9999");
    expect(theme).toContain("--taskmap-layer-modal-compositor: 10000");
    expect(theme).toContain("--taskmap-layer-modal-content: 10001");
    expect(compositorCss).toContain("z-index: var(--taskmap-layer-modal-compositor)");
    expect(modalCss).toContain("z-index: var(--taskmap-layer-modal-scrim)");
    expect(modalCss).toContain("z-index: var(--taskmap-layer-modal-content)");
    expect(modalCss).toContain("background: rgb(0 0 0 / 0.36)");
    expect(modalPattern).toContain('<MaterialPlaneProvider plane="modal">');
  });

  it("locks Settings shell, tab, island, and scroll geometry to the accepted contract", async () => {
    const [settingsPattern, settingsCss] = await Promise.all([
      readFile(settingsPatternPath, "utf8"),
      readFile(settingsCssPath, "utf8"),
    ]);

    expect(settingsPattern).toContain('material="acrylic-large"');
    expect(settingsPattern).toContain("radius={12}");
    expect(settingsPattern).toContain('material="acrylic-small"');
    expect(settingsPattern).toContain("radius={8}");
    expect(settingsCss).toContain("width: 528px");
    expect(settingsCss).toContain("height: 632px");
    expect(settingsCss).toContain("max-height: calc(100vh - 2rem)");
    expect(settingsCss).toContain("padding: var(--taskmap-modal-padding)");
    expect(settingsCss).toContain("overflow-x: hidden");
  });

  it("migrates only the primary Settings tree and retains deferred nested overlays", async () => {
    const modals = await readFile(modalsPath, "utf8");
    const primaryStart = modals.indexOf("<SettingsShell");
    const primaryEnd = modals.indexOf("</SettingsShell>", primaryStart);
    const primary = modals.slice(primaryStart, primaryEnd);
    const deferred = modals.slice(primaryEnd);

    expect(primary).toContain("<LiquidTabs");
    expect(primary).toContain("<ScrollArea");
    expect(primary).toContain("<SegmentedControl");
    expect(primary).toContain("<Slider");
    expect(primary).toContain("<SettingsToggleRow");
    expect(primary).toContain("<IconButton");
    expect(primary).not.toMatch(
      /#318f87|left-panel-card|frosted-glass|backdrop-filter|bg-\[#141519\]|z-40|<button\b/,
    );
    expect(deferred).toContain("<UpdateAvailableModal");
    expect(deferred).toContain("passwordModal &&");
    expect(deferred).toContain("frosted-glass");
    expect(deferred).toContain("left-panel-card");
  });

  it("retains tab gating, hidden import contract, color-picker placement, and exact shortcuts", async () => {
    const modals = await readFile(modalsPath, "utf8");

    expect(modals).toContain('(["visual", "data", "misc", "shortcuts", "dev"] as const)');
    expect(modals).toContain('(["visual", "data", "misc", "shortcuts"] as const)');
    expect(modals).toContain('accept=".tmap,.json,application/json"');
    expect(modals).toContain('event.target.value = ""');
    expect(modals).toContain("left: rect.right + 8");
    expect(modals).toContain("top: rect.top");
    expect(modals).toContain('className="taskmap-modal-portal-layer"');
    expect(modals.match(/label: "/g)?.length).toBeGreaterThanOrEqual(20);
    expect(modals).toContain('{ label: "Connect mindmaps", keys: ["Hold C", "Drag point"] }');
  });

  it("keeps overlay and application boundaries outside C3A", async () => {
    const [app, appShell, colorPicker, materialTypes, modalPattern, settingsPattern] =
      await Promise.all([
        readFile(appPath, "utf8"),
        readFile(appShellPath, "utf8"),
        readFile(colorPickerPath, "utf8"),
        readFile(materialTypesPath, "utf8"),
        readFile(modalPatternPath, "utf8"),
        readFile(settingsPatternPath, "utf8"),
      ]);
    const [modalCss, settingsCss] = await Promise.all([
      readFile(modalCssPath, "utf8"),
      readFile(settingsCssPath, "utf8"),
    ]);
    const patterns = `${modalPattern}\n${modalCss}\n${settingsPattern}\n${settingsCss}`;

    expect(appShell.match(/<MaterialCompositorProvider\b/g)).toHaveLength(1);
    expect(materialTypes).toMatch(/MaterialPlane\s*=\s*"base"\s*\|\s*"modal"/);
    expect(patterns).not.toMatch(
      /requestAnimationFrame|backdrop-filter|createBrowserAcrylicRuntime|acrylicCache|Redux|persistence|database|domain|tauri/i,
    );
    expect(colorPicker).toContain("createPortal(");
    expect(colorPicker).toContain("context-menu-enter fixed z-[1002]");
    for (const retained of [
      "ClearCanvasModal",
      "QuickExtensionsMenu",
      "ToastStack",
      "storageError",
      "CommandRunnerSettingsModal",
    ]) {
      expect(app).toContain(retained);
    }
  });
});
