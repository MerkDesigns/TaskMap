import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialSurfaceRegistrationProvider } from "../../materials/MaterialSurfaceRegistration";
import { createMaterialSurfaceRegistry } from "../../materials/materialSurfaceRegistry";
import { MotionProvider } from "../../motion/MotionProvider";
import {
  createMotionFrameScheduler,
  type MotionFrameDriver,
} from "../../motion/motionFrameScheduler";
import { ReducedMotionProvider } from "../../motion/reducedMotionPreference";
import { WorkspaceSidePanel, WorkspaceSidePanelContentSwitcher } from "./WorkspaceSidePanel";
import {
  WORKSPACE_SIDE_PANEL_OFFSCREEN_MARGIN_PX,
  WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS,
} from "./useWorkspaceSidePanelMotion";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WorkspaceSidePanel motion", () => {
  it("fades, slides and scales the panel in and out by default", () => {
    expect(WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS).toBe(300);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(panelBounds(288));
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    const renderPanel = (closing: boolean) => (
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <ReducedMotionProvider override={false}>
          <MotionProvider scheduler={scheduler}>
            <WorkspaceSidePanel closing={closing} label="Test panel">
              <div data-testid="panel-content">Panel</div>
            </WorkspaceSidePanel>
          </MotionProvider>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(renderPanel(false));
    const panel = screen.getByLabelText("Test panel");
    const offscreenX = -(288 + 16 + WORKSPACE_SIDE_PANEL_OFFSCREEN_MARGIN_PX);

    expect(panel).toHaveAttribute("data-material", "acrylic-large");
    expect(panel).toHaveAttribute("data-presence-phase", "showing");
    expect(panel.style.transform).toBe(`translate3d(${offscreenX}px, 0px, 0) scale(0.94)`);
    expect(panel.style.opacity).toBe("");
    // Material presence starts at zero (no blur/tint); never ancestor opacity (contract 17).
    const presence = () => panel.style.getPropertyValue("--taskmap-material-presence-progress");
    expect(presence()).toBe("0");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 1, framePending: true });

    act(() => expect(driver.fire()).toBe(true));
    expect(readTranslateX(panel)).toBeGreaterThan(offscreenX);
    expect(readTranslateX(panel)).toBeLessThan(0);
    expect(Number(presence())).toBeGreaterThan(0);
    expect(Number(presence())).toBeLessThan(1);
    expect(panel.style.opacity).toBe("");
    act(() => driver.flush());
    expect(panel).toHaveAttribute("data-presence-phase", "visible");
    expect(panel.style.transform).toBe("");
    expect(presence()).toBe("");
    expect(panel.style.opacity).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    const invalidationsAtRest = notifySurfaceGeometryChanged.mock.calls.length;
    expect(invalidationsAtRest).toBe(0);
    expect(driver.fire()).toBe(false);
    expect(notifySurfaceGeometryChanged).toHaveBeenCalledTimes(invalidationsAtRest);

    rerender(renderPanel(true));
    expect(panel).toHaveAttribute("data-closing", "true");
    expect(panel).toHaveAttribute("data-presence-phase", "hiding");
    expect(panel.style.transform).toBe("");
    expect(panel.style.opacity).toBe("");
    expect(scheduler.getSnapshot().subscriberCount).toBe(1);
    act(() => expect(driver.fire()).toBe(true));
    const interruptedCloseX = readTranslateX(panel);
    expect(interruptedCloseX).toBeLessThan(0);
    expect(interruptedCloseX).toBeGreaterThan(offscreenX);
    expect(panel.style.opacity).toBe("");

    rerender(renderPanel(false));
    expect(screen.getByLabelText("Test panel")).toBe(panel);
    expect(readTranslateX(panel)).toBe(interruptedCloseX);
    act(() => expect(driver.fire()).toBe(true));
    expect(readTranslateX(panel)).toBeGreaterThan(interruptedCloseX);
    act(() => driver.flush());
    expect(panel.style.transform).toBe("");
    expect(panel.style.opacity).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });

    scheduler.dispose();
    registry.dispose();
  });

  it("settles immediately without opacity or scheduled frames under reduced motion", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(panelBounds(288));
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const notifySurfaceGeometryChanged = vi.fn();
    const registry = createMaterialSurfaceRegistry(null);
    const renderPanel = (closing: boolean) => (
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <ReducedMotionProvider override>
          <MotionProvider scheduler={scheduler}>
            <WorkspaceSidePanel closing={closing} label="Reduced panel" />
          </MotionProvider>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(renderPanel(false));
    const panel = screen.getByLabelText("Reduced panel");
    const offscreenX = -(288 + 16 + WORKSPACE_SIDE_PANEL_OFFSCREEN_MARGIN_PX);

    expect(panel).toHaveAttribute("data-presence-phase", "visible");
    expect(panel.style.transform).toBe("");
    expect(panel.style.opacity).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });

    rerender(renderPanel(true));
    expect(panel).toHaveAttribute("data-presence-phase", "hidden");
    expect(panel.style.transform).toBe(`translate3d(${offscreenX}px, 0px, 0) scale(0.94)`);
    expect(panel.style.opacity).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    expect(notifySurfaceGeometryChanged).not.toHaveBeenCalled();

    scheduler.dispose();
    registry.dispose();
  });
});

