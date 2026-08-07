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
  CanvasInteractionSnapshot,
  GeometryPreview,
  InteractionElement,
  LayerDirection,
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
import type {
  TransientInteractionListener,
  TransientInteractionService,
} from "./transientInteractionService";

type PanGesture = {
  readonly kind: "pan";
  readonly pointerId: number;
  readonly startingViewport: CanvasViewport;
  lastScreen: { x: number; y: number };
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

export interface CanvasInteractionController extends TransientInteractionService {
  readonly getSnapshot: () => CanvasInteractionSnapshot;
  readonly select: (id: string, additive: boolean) => void;
  readonly setSelection: (ids: readonly string[]) => void;
  readonly clearSelection: () => void;
  readonly beginPan: (pointerId: number, screen: { x: number; y: number }) => boolean;
  readonly beginSelection: (input: SelectionGestureInput) => boolean;
  readonly beginMove: (input: MoveGestureInput) => boolean;
  readonly beginResize: (input: ResizeGestureInput) => boolean;
  readonly updatePointer: (sample: PointerSample) => void;
  readonly setMoveSnapping: (pointerId: number, enabled: boolean) => void;
  readonly completePointer: (sample: PointerSample) => void;
  readonly cancelPointer: (pointerId: number) => void;
  readonly wheelZoom: (screen: { x: number; y: number }, deltaY: number) => void;
  readonly resetZoom: () => void;
  readonly resizeViewport: (screen: { width: number; height: number }) => void;
  readonly replaceCanvas: (canvasKey: string, viewport: CanvasViewport) => void;
  readonly reorder: (ids: readonly string[], direction: LayerDirection) => void;
  readonly dispose: () => void;
}

export function createCanvasInteractionController(
  options: CanvasInteractionControllerOptions,
): CanvasInteractionController {
  let disposed = false;
  let gesture: PrimaryGesture | null = null;
  let snapshot: CanvasInteractionSnapshot = idle(options.canvasKey, options.viewport);
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
      const dx = sample.screen.x - gesture.lastScreen.x;
      const dy = sample.screen.y - gesture.lastScreen.y;
      gesture.lastScreen = sample.screen;
      publish({
        viewport: createViewport(
          { x: snapshot.viewport.pan.x + dx, y: snapshot.viewport.pan.y + dy },
          snapshot.viewport.zoom,
          snapshot.viewport.screen,
        ),
      });
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
        { kind: "pan", pointerId, startingViewport: snapshot.viewport, lastScreen: screen },
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
      updatePointer(sample);
      if (current.kind === "pan") {
        finishGesture();
        options.onViewportSettled?.(snapshot.viewport, snapshot.canvasKey);
        return;
      }
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
      finishGesture(gesture.kind === "pan" ? { viewport: gesture.startingViewport } : undefined);
    },
    wheelZoom: (screen, deltaY) => {
      if (disposed) return;
      publish({ viewport: wheelZoomViewport(snapshot.viewport, screen, deltaY) });
      options.onViewportSettled?.(snapshot.viewport, snapshot.canvasKey);
    },
    resetZoom: () => {
      if (disposed) return;
      publish({ viewport: resetViewportZoom(snapshot.viewport) });
      options.onViewportSettled?.(snapshot.viewport, snapshot.canvasKey);
    },
    resizeViewport: (screen) => {
      if (disposed) return;
      publish({ viewport: createViewport(snapshot.viewport.pan, snapshot.viewport.zoom, screen) });
    },
    replaceCanvas: (canvasKey, viewport) => {
      if (disposed) return;
      gesture = null;
      snapshot = idle(canvasKey, viewport);
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
      gesture = null;
      listeners.clear();
    },
  };
}

function idle(canvasKey: string, viewport: CanvasViewport): CanvasInteractionSnapshot {
  return {
    canvasKey,
    viewport,
    activeInteraction: null,
    selectedIds: [],
    selectionPreviewIds: [],
    selectionRectangle: null,
    geometryPreviews: [],
    snapGuides: [],
  };
}
