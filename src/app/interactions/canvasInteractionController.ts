import {
  geometryEquals,
  type CanvasPoint,
  type ElementGeometry,
} from "../../canvas/geometry/canvasGeometry";
import {
  centerViewportOn,
  createViewport,
  resetViewportZoom,
  scaleViewportAt,
  screenToWorld,
  wheelZoomViewport,
  type CanvasViewport,
} from "../../canvas/geometry/viewportMath";
import type {
  CanvasInteractionControllerOptions,
  CanvasInteractionController,
  CanvasInteractionSnapshot,
  GeometryPreview,
  InteractionElement,
  MoveGestureInput,
  PointerSample,
  ResizeGestureInput,
  SelectionGestureInput,
} from "./canvasInteractionTypes";
import {
  idleCanvasInteractionSnapshot,
  NO_SNAP_GUIDES,
  snapGuidesOf,
} from "./canvasInteractionTypes";
import { mergeSelection, previewSelection, selectionContentPoint } from "./selectionEngine";
import { constrainResizeGeometry, resizeBottomRight } from "./resizeGeometry";
import {
  prepareSnapTargets,
  snapMovedGroup,
  snapResizedGeometry,
  type PreparedSnapTargets,
} from "./snappingEngine";
import type { TransientInteractionListener } from "./transientInteractionService";
import { createWheelZoomGlide } from "./wheelZoomGlide";
import {
  createPanGestureFrameQueue,
  projectPanViewport,
  type PanGestureFrameState,
  updatePanViewport,
} from "./panGestureFrameQueue";

export type { CanvasInteractionController } from "./canvasInteractionTypes";

type PanGesture = PanGestureFrameState & {
  readonly kind: "pan";
  readonly pointerId: number;
  readonly cancelViewport: CanvasViewport;
};

type SelectionGesture = {
  readonly kind: "selection-box";
  readonly pointerId: number;
  /** In the scope's content, which may scroll under the box. */
  readonly startWorld: { x: number; y: number };
  readonly input: SelectionGestureInput;
};

type MoveGesture = {
  readonly kind: "move";
  readonly pointerId: number;
  readonly input: MoveGestureInput;
  readonly original: readonly InteractionElement[];
  readonly targets: PreparedSnapTargets;
  lastScreen: { x: number; y: number };
  distance: number;
  raw: GeometryPreview[];
};

type ResizeGesture = {
  readonly kind: "resize";
  readonly pointerId: number;
  readonly input: ResizeGestureInput;
  readonly targets: PreparedSnapTargets;
  lastScreen: { x: number; y: number };
  /** The pointer's travel since the gesture began, unclamped, so the size always follows it. */
  travel: CanvasPoint;
  raw: ElementGeometry;
};

type PrimaryGesture = PanGesture | SelectionGesture | MoveGesture | ResizeGesture;

