import { geometryEquals, type ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import {
  createViewport,
  resetViewportZoom,
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
  isTinySelection,
  mergeSelection,
  selectIntersectingIds,
  selectionRectangle,
} from "./selectionEngine";
import { constrainResizeGeometry, resizeBottomRight } from "./resizeGeometry";
import {
  prepareSnapTargets,
  snapMovedGeometry,
  snapResizedGeometry,
  type PreparedSnapTargets,
} from "./snappingEngine";
import type { TransientInteractionListener } from "./transientInteractionService";
import {
  createPanGestureFrameQueue,
  projectPanViewport,
  type PanGestureFrameState,
  updatePanViewport,
} from "./panGestureFrameQueue";
import { idleCanvasInteractionSnapshot } from "./canvasInteractionSnapshot";

export type { CanvasInteractionController } from "./canvasInteractionTypes";

type PanGesture = PanGestureFrameState & {
  readonly kind: "pan";
  readonly pointerId: number;
  readonly cancelViewport: CanvasViewport;
};

type SelectionGesture = {
  readonly kind: "selection-box";
  readonly pointerId: number;
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
      selectionPreviewIds: [],
      geometryPreviews: [],
      snapGuides: [],
      ...patch,
    });
  };

  const panFrames = createPanGestureFrameQueue<PanGesture>(options.panFrameScheduler, (pan) => {
    if (!disposed && gesture === pan) {
      publish({ viewport: projectPanViewport(pan, snapshot.viewport.screen) });
    }
  });

  const start = (next: PrimaryGesture, active: CanvasInteractionSnapshot["activeInteraction"]) => {
    if (disposed || gesture) return false;
    gesture = next;
    publish({
      activeInteraction: active,
      selectionRectangle: null,
      selectionPreviewIds: [],
      geometryPreviews: [],
      snapGuides: [],
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
      const rectangle = selectionRectangle(gesture.startWorld, pointerWorld);
      const incoming = isTinySelection(rectangle)
        ? []
        : selectIntersectingIds(rectangle, gesture.input.candidates);
      publish({
        selectionRectangle: rectangle,
        selectionPreviewIds: mergeSelection(snapshot.selectedIds, incoming, gesture.input.additive),
      });
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
      const primary = move.raw.find(({ id }) => id === move.input.primaryId)!;
      const primaryElement = move.original.find(({ id }) => id === move.input.primaryId)!;
      const snapped = sample.snapping
        ? snapMovedGeometry(
            primary.geometry,
            primaryElement.centerSnapping ?? false,
            move.targets,
            pointerWorld,
          )
        : { geometry: primary.geometry, guides: [] };
      const offset = {
        x: snapped.geometry.x - primary.geometry.x,
        y: snapped.geometry.y - primary.geometry.y,
      };
      publish({
        geometryPreviews: move.raw.map(({ id, geometry }) => ({
          id,
          geometry: { ...geometry, x: geometry.x + offset.x, y: geometry.y + offset.y },
        })),
        snapGuides: snapped.guides,
      });
      return;
    }
    const { constraints } = gesture.input;
    const ratio = constraints.aspectRatio;
    gesture.raw = resizeBottomRight(gesture.raw, { x: dx, y: dy }, constraints);
    const snapped = sample.snapping
      ? snapResizedGeometry(gesture.raw, ratio, gesture.targets, pointerWorld)
      : { geometry: gesture.raw, guides: [] };
    const preview = constrainResizeGeometry(snapped.geometry, constraints);
    publish({
      geometryPreviews: [{ id: gesture.input.target.id, geometry: preview }],
      snapGuides: snapped.guides,
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
      const startWorld = screenToWorld(input.screen, snapshot.viewport);
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
        publish({ snapGuides: [] });
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
        const rectangle =
          snapshot.selectionRectangle ?? selectionRectangle(current.startWorld, current.startWorld);
        const incoming = isTinySelection(rectangle)
          ? []
          : selectIntersectingIds(rectangle, current.input.candidates);
        const selectedIds = mergeSelection(snapshot.selectedIds, incoming, current.input.additive);
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
    wheelZoom: (screen, deltaY) => {
      if (disposed) return;
      const activePan = gesture?.kind === "pan" ? gesture : null;
      if (activePan) panFrames.cancel();
      const viewport = activePan
        ? updatePanViewport(activePan, snapshot.viewport.screen, (current) =>
            wheelZoomViewport(current, screen, deltaY),
          )
        : wheelZoomViewport(snapshot.viewport, screen, deltaY);
      publish({ viewport });
      options.onViewportSettled?.(snapshot.viewport, snapshot.canvasKey);
    },
    resetZoom: () => {
      if (disposed) return;
      const activePan = gesture?.kind === "pan" ? gesture : null;
      if (activePan) panFrames.cancel();
      const viewport = activePan
        ? updatePanViewport(activePan, snapshot.viewport.screen, resetViewportZoom)
        : resetViewportZoom(snapshot.viewport);
      publish({ viewport });
      options.onViewportSettled?.(snapshot.viewport, snapshot.canvasKey);
    },
    resizeViewport: (screen) => {
      if (disposed) return;
      const activePan = gesture?.kind === "pan" ? gesture : null;
      if (activePan) panFrames.cancel();
      const resize = (current: CanvasViewport) => createViewport(current.pan, current.zoom, screen);
      const viewport = activePan
        ? updatePanViewport(activePan, snapshot.viewport.screen, resize)
        : resize(snapshot.viewport);
      publish({ viewport });
    },
    replaceCanvas: (canvasKey, viewport) => {
      if (disposed) return;
      panFrames.cancel();
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
      gesture = null;
      listeners.clear();
    },
  };
}
