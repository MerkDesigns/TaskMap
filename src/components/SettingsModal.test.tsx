import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHROME_RADII } from "../platform/settings/preferenceContracts";
import { DEFAULT_ELEMENT_COLORS } from "../constants";
import type { ComponentProps } from "react";
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

describe("Settings modal", () => {
  it("uses one modal native Large shell and only modal-plane native Small surfaces", () => {
    renderSettings(settingsProps());

    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-material", "acrylic-large");
    expect(dialog).toHaveAttribute("data-material-plane", "modal");
    expect(dialog.style.getPropertyValue("--taskmap-material-radius")).toBe("12px");
    expect(document.querySelector(".taskmap-modal-scrim")).toBeInTheDocument();
    expect(document.querySelectorAll(".taskmap-settings-island")).toHaveLength(5);

    expect(document.querySelectorAll("[data-material='acrylic-large']")).toHaveLength(1);
    expect(
      document.querySelectorAll(".taskmap-material-surface[data-material='acrylic-small']"),
    ).toHaveLength(8);
    // Islands share one settled Minor batch; knobs on islands are shells; the tab indicator sits
    // directly on the shell (first Minor depth) and keeps its own blur.
    expect(document.querySelectorAll("[data-glass-batch-id='settings-small']")).toHaveLength(1);
    expect(
      [...document.querySelectorAll(".taskmap-settings-island")].map((island) =>
        island.getAttribute("data-material-backdrop-source"),
      ),
    ).toEqual(["shared", "shared", "shared", "shared", "shared"]);
    // Island content sits in the shared list mask so scroll edges morph instead of guillotining.
    document.querySelectorAll(".taskmap-settings-island").forEach((island) => {
      expect(island.querySelector(":scope > .taskmap-glass-list__content")).not.toBeNull();
    });
    const knobs = [...document.querySelectorAll(".taskmap-liquid-toggle__knob")];
    expect(knobs.length).toBeGreaterThan(0);
    knobs.forEach((knob) => {
      expect(knob).toHaveAttribute("data-material-backdrop-source", "shell");
      expect(knob.querySelector(".taskmap-native-glass-backdrop")).toBeNull();
    });
    expect(document.querySelector(".taskmap-liquid-indicator")).toHaveAttribute(
      "data-material-backdrop-source",
      "self",
    );
    expect(
      [...document.querySelectorAll("[data-material-strategy='native-glass']")].every(
        (surface) => surface.getAttribute("data-material-plane") === "modal",
      ),
    ).toBe(true);
    expect(document.querySelectorAll("[data-material-plane='base']")).toHaveLength(0);
  });

  it("preserves navigation, grid, slider, color, close, and footer behavior", async () => {
    const user = userEvent.setup();
    const props = settingsProps();
    renderSettings(props);

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
    const slider = screen.getByRole("slider", { name: "Grid opacity" });
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "100");
    expect(slider).toHaveAttribute("step", "any");
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
  });

  it("uses single-action toggle rows", async () => {
    const user = userEvent.setup();
    const props = settingsProps({ allowLockedElementDeletion: true });
    renderSettings(props);
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
  });

  it("preserves data flow, update action, shortcut order, and DEV toggles", async () => {
    const user = userEvent.setup();
    const props = settingsProps();
    const { container } = renderSettings(props);

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
    await user.click(screen.getByText("Show temporary glass and workspace geometry controls."));
    expect(props.onFpsCounterVisibleChange).toHaveBeenCalledWith(true);
    expect(props.onTemporaryPanelsVisibleChange).toHaveBeenCalledWith(true);
  });

  it("animates the full native Settings group and leaves unrelated surfaces untouched", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const view = (open: boolean) => (
      <>
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
      </>
    );
    const { rerender } = render(view(true));
    const group = document.querySelector(".taskmap-modal-presence-group") as HTMLDivElement;
    const groupSurfaces = () =>
      [...group.querySelectorAll("[data-material-strategy='native-glass']")] as HTMLElement[];

    expect(groupSurfaces()).toHaveLength(9);
    expect(groupSurfaces().every((surface) => surface.dataset.materialPlane === "modal")).toBe(
      true,
    );
    expect(screen.getByTestId("unrelated")).toHaveAttribute("data-material-plane", "base");
    // The first frame starts the presence clock (zero delta); the second one advances it.
    act(() => driver.fire());
    act(() => driver.fire());
    expect(
      Number(group.style.getPropertyValue("--taskmap-material-presence-progress")),
    ).toBeGreaterThan(0);
    expect(
      Number(group.style.getPropertyValue("--taskmap-material-presence-progress")),
    ).toBeLessThan(1);
    expect(group.style.opacity).toBe("");
    expect(
      screen
        .getByTestId("unrelated")
        .style.getPropertyValue("--taskmap-material-presence-progress"),
    ).toBe("");
    act(() => driver.flush());
    expect(group.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("");

    rerender(view(false));
    act(() => driver.fire());
    expect(
      Number(group.style.getPropertyValue("--taskmap-material-presence-progress")),
    ).toBeLessThan(1);
    expect(group.style.opacity).toBe("");
    act(() => driver.flush());
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByTestId("unrelated")).toHaveAttribute("data-material-plane", "base");
    scheduler.dispose();
  });

  it("closes only the topmost nested Settings dialog on Escape", async () => {
    const user = userEvent.setup();
    const update = { version: "1.2.3", currentVersion: "1.0.0" };
    const props = settingsProps({
      availableUpdate: update,
      onCheckForUpdate: vi.fn(async () => update),
    });
    renderSettings(props);

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
  });
});

function renderSettings(props: ComponentProps<typeof SettingsModal>) {
  return render(
    <>
      <ReducedMotionProvider override>
        <ModalPresence open>
          <SettingsModal {...props} />
        </ModalPresence>
      </ReducedMotionProvider>
    </>,
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
    availableUpdate: null,
    appVersion: "0.3.4",
    fpsCounterVisible: false,
    onFpsCounterVisibleChange: vi.fn(),
    privacyModeEnabled: false,
    onPrivacyModeEnabledChange: vi.fn(),
    chromeRadii: DEFAULT_CHROME_RADII,
    onChromeRadiusChange: vi.fn(),
    sleepDelayMs: 3000,
    onSleepDelayChange: vi.fn(),
    temporaryPanelsVisible: false,
    onTemporaryPanelsVisibleChange: vi.fn(),
    onCheckForUpdate: vi.fn(async () => null),
    onInstallUpdate: vi.fn(async () => undefined),
    onClose: vi.fn(),
    ...overrides,
  };
}