export function createCanvasInteractionController(
  options: CanvasInteractionControllerOptions,
): CanvasInteractionController {
  let disposed = false;
  let gesture: PrimaryGesture | null = null;
  let snapshot: CanvasInteractionSnapshot = idleCanvasInteractionSnapshot(
    options.canvasKey,
    options.viewport,
  );
  const listeners = new Set<TransientInteractionListener>();

  const publish = (patch: Partial<CanvasInteractionSnapshot>) => {
    if (disposed) return;
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };

  const finishGesture = (patch: Partial<CanvasInteractionSnapshot> = {}) => {
    gesture = null;
    publish({
      activeInteraction: null,
      selectionRectangle: null,
      selectionClip: null,
      selectionPreviewIds: [],
      geometryPreviews: [],
      snapGuides: NO_SNAP_GUIDES,
      ...patch,
    });
  };

  const panFrames = createPanGestureFrameQueue<PanGesture>(options.panFrameScheduler, (pan) => {
    if (!disposed && gesture === pan) {
      publish({ viewport: projectPanViewport(pan, snapshot.viewport.screen) });
    }
  });

  const zoomGlide = options.panFrameScheduler
    ? createWheelZoomGlide({
        scheduler: options.panFrameScheduler,
        now: options.now ?? (() => performance.now()),
        zoom: () => snapshot.viewport.zoom,
        apply: (zoom, anchor) =>
          transformCamera((current) => scaleViewportAt(current, anchor, zoom)),
        settled: () => options.onViewportSettled?.(snapshot.viewport, snapshot.canvasKey),
      })
    : null;

  /** Applies a camera change; during a canvas pan it composes with the pan's own movement. */
  const transformCamera = (transform: (viewport: CanvasViewport) => CanvasViewport) => {
    const activePan = gesture?.kind === "pan" ? gesture : null;
    if (activePan) panFrames.cancel();
    publish({
      viewport: activePan
        ? updatePanViewport(activePan, snapshot.viewport.screen, transform)
        : transform(snapshot.viewport),
    });
  };

  const start = (next: PrimaryGesture, active: CanvasInteractionSnapshot["activeInteraction"]) => {
    if (disposed || gesture) return false;
    gesture = next;
    publish({
      activeInteraction: active,
      selectionRectangle: null,
      selectionClip: null,
      selectionPreviewIds: [],
      geometryPreviews: [],
      snapGuides: NO_SNAP_GUIDES,
    });
    return true;
  };

  const updatePointer = (sample: PointerSample) => {
    if (disposed || !gesture || gesture.pointerId !== sample.pointerId) return;
    if (gesture.kind === "pan") {
      gesture.latestScreen = sample.screen;
      panFrames.queue(gesture);
      return;
    }
    const pointerWorld = screenToWorld(sample.screen, snapshot.viewport);
    if (gesture.kind === "selection-box") {
      publish(
        previewSelection(gesture.startWorld, pointerWorld, gesture.input, snapshot.selectedIds),
      );
      return;
    }
    const dx = (sample.screen.x - gesture.lastScreen.x) / snapshot.viewport.zoom;
    const dy = (sample.screen.y - gesture.lastScreen.y) / snapshot.viewport.zoom;
    gesture.lastScreen = sample.screen;
    if (gesture.kind === "move") {
      const move = gesture;
      move.distance = Math.hypot(
        sample.screen.x - move.input.screen.x,
        sample.screen.y - move.input.screen.y,
      );
      move.raw = move.raw.map(({ id, geometry }) => ({
        id,
        geometry: { ...geometry, x: geometry.x + dx, y: geometry.y + dy },
      }));
      const primary = move.original.find(({ id }) => id === move.input.primaryId)!;
      const snapped = sample.snapping
        ? snapMovedGroup(move.raw, primary, move.targets, pointerWorld)
        : { previews: move.raw, guides: [] };
      publish({ geometryPreviews: snapped.previews, snapGuides: snapGuidesOf(snapped.guides) });
      return;
    }
    const { constraints } = gesture.input;
    gesture.travel = { x: gesture.travel.x + dx, y: gesture.travel.y + dy };
    gesture.raw = resizeBottomRight(gesture.input.target.geometry, gesture.travel, constraints);
    const snapped = sample.snapping
      ? snapResizedGeometry(gesture.raw, constraints.aspectRatio, gesture.targets, pointerWorld)
      : { geometry: gesture.raw, guides: [] };
    const preview = constrainResizeGeometry(snapped.geometry, constraints);
    publish({
      geometryPreviews: [{ id: gesture.input.target.id, geometry: preview }],
      snapGuides: snapGuidesOf(snapped.guides),
    });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select: (id, additive) => {
      if (disposed || gesture) return;
      publish({ selectedIds: mergeSelection(snapshot.selectedIds, [id], additive) });
    },
    setSelection: (ids) => {
      if (disposed || gesture) return;
      const next = [...new Set(ids)];
      if (
        next.length !== snapshot.selectedIds.length ||
        next.some((id, index) => id !== snapshot.selectedIds[index])
      ) {
        publish({ selectedIds: next });
      }
    },
    clearSelection: () => {
      if (!disposed && !gesture && snapshot.selectedIds.length > 0) publish({ selectedIds: [] });
    },
    beginPan: (pointerId, screen) =>
      start(
        {
          kind: "pan",
          pointerId,
          cancelViewport: snapshot.viewport,
          startingViewport: snapshot.viewport,
          startScreen: screen,
          latestScreen: screen,
        },
        { kind: "pan", pointerId },
      ),
    beginSelection: (input) => {
      const startWorld = selectionContentPoint(
        screenToWorld(input.screen, snapshot.viewport),
        input,
      );
      return start(
        { kind: "selection-box", pointerId: input.pointerId, startWorld, input },
        { kind: "selection-box", pointerId: input.pointerId },
      );
    },
    beginMove: (input) => {
      const original = input.targets.filter((target) => target.movable && !target.locked);
      if (!original.some((target) => target.id === input.primaryId)) return false;
      const movingIds = new Set(original.map(({ id }) => id));
      const gestureState: MoveGesture = {
        kind: "move",
        pointerId: input.pointerId,
        input,
        original,
        targets: prepareSnapTargets(input.snapTargets.filter(({ id }) => !movingIds.has(id))),
        lastScreen: input.screen,
        distance: 0,
        raw: original.map(({ id, geometry }) => ({ id, geometry })),
      };
      return start(gestureState, {
        kind: "move",
        pointerId: input.pointerId,
        targetIds: original.map(({ id }) => id),
      });
    },
    beginResize: (input) => {
      if (!input.target.resizable || input.target.locked) return false;
      return start(
        {
          kind: "resize",
          pointerId: input.pointerId,
          input,
          targets: prepareSnapTargets(input.snapTargets.filter(({ id }) => id !== input.target.id)),
          lastScreen: input.screen,
          travel: { x: 0, y: 0 },
          raw: input.target.geometry,
        },
        { kind: "resize", pointerId: input.pointerId, targetIds: [input.target.id] },
      );
    },
    updatePointer,
    setMoveSnapping: (pointerId, enabled) => {
      if (disposed || gesture?.kind !== "move" || gesture.pointerId !== pointerId) return;
      if (enabled) {
        updatePointer({ pointerId, screen: gesture.lastScreen, snapping: true });
      } else if (snapshot.snapGuides.length > 0) {
        publish({ snapGuides: NO_SNAP_GUIDES });
      }
    },
    completePointer: (sample) => {
      if (disposed || !gesture || gesture.pointerId !== sample.pointerId) return;
      const current = gesture;
      if (current.kind === "pan") {
        current.latestScreen = sample.screen;
        panFrames.cancel();
        finishGesture({ viewport: projectPanViewport(current, snapshot.viewport.screen) });
        options.onViewportSettled?.(snapshot.viewport, snapshot.canvasKey);
        return;
      }
      updatePointer(sample);
      if (current.kind === "selection-box") {
        // The final sample above has just previewed the selection this box makes.
        const selectedIds = [...snapshot.selectionPreviewIds];
        finishGesture();
        publish({ selectedIds });
        return;
      }
      if (current.kind === "move") {
        const previews = snapshot.geometryPreviews;
        const targets = current.original.flatMap((original) => {
          const preview = previews.find(({ id }) => id === original.id);
          return preview && !geometryEquals(original.geometry, preview.geometry)
            ? [{ id: original.id, from: original.geometry, to: preview.geometry }]
            : [];
        });
        const pointerWorld = screenToWorld(sample.screen, snapshot.viewport);
        const threshold = current.input.commitThresholdScreen ?? 0;
        finishGesture();
        if (targets.length > 0 && current.distance >= threshold) {
          options.commitPort.commitMove({
            primaryId: current.input.primaryId,
            targets,
            pointerWorld,
            screenDistance: current.distance,
            completionBehavior: current.input.completionBehavior ?? "translate",
          });
        }
        return;
      }
      const preview = snapshot.geometryPreviews[0];
      finishGesture();
      if (preview && !geometryEquals(current.input.target.geometry, preview.geometry)) {
        options.commitPort.commitResize({
          id: current.input.target.id,
          handle: "bottom-right",
          from: current.input.target.geometry,
          to: preview.geometry,
        });
      }
    },
    cancelPointer: (pointerId) => {
      if (disposed || gesture?.pointerId !== pointerId) return;
      if (gesture.kind === "pan") panFrames.cancel();
      finishGesture(gesture.kind === "pan" ? { viewport: gesture.cancelViewport } : undefined);
    },
    wheelZoom: (screen, deltaY, smoothing) => {
      if (disposed) return;
      if (smoothing && zoomGlide) return zoomGlide.wheel(screen, deltaY, smoothing.timeConstantMs);
      zoomGlide?.cancel();
      transformCamera((current) => wheelZoomViewport(current, screen, deltaY));
      options.onViewportSettled?.(snapshot.viewport, snapshot.canvasKey);
    },
    resetZoom: () => {
      if (disposed) return;
      zoomGlide?.cancel();
      transformCamera(resetViewportZoom);
      options.onViewportSettled?.(snapshot.viewport, snapshot.canvasKey);
    },
    centerOn: (world, settled) => {
      // A canvas pan owns the camera until it ends.
      if (disposed || gesture?.kind === "pan") return;
      zoomGlide?.cancel();
      publish({ viewport: centerViewportOn(snapshot.viewport, world) });
      if (settled) options.onViewportSettled?.(snapshot.viewport, snapshot.canvasKey);
    },
    resizeViewport: (screen) => {
      if (disposed) return;
      transformCamera((current) => createViewport(current.pan, current.zoom, screen));
    },
    replaceCanvas: (canvasKey, viewport) => {
      if (disposed) return;
      panFrames.cancel();
      zoomGlide?.cancel();
      gesture = null;
      snapshot = idleCanvasInteractionSnapshot(canvasKey, viewport);
      listeners.forEach((listener) => listener());
    },
    reorder: (ids, direction) => {
      const selectedIds = [...new Set(ids)];
      if (!disposed && !gesture && selectedIds.length > 0) {
        options.commitPort.commitLayerOrder({ selectedIds, direction });
      }
    },
    dispose: () => {
      disposed = true;
      panFrames.cancel();
      zoomGlide?.cancel();
      gesture = null;
      listeners.clear();
    },
  };
}