function readTranslateX(element: HTMLElement): number {
  return Number.parseFloat(element.style.transform.match(/translate3d\(([-\d.]+)px/)?.[1] ?? "0");
}

function panelBounds(width: number): DOMRect {
  return {
    bottom: 400,
    height: 326,
    left: 16,
    right: 16 + width,
    top: 74,
    width,
    x: 16,
    y: 74,
    toJSON: () => ({}),
  };
}

describe("WorkspaceSidePanelContentSwitcher", () => {
  it("crossfades views and updates the shell content height to the active view", () => {
    const offsetHeight = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.viewIndex === "0") return 180;
        if (this.dataset.viewIndex === "1") return 360;
        return 0;
      });
    const renderSwitcher = (activeIndex: 0 | 1) => (
      <WorkspaceSidePanelContentSwitcher
        activeIndex={activeIndex}
        views={[<div key="canvases">Canvases</div>, <div key="extensions">Extensions</div>]}
      />
    );
    const { container, rerender } = render(renderSwitcher(0));
    const switcher = container.firstElementChild as HTMLElement;
    const views = switcher.querySelectorAll<HTMLElement>("[data-view-index]");

    expect(switcher.style.height).toBe("180px");
    expect(views[0]).toHaveAttribute("data-active", "true");
    expect(views[0]).not.toHaveAttribute("inert");
    expect(views[1]).toHaveAttribute("inert");

    rerender(renderSwitcher(1));
    expect(switcher.style.height).toBe("360px");
    expect(views[0]).toHaveAttribute("inert");
    expect(views[1]).toHaveAttribute("data-active", "true");
    expect(views[1]).not.toHaveAttribute("inert");
    offsetHeight.mockRestore();
  });

  it("measures natural content height so stretched views and glass overscan never ratchet it", () => {
    const offsetHeight = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.viewIndex !== "0") return 0;
        return this.style.height === "auto" ? 180 : 400;
      });
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(480);
    const { container } = render(
      <WorkspaceSidePanelContentSwitcher
        activeIndex={0}
        views={[<div key="canvases">Canvases</div>, <div key="extensions">Extensions</div>]}
      />,
    );
    const switcher = container.firstElementChild as HTMLElement;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(switcher.style.height).toBe("180px");
    expect(switcher.querySelector<HTMLElement>('[data-view-index="0"]')!.style.height).toBe("");
    offsetHeight.mockRestore();
    scrollHeight.mockRestore();
  });
});

class ControlledFrameDriver implements MotionFrameDriver {
  private callbacks = new Map<number, (timestampMs: number) => void>();
  private nextHandle = 1;
  private timestampMs = 0;

  request(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
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
      // The shared scheduler queues at most one next frame while subscribers remain active.
    }
  }
}
