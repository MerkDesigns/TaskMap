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
  it("uses shared Fade without movement or opacity on the glass root", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const notifySurfaceGeometryChanged = vi.fn();
    const onExitComplete = vi.fn();
    const renderSurface = (visible: boolean) => (
      <MaterialSurfaceRegistrationProvider value={{ registry, notifySurfaceGeometryChanged }}>
        <ReducedMotionProvider override={false}>
          <MotionProvider scheduler={scheduler}>
            <MinimapSurface visible={visible} onExitComplete={onExitComplete}>
              <div data-testid="map-content">Map</div>
            </MinimapSurface>
          </MotionProvider>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(renderSurface(true));
    const surface = screen.getByLabelText("Minimap");
    const content = screen.getByTestId("map-content");

    expect(surface.style.opacity).toBe("");
    expect(surface.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("0");
    expect(content.style.opacity).toBe("0");
    expect(surface.style.transform).toBe("");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 1, framePending: true });
    act(() => driver.fire());
    expect(
      Number(surface.style.getPropertyValue("--taskmap-material-presence-progress")),
    ).toBeGreaterThan(0);
    expect(surface.style.opacity).toBe("");
    expect(surface.style.transform).toBe("");
    act(() => driver.flush());
    expect(surface).toHaveAttribute("data-presence-phase", "visible");
    expect(surface.style.opacity).toBe("");
    expect(surface.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("");
    expect(content.style.opacity).toBe("");
    expect(surface.style.transform).toBe("");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });

    rerender(renderSurface(false));
    expect(surface).toHaveAttribute("data-visible", "false");
    act(() => driver.fire());
    expect(
      Number(surface.style.getPropertyValue("--taskmap-material-presence-progress")),
    ).toBeLessThan(1);
    expect(surface.style.opacity).toBe("");
    act(() => driver.flush());
    expect(surface).toHaveAttribute("data-presence-phase", "hidden");
    expect(surface.style.opacity).toBe("");
    expect(surface.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("0");
    expect(content.style.opacity).toBe("0");
    expect(onExitComplete).toHaveBeenCalledOnce();
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });

    const revisionAtRest = registry.getSnapshot().planeRevisions.base;
    expect(driver.fire()).toBe(false);
    expect(registry.getSnapshot().planeRevisions.base).toBe(revisionAtRest);
    expect(notifySurfaceGeometryChanged).not.toHaveBeenCalled();
    scheduler.dispose();
    registry.dispose();
  });

  it("settles the shared lifecycle immediately under reduced motion", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const registry = createMaterialSurfaceRegistry(null);
    const onExitComplete = vi.fn();
    const renderSurface = (visible: boolean) => (
      <MaterialSurfaceRegistrationProvider
        value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
      >
        <ReducedMotionProvider override>
          <MotionProvider scheduler={scheduler}>
            <MinimapSurface visible={visible} onExitComplete={onExitComplete} />
          </MotionProvider>
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { rerender } = render(renderSurface(true));
    const surface = screen.getByLabelText("Minimap");
    expect(surface).toHaveAttribute("data-presence-phase", "visible");
    expect(surface.style.opacity).toBe("");
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot().subscriberCount).toBe(0);

    rerender(renderSurface(false));
    expect(surface).toHaveAttribute("data-presence-phase", "hidden");
    expect(surface.style.opacity).toBe("");
    expect(surface.style.getPropertyValue("--taskmap-material-presence-progress")).toBe("0");
    expect(onExitComplete).toHaveBeenCalledOnce();
    expect(registry.getSnapshot().surfaces).toEqual([]);
    expect(scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    scheduler.dispose();
    registry.dispose();
  });

  it("uses native Large with a plain transparent viewport", () => {
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
    expect(interior).not.toHaveAttribute("data-material");
    expect(interior).not.toHaveAttribute("data-material-surface-id");
    expect(interior.style.getPropertyValue("--taskmap-material-radius")).toBe("");
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
