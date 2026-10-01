import type { ReactNode } from "react";
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
    <ReducedMotionProvider override={harness.reducedMotion}>
      <MotionProvider scheduler={harness.scheduler}>{children}</MotionProvider>
    </ReducedMotionProvider>
  );
}

export function createModalPresenceTestHarness(reducedMotion: boolean) {
  const driver = new ControlledFrameDriver();
  const scheduler = createMotionFrameScheduler(driver);
  return {
    driver,
    scheduler,
    reducedMotion,
    dispose() {
      scheduler.dispose();
    },
  };
}

export type ModalPresenceTestHarness = ReturnType<typeof createModalPresenceTestHarness>;

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
