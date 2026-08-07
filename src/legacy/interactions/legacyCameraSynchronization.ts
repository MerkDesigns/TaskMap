import type { CanvasViewport } from "../../canvas/geometry/viewportMath";

export type LegacyCamera = Pick<CanvasViewport, "pan" | "zoom">;

export interface LegacyCameraFrameScheduler {
  readonly schedule: (callback: () => void) => number;
  readonly cancel: (handle: number) => void;
}

export interface LegacyCameraSynchronization {
  readonly queueControllerCamera: (canvasId: string, camera: LegacyCamera) => void;
  readonly observeLegacyCamera: (canvasId: string, camera: LegacyCamera) => void;
  readonly cancelPending: () => void;
}

export function createLegacyCameraSynchronization(options: {
  readonly initialCanvasId: string;
  readonly initialCamera: LegacyCamera;
  readonly scheduler: LegacyCameraFrameScheduler;
  readonly writeLegacyCamera: (canvasId: string, camera: LegacyCamera) => void;
  readonly adoptLegacyCamera: (canvasId: string, camera: LegacyCamera) => void;
}): LegacyCameraSynchronization {
  let observed = { canvasId: options.initialCanvasId, camera: options.initialCamera };
  let expectedWrite: { canvasId: string; camera: LegacyCamera } | null = null;
  let pending: { canvasId: string; camera: LegacyCamera } | null = null;
  let frame: number | null = null;

  const cancelPending = () => {
    if (frame !== null) options.scheduler.cancel(frame);
    frame = null;
    pending = null;
  };

  const queueControllerCamera = (canvasId: string, camera: LegacyCamera) => {
    if (canvasId !== observed.canvasId) return;
    pending = { canvasId, camera };
    if (frame !== null) return;
    frame = options.scheduler.schedule(() => {
      frame = null;
      const next = pending;
      pending = null;
      if (!next || next.canvasId !== observed.canvasId) return;
      expectedWrite = next;
      options.writeLegacyCamera(next.canvasId, next.camera);
    });
  };

  const observeLegacyCamera = (canvasId: string, camera: LegacyCamera) => {
    if (canvasId !== observed.canvasId) {
      cancelPending();
      expectedWrite = null;
      observed = { canvasId, camera };
      options.adoptLegacyCamera(canvasId, camera);
      return;
    }
    if (
      expectedWrite &&
      expectedWrite.canvasId === canvasId &&
      equal(camera, expectedWrite.camera)
    ) {
      observed = { canvasId, camera };
      expectedWrite = null;
      return;
    }
    if (!equal(camera, observed.camera)) {
      cancelPending();
      expectedWrite = null;
      observed = { canvasId, camera };
      options.adoptLegacyCamera(canvasId, camera);
    }
  };

  return { queueControllerCamera, observeLegacyCamera, cancelPending };
}

function equal(left: LegacyCamera, right: LegacyCamera): boolean {
  return left.zoom === right.zoom && left.pan.x === right.pan.x && left.pan.y === right.pan.y;
}
