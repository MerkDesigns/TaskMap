import type { ReactNode } from "react";
import { vi } from "vitest";
import { MaterialSurfaceRegistrationProvider } from "../../materials/MaterialSurfaceRegistration";
import {
  createMaterialSurfaceRegistry,
  type MaterialSurfaceRegistry,
} from "../../materials/materialSurfaceRegistry";
import { MotionProvider } from "../../motion/MotionProvider";
import {
  createMotionFrameScheduler,
  type MotionFrameDriver,
} from "../../motion/motionFrameScheduler";
import { ReducedMotionProvider } from "../../motion/reducedMotionPreference";

export function ModalPresenceTestProviders({
  children,
  harness,
}: {
  readonly children: ReactNode;
  readonly harness: ModalPresenceTestHarness;
}) {
  return (
    <MaterialSurfaceRegistrationProvider
      value={{ registry: harness.registry, notifySurfaceGeometryChanged: harness.notifyGeometry }}
    >
      <ReducedMotionProvider override={harness.reducedMotion}>
        <MotionProvider scheduler={harness.scheduler}>{children}</MotionProvider>
      </ReducedMotionProvider>
    </MaterialSurfaceRegistrationProvider>
  );
}

export function createModalPresenceTestHarness(
  reducedMotion: boolean,
  overrides: {
    readonly registry?: MaterialSurfaceRegistry;
    readonly notifyGeometry?: () => void;
  } = {},
) {
  const driver = new ControlledFrameDriver();
  const scheduler = createMotionFrameScheduler(driver);
  const observer = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
  const registry = overrides.registry ?? createMaterialSurfaceRegistry(() => observer);
  return {
    driver,
    scheduler,
    registry,
    reducedMotion,
    observer,
    notifyGeometry: vi.fn(overrides.notifyGeometry),
    dispose() {
      scheduler.dispose();
      registry.dispose();
    },
  };
}

export type ModalPresenceTestHarness = ReturnType<typeof createModalPresenceTestHarness>;

export function instrumentMaterialSurfaceRegistry(registry: MaterialSurfaceRegistry) {
  const unregisters: ReturnType<typeof vi.fn<() => void>>[] = [];
  const register = vi.fn<MaterialSurfaceRegistry["register"]>(
    (registration, initialMaskOpacity) => {
      const unregister = vi.fn(registry.register(registration, initialMaskOpacity));
      unregisters.push(unregister);
      return unregister;
    },
  );
  return {
    register,
    unregisters,
    registry: {
      register,
      update: registry.update.bind(registry),
      updateMaskOpacity: registry.updateMaskOpacity.bind(registry),
      updateMaskOpacityBatch: registry.updateMaskOpacityBatch.bind(registry),
      updateMaskOpacitiesBatch: registry.updateMaskOpacitiesBatch.bind(registry),
      refreshMeasurements: registry.refreshMeasurements.bind(registry),
      getSnapshot: registry.getSnapshot.bind(registry),
      subscribe: registry.subscribe.bind(registry),
      dispose: registry.dispose.bind(registry),
    } satisfies MaterialSurfaceRegistry,
  };
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
      // One shared pending frame advances every active modal subscriber.
    }
  }
}
