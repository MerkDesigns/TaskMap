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
import {
  WORKSPACE_SIDE_PANEL_PRESENCE_DURATION_MS,
  WorkspaceSidePanel,
  WorkspaceSidePanelContentSwitcher,
} from "./WorkspaceSidePanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WorkspaceSidePanel motion", () => {
  it("uses shared Fade + short SlideLeft presence and retains a reversible exit", () => {
    expect(WORKSPACE_SIDE_PANEL_PRESENCE_DURATION_MS).toBe(180);
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    const onExitComplete = vi.fn();
    const renderPanel = (closing: boolean) => (
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <ReducedMotionProvider override={false}>
          <MotionProvider scheduler={scheduler}>
            <WorkspaceSidePanel
              closing={closing}
              label="Test panel"
              onExitComplete={onExitComplete}
            >
              <div data-testid="panel-content">Panel</div>
            </WorkspaceSidePanel>
          </MotionProvider>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(renderPanel(false));
    const panel = screen.getByLabelText("Test panel");
    const content = screen.getByTestId("panel-content");
    const contentLayer = content.parentElement as HTMLElement;

    expect(panel).toHaveAttribute("data-material", "acrylic-large");
    expect(contentLayer).toHaveClass("taskmap-workspace-side-panel__content");
    expect(panel).toHaveAttribute("data-presence-phase", "showing");
    expect(panel.style.transform).toBe("translate3d(-18px, 0px, 0)");
    expect(panel.style.willChange).toBe("transform");
    expect(panel.style.opacity).toBe("");
    expect(panel.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("0");
    expect(contentLayer.style.opacity).toBe("0");
    expect(content.style.opacity).toBe("");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 1, framePending: true });

    act(() => expect(driver.fire()).toBe(true));
    expect(readTranslateX(panel)).toBeGreaterThan(-18);
    expect(readTranslateX(panel)).toBeLessThan(0);
    expect(panel.style.opacity).toBe("");
    act(() => driver.flush());
    expect(panel).toHaveAttribute("data-presence-phase", "visible");
    expect(panel.style.transform).toBe("");
    expect(panel.style.willChange).toBe("");
    expect(panel.style.opacity).toBe("");
    expect(panel.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("");
    expect(contentLayer.style.opacity).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    expect(driver.fire()).toBe(false);

    rerender(renderPanel(true));
    expect(panel).toHaveAttribute("data-closing", "true");
    expect(panel).toHaveAttribute("data-presence-phase", "hiding");
    expect(panel.style.opacity).toBe("");
    expect(scheduler.getSnapshot().subscriberCount).toBe(1);
    act(() => expect(driver.fire()).toBe(true));
    const interruptedCloseX = readTranslateX(panel);
    expect(interruptedCloseX).toBeLessThan(0);
    expect(interruptedCloseX).toBeGreaterThan(-18);
    expect(
      Number(panel.style.getPropertyValue("--taskmap-material-presence-progress")),
    ).toBeLessThan(1);
    expect(panel.style.opacity).toBe("");

    rerender(renderPanel(false));
    expect(screen.getByLabelText("Test panel")).toBe(panel);
    expect(readTranslateX(panel)).toBe(interruptedCloseX);
    act(() => expect(driver.fire()).toBe(true));
    expect(readTranslateX(panel)).toBeGreaterThan(interruptedCloseX);
    act(() => driver.flush());
    expect(panel.style.transform).toBe("");
    expect(panel.style.willChange).toBe("");
    expect(panel.style.opacity).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    expect(onExitComplete).not.toHaveBeenCalled();

    rerender(renderPanel(true));
    act(() => driver.flush());
    expect(panel).toHaveAttribute("data-presence-phase", "hidden");
    expect(panel.inert).toBe(true);
    expect(panel.style.transform).toBe("translate3d(-18px, 0px, 0)");
    expect(panel.style.opacity).toBe("");
    expect(onExitComplete).toHaveBeenCalledOnce();

    scheduler.dispose();
    registry.dispose();
  });

  it("settles immediately through the same lifecycle under reduced motion", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const notifySurfaceGeometryChanged = vi.fn();
    const registry = createMaterialSurfaceRegistry(null);
    const onExitComplete = vi.fn();
    const renderPanel = (closing: boolean) => (
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <ReducedMotionProvider override>
          <MotionProvider scheduler={scheduler}>
            <WorkspaceSidePanel
              closing={closing}
              label="Reduced panel"
              onExitComplete={onExitComplete}
            />
          </MotionProvider>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(renderPanel(false));
    const panel = screen.getByLabelText("Reduced panel");

    expect(panel).toHaveAttribute("data-presence-phase", "visible");
    expect(panel.style.transform).toBe("");
    expect(panel.style.opacity).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });

    rerender(renderPanel(true));
    expect(panel).toHaveAttribute("data-presence-phase", "hidden");
    expect(panel.style.transform).toBe("translate3d(-18px, 0px, 0)");
    expect(panel.style.opacity).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    expect(onExitComplete).toHaveBeenCalledOnce();

    scheduler.dispose();
    registry.dispose();
  });
});

function readTranslateX(element: HTMLElement): number {
  return Number.parseFloat(element.style.transform.match(/translate3d\(([-\d.]+)px/)?.[1] ?? "0");
}

describe("WorkspaceSidePanelContentSwitcher", () => {
  it("crossfades views and updates the shell content height to the active view", () => {
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
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
    let views = switcher.querySelectorAll<HTMLElement>("[data-view-index]");

    expect(switcher.style.height).toBe("");
    expect(views).toHaveLength(1);
    expect(views[0]).toHaveAttribute("data-active", "true");
    expect(views[0]).not.toHaveAttribute("inert");

    rerender(renderSwitcher(1));
    views = switcher.querySelectorAll<HTMLElement>("[data-view-index]");
    expect(switcher.style.height).toBe("360px");
    expect(views).toHaveLength(2);
    expect(views[0]).toHaveAttribute("inert");
    expect(views[1]).toHaveAttribute("data-active", "true");
    expect(views[1]).not.toHaveAttribute("inert");
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
