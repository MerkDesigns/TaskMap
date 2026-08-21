import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ELEMENT_COLORS } from "../constants";
import type { ComponentProps } from "react";
import { MaterialSurfaceRegistrationProvider } from "../ui/materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../ui/materials/materialSurfaceRegistry";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import { MotionProvider } from "../ui/motion/MotionProvider";
import {
  createMotionFrameScheduler,
  type MotionFrameDriver,
} from "../ui/motion/motionFrameScheduler";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { ModalPresence } from "../ui/patterns/overlays";
import { SettingsModal } from "./Modals";

afterEach(cleanup);

describe("Phase 4.5C3A primary Settings", () => {
  it("uses one modal native Large shell and only modal-plane native Small surfaces", () => {
    const registry = createMaterialSurfaceRegistry(null);
    renderSettings(settingsProps(), registry);

    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-material", "acrylic-large");
    expect(dialog).toHaveAttribute("data-material-plane", "modal");
    expect(dialog.style.getPropertyValue("--taskmap-material-radius")).toBe("12px");
    expect(document.querySelector(".taskmap-modal-scrim")).toBeInTheDocument();
    expect(document.querySelectorAll(".taskmap-settings-island")).toHaveLength(4);

    expect(document.querySelectorAll("[data-material='acrylic-large']")).toHaveLength(1);
    expect(document.querySelectorAll("[data-material='acrylic-small']")).toHaveLength(7);
    expect(
      [...document.querySelectorAll("[data-material-strategy='native-glass']")].every(
        (surface) => surface.getAttribute("data-material-plane") === "modal",
      ),
    ).toBe(true);
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(document.querySelectorAll("[data-material-plane='base']")).toHaveLength(0);
    registry.dispose();
  });

  it("preserves navigation, grid, slider, color, close, and footer behavior", async () => {
    const user = userEvent.setup();
    const props = settingsProps();
    const registry = createMaterialSurfaceRegistry(null);
    renderSettings(props, registry);

    const shadowsSwitch = screen.getByRole("switch", { name: "Shadows below elements" });
    const privacySwitch = screen.getByRole("switch", { name: "Privacy mode" });
    expect(shadowsSwitch).toHaveAttribute("aria-checked", "true");
    expect(privacySwitch).toHaveAttribute("aria-checked", "false");
    await user.click(shadowsSwitch);
    await user.click(privacySwitch);
    expect(props.onShadowsUnderElementsChange).toHaveBeenCalledWith(false);
    expect(props.onPrivacyModeEnabledChange).toHaveBeenCalledWith(true);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "visual",
      "data",
      "misc",
      "shortcuts",
      "dev",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "data" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Export data" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "visual" }));
    await user.click(screen.getByRole("button", { name: "Lines" }));
    expect(props.onCanvasGridStyleChange).toHaveBeenCalledWith("lines");
    const slider = screen.getByTitle("Grid opacity");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "100");
    expect(slider).toHaveAttribute("step", "5");
    expect(slider).toHaveValue("50");
    fireEvent.change(slider, { target: { value: "65" } });
    expect(props.onCanvasGridOpacityChange).toHaveBeenCalledWith(65);

    for (const label of ["containers", "text cards", "text blocks", "images", "mindmaps"]) {
      expect(screen.getByTitle(`Choose default ${label} color`)).toBeInTheDocument();
    }
    expect(screen.getAllByText("#476FA8")).toHaveLength(5);
    expect(screen.getByText("MADE BY MERK - v0.3.4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close settings" }));
    expect(props.onClose).toHaveBeenCalledOnce();
    registry.dispose();
  });

  it("uses single-action toggle rows and preserves the disabled Discord dependency", async () => {
    const user = userEvent.setup();
    const props = settingsProps({
      allowLockedElementDeletion: true,
      discordRpcEnabled: false,
      discordRpcShowCanvas: true,
    });
    const registry = createMaterialSurfaceRegistry(null);
    renderSettings(props, registry);
    await user.click(screen.getByRole("tab", { name: "misc" }));

    const removalSwitch = screen.getByRole("switch", {
      name: "Allow removing locked elements",
    });
    expect(removalSwitch).toHaveAttribute("aria-checked", "true");
    await user.click(removalSwitch);
    expect(props.onAllowLockedElementDeletionChange).toHaveBeenCalledTimes(1);
    expect(props.onAllowLockedElementDeletionChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByText("Lock canvas interactions without preventing removal."));
    expect(props.onAllowLockedElementDeletionChange).toHaveBeenCalledTimes(2);
    expect(props.onAllowLockedElementDeletionChange).toHaveBeenLastCalledWith(false);

    const discordSwitch = screen.getByRole("switch", { name: "Discord status" });
    await user.click(discordSwitch);
    expect(props.onDiscordRpcEnabledChange).toHaveBeenCalledOnce();
    expect(props.onDiscordRpcEnabledChange).toHaveBeenCalledWith(true);

    const canvasSwitch = screen.getByRole("switch", { name: "Show active canvas" });
    expect(canvasSwitch).toBeDisabled();
    await user.click(screen.getByText("Include the current canvas name in your Discord status."));
    expect(props.onDiscordRpcShowCanvasChange).not.toHaveBeenCalled();
    registry.dispose();
  });

  it("preserves data flow, update action, shortcut order, and DEV toggles", async () => {
    const user = userEvent.setup();
    const props = settingsProps();
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = renderSettings(props, registry);

    await user.click(screen.getByRole("tab", { name: "data" }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toHaveAttribute("accept", ".tmap,.json,application/json");
    expect(fileInput).toHaveAttribute("spellcheck", "false");
    await user.click(screen.getByRole("button", { name: "Export data" }));
    await user.type(screen.getByPlaceholderText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(props.onExportData).toHaveBeenCalledWith("secret"));

    const importFile = new File(["{}"], "settings.tmap", { type: "application/json" });
    await user.upload(fileInput, importFile);
    expect(fileInput.value).toBe("");
    await user.type(screen.getByPlaceholderText("Password"), "import-secret");
    await user.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() =>
      expect(props.onImportData).toHaveBeenCalledWith(importFile, "import-secret"),
    );

    await user.click(screen.getByRole("tab", { name: "misc" }));
    await user.click(screen.getByRole("button", { name: "Check for updates" }));
    expect(props.onCheckForUpdate).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("tab", { name: "shortcuts" }));
    const shortcutLabels = [
      "Open quick extensions menu",
      "Open or close Canvases",
      "Switch Canvases / Extensions",
      "Cycle canvases",
      "Remove selected elements",
      "Undo",
      "Redo",
      "Pan canvas",
      "Zoom around pointer",
      "Enable alignment snapping",
      "Open context menu",
      "Box select",
      "Connect mindmaps",
    ];
    expect(
      [...document.querySelectorAll(".taskmap-settings-shortcut-label")].map(
        (element) => element.textContent,
      ),
    ).toEqual(shortcutLabels);
    expect(document.querySelectorAll(".taskmap-keycap")).toHaveLength(20);
    expect(document.querySelectorAll(".taskmap-settings-shortcuts [data-material]")).toHaveLength(
      0,
    );

    await user.click(screen.getByRole("tab", { name: "dev" }));
    await user.click(screen.getByRole("switch", { name: "FPS counter" }));
    await user.click(screen.getByText("Show frosted glass tuning overlays."));
    expect(props.onFpsCounterVisibleChange).toHaveBeenCalledWith(true);
    expect(props.onTemporaryPanelsVisibleChange).toHaveBeenCalledWith(true);
    registry.dispose();
  });

  it("animates the full native Settings group and leaves unrelated surfaces untouched", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    const view = (open: boolean) => (
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <ReducedMotionProvider override={false}>
          <MotionProvider scheduler={scheduler}>
            <MaterialSurface material="acrylic-small" data-testid="unrelated">
              Unrelated
            </MaterialSurface>
            <ModalPresence open={open}>
              <SettingsModal {...settingsProps()} />
            </ModalPresence>
          </MotionProvider>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(view(true));
    const group = document.querySelector(".taskmap-modal-presence-group") as HTMLDivElement;
    const groupSurfaces = () =>
      [...group.querySelectorAll("[data-material-strategy='native-glass']")] as HTMLElement[];

    expect(groupSurfaces()).toHaveLength(8);
    expect(groupSurfaces().every((surface) => surface.dataset.materialPlane === "modal")).toBe(
      true,
    );
    expect(screen.getByTestId("unrelated")).toHaveAttribute("data-material-plane", "base");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    act(() => driver.fire());
    expect(Number(group.style.opacity)).toBeGreaterThan(0);
    expect(Number(group.style.opacity)).toBeLessThan(1);
    expect(screen.getByTestId("unrelated")).not.toHaveStyle({ opacity: group.style.opacity });
    act(() => driver.flush());
    expect(group.style.opacity).toBe("1");

    rerender(view(false));
    act(() => driver.fire());
    expect(Number(group.style.opacity)).toBeLessThan(1);
    act(() => driver.flush());
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByTestId("unrelated")).toHaveAttribute("data-material-plane", "base");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    scheduler.dispose();
    registry.dispose();
  });

  it("closes only the topmost nested Settings dialog on Escape", async () => {
    const user = userEvent.setup();
    const update = { version: "1.2.3", currentVersion: "1.0.0" };
    const props = settingsProps({
      availableUpdate: update,
      onCheckForUpdate: vi.fn(async () => update),
    });
    const registry = createMaterialSurfaceRegistry(null);
    renderSettings(props, registry);

    await user.click(screen.getByRole("tab", { name: "data" }));
    await user.click(screen.getByRole("button", { name: "Export data" }));
    expect(screen.getByRole("dialog", { name: "Export data" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Export data" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "misc" }));
    await user.click(screen.getByRole("button", { name: "Check for updates" }));
    expect(await screen.findByRole("dialog", { name: "Update available" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Update available" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
    registry.dispose();
  });
});

function renderSettings(
  props: ComponentProps<typeof SettingsModal>,
  registry: ReturnType<typeof createMaterialSurfaceRegistry>,
) {
  return render(
    <MaterialSurfaceRegistrationProvider
      value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
    >
      <ReducedMotionProvider override>
        <ModalPresence open>
          <SettingsModal {...props} />
        </ModalPresence>
      </ReducedMotionProvider>
    </MaterialSurfaceRegistrationProvider>,
  );
}

class ControlledFrameDriver implements MotionFrameDriver {
  private callbacks = new Map<number, (timestampMs: number) => void>();
  private nextHandle = 1;
  private timestampMs = 0;

  request(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  fire(): boolean {
    const entry = this.callbacks.entries().next().value as
      [number, (timestampMs: number) => void] | undefined;
    if (!entry) return false;
    this.callbacks.delete(entry[0]);
    this.timestampMs += 1000 / 60;
    entry[1](this.timestampMs);
    return true;
  }

  flush(limit = 60): void {
    for (let frame = 0; frame < limit && this.fire(); frame += 1) {
      // One pending shared frame advances all active UI motion subscribers.
    }
  }
}

function settingsProps(
  overrides: Partial<ComponentProps<typeof SettingsModal>> = {},
): ComponentProps<typeof SettingsModal> {
  return {
    canvasGridStyle: "dots",
    onCanvasGridStyleChange: vi.fn(),
    canvasGridOpacity: 50,
    onCanvasGridOpacityChange: vi.fn(),
    defaultElementColors: DEFAULT_ELEMENT_COLORS,
    onDefaultElementColorChange: vi.fn(),
    recentColors: ["#ABCDEF"],
    onRememberRecentColor: vi.fn(),
    shadowsUnderElements: true,
    onShadowsUnderElementsChange: vi.fn(),
    allowLockedElementDeletion: false,
    onAllowLockedElementDeletionChange: vi.fn(),
    onExportData: vi.fn(async () => true),
    onImportData: vi.fn(async () => undefined),
    discordRpcEnabled: true,
    onDiscordRpcEnabledChange: vi.fn(),
    discordRpcShowCanvas: true,
    onDiscordRpcShowCanvasChange: vi.fn(),
    availableUpdate: null,
    appVersion: "0.3.4",
    fpsCounterVisible: false,
    onFpsCounterVisibleChange: vi.fn(),
    privacyModeEnabled: false,
    onPrivacyModeEnabledChange: vi.fn(),
    temporaryPanelsVisible: false,
    onTemporaryPanelsVisibleChange: vi.fn(),
    onCheckForUpdate: vi.fn(async () => null),
    onInstallUpdate: vi.fn(async () => undefined),
    onClose: vi.fn(),
    ...overrides,
  };
}
