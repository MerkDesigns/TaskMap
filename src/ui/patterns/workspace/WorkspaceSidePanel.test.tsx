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
import { WorkspaceSidePanel } from "./WorkspaceSidePanel";

afterEach(cleanup);

describe("WorkspaceSidePanel motion", () => {
  it("uses the shared scheduler and invalidates cheap geometry only while motion is active", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    const renderPanel = (closing: boolean) => (
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <ReducedMotionProvider override={false}>
          <MotionProvider scheduler={scheduler}>
            <WorkspaceSidePanel closing={closing} label="Test panel">
              Panel
            </WorkspaceSidePanel>
          </MotionProvider>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(renderPanel(false));
    const panel = screen.getByLabelText("Test panel");

    expect(panel).toHaveAttribute("data-material", "acrylic-large");
    expect(panel.style.transform).toBe("translate3d(-10px, 2px, 0)");
    expect(panel.style.opacity).toBe("0");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 1, framePending: true });

    const invalidationsAtStart = notifySurfaceGeometryChanged.mock.calls.length;
    act(() => expect(driver.fire()).toBe(true));
    expect(notifySurfaceGeometryChanged.mock.calls.length).toBeGreaterThan(invalidationsAtStart);
    expect(panel.style.transform).not.toBe("translate3d(-10px, 2px, 0)");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    act(() => driver.flush());
    expect(panel.style.transform).toBe("");
    expect(panel.style.opacity).toBe("1");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(panel.style.willChange).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    const invalidationsAtRest = notifySurfaceGeometryChanged.mock.calls.length;
    const maskRevisionAtRest = registry.getSnapshot().planeRevisions.base;
    expect(driver.fire()).toBe(false);
    expect(notifySurfaceGeometryChanged).toHaveBeenCalledTimes(invalidationsAtRest);
    expect(registry.getSnapshot().planeRevisions.base).toBe(maskRevisionAtRest);

    rerender(renderPanel(true));
    expect(panel).toHaveAttribute("data-closing", "true");
    expect(scheduler.getSnapshot().subscriberCount).toBe(1);
    act(() => expect(driver.fire()).toBe(true));
    expect(registry.getSnapshot().surfaces).toEqual([]);
    act(() => driver.flush());
    expect(panel.style.transform).toBe("translate3d(-8px, 1px, 0)");
    expect(panel.style.opacity).toBe("0");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });

    scheduler.dispose();
    registry.dispose();
  });

  it("settles immediately under reduced motion without subscribing to frames", () => {
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

    expect(panel.style.transform).toBe("");
    expect(panel.style.opacity).toBe("1");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });

    rerender(renderPanel(true));
    expect(panel.style.transform).toBe("translate3d(-8px, 1px, 0)");
    expect(panel.style.opacity).toBe("0");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    expect(notifySurfaceGeometryChanged).toHaveBeenCalledTimes(2);

    scheduler.dispose();
    registry.dispose();
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
