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
import { MinimapSurface, MinimapViewport } from "./MinimapSurface";

afterEach(cleanup);

describe("MinimapSurface", () => {
  it("animates native glass DOM opacity on the shared scheduler without cached masks", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    const renderSurface = (visible: boolean) => (
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <ReducedMotionProvider override={false}>
          <MotionProvider scheduler={scheduler}>
            <MinimapSurface visible={visible}>Map</MinimapSurface>
          </MotionProvider>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(renderSurface(true));
    const surface = screen.getByLabelText("Minimap");

    expect(surface.style.opacity).toBe("0");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 1, framePending: true });
    act(() => driver.fire());
    expect(Number(surface.style.opacity)).toBeGreaterThan(0);
    act(() => driver.flush());
    expect(surface.style.opacity).toBe("1");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(surface.style.willChange).toBe("");
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });

    rerender(renderSurface(false));
    expect(surface).toHaveAttribute("data-visible", "false");
    act(() => driver.fire());
    expect(Number(surface.style.opacity)).toBeLessThan(1);
    act(() => driver.flush());
    expect(surface.style.opacity).toBe("0");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });

    const revisionAtRest = registry.getSnapshot().planeRevisions.base;
    expect(driver.fire()).toBe(false);
    expect(registry.getSnapshot().planeRevisions.base).toBe(revisionAtRest);
    expect(notifySurfaceGeometryChanged).not.toHaveBeenCalled();
    scheduler.dispose();
    registry.dispose();
  });

  it("settles native DOM opacity immediately under reduced motion", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const renderSurface = (visible: boolean) => (
      <MaterialSurfaceRegistrationProvider
        value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
      >
        <ReducedMotionProvider override>
          <MotionProvider scheduler={scheduler}>
            <MinimapSurface visible={visible} />
          </MotionProvider>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(renderSurface(true));
    const surface = screen.getByLabelText("Minimap");
    expect(surface.style.opacity).toBe("1");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot().subscriberCount).toBe(0);

    rerender(renderSurface(false));
    expect(surface.style.opacity).toBe("0");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    scheduler.dispose();
    registry.dispose();
  });

  it("uses native Large and non-registering Cutout without cached registrations", () => {
    const registry = createMaterialSurfaceRegistry(null);
    render(
      <MaterialSurfaceRegistrationProvider
        value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
      >
        <ReducedMotionProvider override>
          <MinimapSurface visible>
            <MinimapViewport data-testid="interior" />
          </MinimapSurface>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>,
    );

    const shell = screen.getByLabelText("Minimap");
    const interior = screen.getByTestId("interior");
    expect(shell).toHaveAttribute("data-material", "acrylic-large");
    expect(shell.style.getPropertyValue("--taskmap-material-radius")).toBe("12px");
    expect(interior).toHaveAttribute("data-material", "cutout");
    expect(interior).not.toHaveAttribute("data-material-surface-id");
    expect(interior.style.getPropertyValue("--taskmap-material-radius")).toBe("6px");
    expect(shell).toHaveAttribute("data-material-strategy", "native-glass");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    registry.dispose();
  });
});

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
      // One pending shared frame advances all active subscribers.
    }
  }
}
