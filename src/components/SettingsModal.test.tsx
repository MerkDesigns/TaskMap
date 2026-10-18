import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CHROME_RADII,
  DEFAULT_TOOLBAR_BUTTONS,
} from "../platform/settings/preferenceContracts";
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
    expect(document.querySelectorAll(".taskmap-settings-island")).toHaveLength(4);

    expect(document.querySelectorAll("[data-material='acrylic-large']")).toHaveLength(1);
    expect(
      document.querySelectorAll(".taskmap-material-surface[data-material='acrylic-small']"),
    ).toHaveLength(6);
    // Islands share one settled Minor batch; knobs on islands are shells; the tab indicator sits
    // directly on the shell (first Minor depth) and keeps its own blur.
    expect(document.querySelectorAll("[data-glass-batch-id='settings-small']")).toHaveLength(1);
    expect(
      [...document.querySelectorAll(".taskmap-settings-island")].map((island) =>
        island.getAttribute("data-material-backdrop-source"),
      ),
    ).toEqual(["shared", "shared", "shared", "shared"]);
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

    const shadowsSwitch = screen.getByRole("switch", { name: "Canvas-only shadows" });
    expect(shadowsSwitch).toHaveAttribute("aria-checked", "true");
    await user.click(shadowsSwitch);
    expect(props.onShadowsUnderElementsChange).toHaveBeenCalledWith(false);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "visual",
      "database",
      "misc",
      "shortcuts",
      "dev",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "database" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Lock database" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "visual" }));
    expect(screen.queryByRole("button", { name: "Lines" })).toBeNull();
    const slider = screen.getByRole("slider", { name: "Dot grid opacity" });
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

  it("resets the canvas background color to the default", async () => {
    const user = userEvent.setup();
    const props = settingsProps({ canvasBackgroundColor: "#223344" });
    const view = renderSettings(props);
    await user.click(screen.getByRole("button", { name: "Reset canvas background color" }));
    expect(props.onCanvasBackgroundColorChange).toHaveBeenCalledExactlyOnceWith("#0F1011");

    view.unmount();
    renderSettings({ ...props, canvasBackgroundColor: "#0f1011" });
    expect(screen.getByRole("button", { name: "Reset canvas background color" })).toBeDisabled();
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

    const privacySwitch = screen.getByRole("switch", { name: "Privacy mode" });
    expect(privacySwitch).toHaveAttribute("aria-checked", "false");
    await user.click(privacySwitch);
    expect(props.onPrivacyModeEnabledChange).toHaveBeenCalledWith(true);
  });

  it("saves the sleep mode delay in milliseconds on release", async () => {
    const user = userEvent.setup();
    const props = settingsProps();
    renderSettings(props);
    await user.click(screen.getByRole("tab", { name: "misc" }));

    const slider = screen.getByRole("slider", { name: "Delay" });
    fireEvent.change(slider, { target: { value: "6.5" } });
    expect(screen.getByText("6.5s")).toBeInTheDocument();
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(props.onSleepDelayChange).toHaveBeenCalledExactlyOnceWith(6500);
  });

  it("preserves the shortcut order and DEV toggles", async () => {
    const user = userEvent.setup();
    const props = settingsProps();
    renderSettings(props);

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

    expect(groupSurfaces()).toHaveLength(7);
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
    databaseActions: {
      lock: vi.fn(async () => true),
      close: vi.fn(async () => true),
      quit: vi.fn(async () => true),
    },
    canvasBackgroundColor: "#0F1011",
    onCanvasBackgroundColorChange: vi.fn(),
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
    appVersion: "0.3.4",
    fpsCounterVisible: false,
    onFpsCounterVisibleChange: vi.fn(),
    privacyModeEnabled: false,
    onPrivacyModeEnabledChange: vi.fn(),
    launchAtLogin: true,
    onLaunchAtLoginChange: vi.fn(),
    launchToTray: false,
    onLaunchToTrayChange: vi.fn(),
    calendarStaysOpen: false,
    onCalendarStaysOpenChange: vi.fn(),
    chromeRadii: DEFAULT_CHROME_RADII,
    onChromeRadiusChange: vi.fn(),
    sleepDelayMs: 3000,
    onSleepDelayChange: vi.fn(),
    toolbarButtons: DEFAULT_TOOLBAR_BUTTONS,
    onToolbarButtonsChange: vi.fn(),
    toolbarToggles: { privacy: false, calendar: false, minimap: false, sleep: false },
    temporaryPanelsVisible: false,
    onTemporaryPanelsVisibleChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}
