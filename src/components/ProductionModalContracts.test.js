// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = new URL("../App.tsx", import.meta.url);
const appShellPath = new URL("../app/AppShell.tsx", import.meta.url);
const modalsPath = new URL("./Modals.tsx", import.meta.url);
const dialogsPath = new URL("./ProductionDialogs.tsx", import.meta.url);
const colorPickerPath = new URL("./ColorPickerMenu.tsx", import.meta.url);
const commandDialogsPath = new URL("./CommandRunnerModals.tsx", import.meta.url);
const contextMenusPath = new URL("./ContextMenus.tsx", import.meta.url);
const extensionsPath = new URL("./ExtensionsPanel.tsx", import.meta.url);
const toastPath = new URL("./ToastStack.tsx", import.meta.url);
const presencePath = new URL("../ui/patterns/overlays/ModalPresence.tsx", import.meta.url);
const motionPath = new URL("../ui/patterns/overlays/modalMotion.ts", import.meta.url);
const layerPath = new URL("../ui/patterns/overlays/ModalLayer.tsx", import.meta.url);
const layerCssPath = new URL("../ui/patterns/overlays/ModalLayer.css", import.meta.url);
const dialogPath = new URL("../ui/patterns/overlays/ModalDialog.tsx", import.meta.url);
const dialogCssPath = new URL("../ui/patterns/overlays/ModalDialog.css", import.meta.url);
const compositorCssPath = new URL("../ui/materials/MaterialCompositor.css", import.meta.url);
const materialTypesPath = new URL("../ui/materials/materialTypes.ts", import.meta.url);

describe("Phase 4.5C3B production modal architecture contracts", () => {
  it("retains root presentations in one shared presence mechanism and blocks App shortcuts", async () => {
    const [app, presence] = await Promise.all([
      readFile(appPath, "utf8"),
      readFile(presencePath, "utf8"),
    ]);
    expect(app).toContain("<ModalPresence open={clearModalOpen}>");
    expect(app).toContain("<ModalPresence open={settingsOpen}>");
    expect(app).toContain(
      "<ModalPresence open={updateModalOpen && Boolean(availableUpdate) && !settingsOpen}>",
    );
    expect(app.match(/isModalPresenceBlocking\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(presence).toContain('placement = "root"');
    expect(presence).toContain("setPresent(false)");
    expect(presence).not.toMatch(/requestAnimationFrame|setTimeout|setInterval/);
  });

  it("locks accepted shared motion, retained exit, scrim, and nested layer contracts", async () => {
    const [motion, layer, layerCss] = await Promise.all([
      readFile(motionPath, "utf8"),
      readFile(layerPath, "utf8"),
      readFile(layerCssPath, "utf8"),
    ]);
    expect(motion).toContain("MOTION_DURATION_MS.normal");
    expect(motion).toContain("MOTION_DURATION_MS.fast");
    expect(motion).toContain("translateY: 6");
    expect(motion).toContain("scale: 0.98");
    expect(motion).toContain("translateY: 4");
    expect(motion).toContain("scale: 0.985");
    expect(layer).toContain('<MaterialPlaneProvider plane="modal">');
    expect(layer.match(/<MaterialPlaneProvider plane=/g)).toHaveLength(1);
    expect(layerCss.match(/background: rgb\(0 0 0 \/ 0\.36\)/g)).toHaveLength(2);
    expect(layerCss).not.toMatch(/backdrop-filter/);
  });

  it("uses one Acrylic Large dialog pattern and the accepted production widths/primitives", async () => {
    const [dialogs, dialog, dialogCss] = await Promise.all([
      readFile(dialogsPath, "utf8"),
      readFile(dialogPath, "utf8"),
      readFile(dialogCssPath, "utf8"),
    ]);
    expect(dialog).toContain('material="acrylic-large"');
    expect(dialog).toContain("radius={12}");
    expect(dialogCss).toContain("padding: var(--taskmap-space-4)");
    expect(dialogs).toContain("width={380}");
    expect(dialogs).toContain("width={360}");
    expect(dialogs).toContain("width={340}");
    expect(dialogs).toContain("<IconButton");
    expect(dialogs).toContain('variant="primary"');
    expect(dialogs).toContain('variant="danger"');
    expect(dialogs).toContain("<TextField");
    expect(dialogs).not.toMatch(/frosted-glass|left-panel-card|z-40|z-50|#202023|<button\b/);
  });

  it("keeps Settings nested dialogs inside its existing modal boundary", async () => {
    const modals = await readFile(modalsPath, "utf8");
    expect(modals.match(/placement="nested"/g)).toHaveLength(2);
    expect(modals).toContain("<SettingsPasswordDialog");
    expect(modals).toContain("<UpdateAvailableModal");
    expect(modals).toContain("isNestedModalPresenceBlocking()");
    expect(modals).not.toContain("<ModalLayer");
    expect(modals).not.toMatch(/frosted-glass|left-panel-card|z-50/);
  });

  it("retains exactly one compositor, two planes, and all deferred overlay owners", async () => {
    const [
      app,
      appShell,
      colorPicker,
      commandDialogs,
      contextMenus,
      extensions,
      toast,
      materialTypes,
      compositorCss,
    ] = await Promise.all([
      readFile(appPath, "utf8"),
      readFile(appShellPath, "utf8"),
      readFile(colorPickerPath, "utf8"),
      readFile(commandDialogsPath, "utf8"),
      readFile(contextMenusPath, "utf8"),
      readFile(extensionsPath, "utf8"),
      readFile(toastPath, "utf8"),
      readFile(materialTypesPath, "utf8"),
      readFile(compositorCssPath, "utf8"),
    ]);
    expect(appShell.match(/<MaterialCompositorProvider\b/g)).toHaveLength(1);
    expect(materialTypes).toMatch(/MaterialPlane\s*=\s*"base"\s*\|\s*"modal"/);
    expect(compositorCss).toContain("z-index: var(--taskmap-layer-modal-compositor)");
    expect(colorPicker).toContain("context-menu-enter fixed z-[1002]");
    expect(commandDialogs).toContain("CommandRunnerSettingsModal");
    expect(commandDialogs).toContain("ExtensionConflictModal");
    expect(contextMenus).toContain("CanvasContextMenu");
    expect(extensions).toContain("QuickExtensionsMenu");
    expect(toast).toContain("ToastStack");
    expect(app).toContain("storageError &&");
  });

  it("preserves immediate clear mutation ownership before owner-state dismissal", async () => {
    const app = await readFile(appPath, "utf8");
    const clearStart = app.indexOf("const clearCanvas = () => {");
    const clearEnd = app.indexOf("const updateContainerAccent", clearStart);
    const clear = app.slice(clearStart, clearEnd);
    expect(clear).toContain("beginHistoryTransaction");
    expect(clear).toContain("finishHistoryTransaction");
    expect(clear.indexOf("finishHistoryTransaction")).toBeLessThan(
      clear.indexOf("setClearModalOpen(false)"),
    );
  });
});
