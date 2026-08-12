import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";
import { createViewport } from "./geometry/viewportMath";
import {
  createRendererV2CameraController,
  type RendererV2CameraController,
  type RendererV2CameraSnapshot,
} from "./interaction/rendererV2CameraController";
import type { CanvasCameraSession } from "./interaction/canvasCameraSession";
import "../ui/theme/theme.css";
import "./RendererV2CanvasViewport.css";

const GRID_SPACING_WORLD = 24;
const GRID_OPACITY = 0.5;
const DOT_FADE_START = 0.55;
const DOT_FADE_SPAN = 0.45;

export interface RendererV2CanvasViewportProps {
  readonly children?: ReactNode;
  readonly activeCanvasId?: string | null;
  readonly cameraSession?: CanvasCameraSession;
  readonly worldSize?: { readonly width: number; readonly height: number };
}

function applyCameraSnapshot(
  viewportElement: HTMLDivElement,
  worldElement: HTMLDivElement,
  snapshot: RendererV2CameraSnapshot,
) {
  const { pan, zoom } = snapshot.viewport;
  const dotOpacityScale = Math.min(1, Math.max(0, (zoom - DOT_FADE_START) / DOT_FADE_SPAN));
  worldElement.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`;
  viewportElement.style.setProperty("--taskmap-renderer-v2-grid-x", `${pan.x}px`);
  viewportElement.style.setProperty("--taskmap-renderer-v2-grid-y", `${pan.y}px`);
  viewportElement.style.setProperty(
    "--taskmap-renderer-v2-grid-size",
    `${GRID_SPACING_WORLD * zoom}px`,
  );
  viewportElement.style.setProperty(
    "--taskmap-renderer-v2-grid-opacity",
    String(GRID_OPACITY * dotOpacityScale),
  );
  viewportElement.dataset.panning = String(snapshot.panning);
}

function localPoint(event: { clientX: number; clientY: number }, element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function isEmptyCanvasTarget(
  target: EventTarget | null,
  viewport: HTMLElement,
  world: HTMLElement,
) {
  return target === viewport || target === world;
}

function isApplicationChromeTarget(target: EventTarget | null) {
  return (
    target instanceof Element && Boolean(target.closest("[data-taskmap-canvas-input-boundary]"))
  );
}

export function RendererV2CanvasViewport({
  children,
  activeCanvasId = null,
  cameraSession,
  worldSize,
}: RendererV2CanvasViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<RendererV2CameraController | null>(null);
  const activeCanvasIdRef = useRef(activeCanvasId);
  const cameraSessionRef = useRef(cameraSession);

  cameraSessionRef.current = cameraSession;

  useLayoutEffect(() => {
    const viewportElement = viewportRef.current;
    const worldElement = worldRef.current;
    if (!viewportElement || !worldElement) return;

    const present = (snapshot: RendererV2CameraSnapshot) =>
      applyCameraSnapshot(viewportElement, worldElement, snapshot);
    const initialCanvasId = activeCanvasIdRef.current;
    const savedCamera = initialCanvasId
      ? cameraSessionRef.current?.get(initialCanvasId)
      : undefined;
    const camera = createRendererV2CameraController({
      initialViewport: createViewport(savedCamera?.pan ?? { x: 0, y: 0 }, savedCamera?.zoom ?? 1, {
        width: viewportElement.clientWidth,
        height: viewportElement.clientHeight,
      }),
      frames: {
        request: (callback) => window.requestAnimationFrame(callback),
        cancel: (handle) => window.cancelAnimationFrame(handle),
      },
      present,
    });
    cameraRef.current = camera;
    present(camera.getSnapshot());

    const handleWheel = (event: WheelEvent) => {
      if (isApplicationChromeTarget(event.target)) return;
      event.preventDefault();
      camera.wheelZoom(localPoint(event, viewportElement), event.deltaY);
      window.clearTimeout(wheelCommitTimer);
      wheelCommitTimer = window.setTimeout(() => {
        const canvasId = activeCanvasIdRef.current;
        if (canvasId) cameraSessionRef.current?.set(canvasId, camera.getSnapshot().viewport);
      }, 140);
    };
    let wheelCommitTimer = 0;
    viewportElement.addEventListener("wheel", handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      camera.resize({ width: viewportElement.clientWidth, height: viewportElement.clientHeight });
    });
    resizeObserver.observe(viewportElement);

    return () => {
      window.clearTimeout(wheelCommitTimer);
      const canvasId = activeCanvasIdRef.current;
      if (canvasId) cameraSessionRef.current?.set(canvasId, camera.getSnapshot().viewport);
      resizeObserver.disconnect();
      viewportElement.removeEventListener("wheel", handleWheel);
      camera.dispose();
      cameraRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const camera = cameraRef.current;
    const viewportElement = viewportRef.current;
    if (!camera || !viewportElement) return;
    const previousCanvasId = activeCanvasIdRef.current;
    if (previousCanvasId === activeCanvasId) return;
    if (previousCanvasId) cameraSession?.set(previousCanvasId, camera.getSnapshot().viewport);
    const saved = activeCanvasId ? cameraSession?.get(activeCanvasId) : undefined;
    camera.replaceViewport(
      createViewport(saved?.pan ?? { x: 0, y: 0 }, saved?.zoom ?? 1, {
        width: viewportElement.clientWidth,
        height: viewportElement.clientHeight,
      }),
    );
    activeCanvasIdRef.current = activeCanvasId;
  }, [activeCanvasId, cameraSession]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    const camera = cameraRef.current;
    if (!viewport || !world || !camera) return;
    if (isApplicationChromeTarget(event.target)) return;

    const emptyTarget = isEmptyCanvasTarget(event.target, viewport, world);
    const primaryEmptyPan = event.button === 0 && emptyTarget;
    const retainedPanGesture = event.button === 1 || (event.button === 0 && event.ctrlKey);
    if (!primaryEmptyPan && !retainedPanGesture) return;
    if (!camera.beginPan(event.pointerId, localPoint(event, viewport))) return;

    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    cameraRef.current?.updatePan(event.pointerId, localPoint(event, viewport));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    cameraRef.current?.completePan(event.pointerId);
    const canvasId = activeCanvasIdRef.current;
    const camera = cameraRef.current;
    if (canvasId && camera) cameraSessionRef.current?.set(canvasId, camera.getSnapshot().viewport);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    cameraRef.current?.cancelPan(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <main
      ref={viewportRef}
      className="taskmap-target-theme taskmap-renderer-v2-canvas-viewport"
      data-panning="false"
      aria-label="TaskMap canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      onAuxClick={(event) => event.preventDefault()}
    >
      <div
        ref={worldRef}
        className="taskmap-renderer-v2-canvas-world"
        style={worldSize ? { width: worldSize.width, height: worldSize.height } : undefined}
      >
        {import.meta.env.DEV ? (
          <div className="taskmap-renderer-v2-canvas-origin" aria-hidden="true" />
        ) : null}
        {children}
      </div>
    </main>
  );
}
