import type {
  CanvasPoint,
  CanvasRectangle,
  CanvasSize,
  ElementGeometry,
} from "../../canvas/geometry/canvasGeometry";
import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import type { PanGestureFrameScheduler } from "./panGestureFrameQueue";
import type { TransientInteractionService } from "./transientInteractionService";

export type ResizeHandle = "bottom-right";

export interface InteractionElement {
  readonly id: string;
  readonly geometry: ElementGeometry;
  readonly locked: boolean;
  readonly movable: boolean;
  readonly resizable: boolean;
  readonly centerSnapping?: boolean;
}

export interface SnapGuide {
  readonly axis: "x" | "y";
  readonly position: number;
  readonly pointerPosition: number;
}

export interface GeometryPreview {
  readonly id: string;
  readonly geometry: ElementGeometry;
}

export interface MoveCommitTarget {
  readonly id: string;
  readonly from: ElementGeometry;
  readonly to: ElementGeometry;
}

export interface MoveCommit {
  readonly primaryId: string;
  readonly targets: readonly MoveCommitTarget[];
  readonly pointerWorld: CanvasPoint;
  readonly screenDistance: number;
  readonly completionBehavior: "translate" | "place";
}

export interface ResizeCommit {
  readonly id: string;
  readonly handle: ResizeHandle;
  readonly from: ElementGeometry;
  readonly to: ElementGeometry;
}

export type LayerDirection = "back" | "backward" | "forward" | "front";

export interface LayerOrderCommit {
  readonly selectedIds: readonly string[];
  readonly direction: LayerDirection;
}

/** Persistent completion boundary. It deliberately cannot express arbitrary document patches. */
export interface CanvasInteractionCommitPort {
  readonly commitMove: (operation: MoveCommit) => void;
  readonly commitResize: (operation: ResizeCommit) => void;
  readonly commitLayerOrder: (operation: LayerOrderCommit) => void;
}

export interface PointerSample {
  readonly pointerId: number;
  readonly screen: CanvasPoint;
  readonly snapping: boolean;
}

export interface ResizeConstraints {
  readonly minimum: CanvasSize;
  readonly maximum: CanvasSize;
  readonly aspectRatio?: number;
}

export interface SelectionScope {
  readonly candidates: readonly InteractionElement[];
  readonly additive: boolean;
  /**
   * For a selection inside scrolling content: how far the content is scrolled now, in world units.
   * Candidates are then in unscrolled content positions and the box follows the content.
   */
  readonly contentOffset?: () => CanvasPoint;
  /** The shown box is cut to this area, e.g. a container's card viewport. */
  readonly clip?: CanvasRectangle;
}

export interface MoveGestureInput {
  readonly pointerId: number;
  readonly screen: CanvasPoint;
  readonly primaryId: string;
  readonly targets: readonly InteractionElement[];
  readonly snapTargets: readonly InteractionElement[];
  readonly commitThresholdScreen?: number;
  readonly completionBehavior?: "translate" | "place";
}

export interface ResizeGestureInput {
  readonly pointerId: number;
  readonly screen: CanvasPoint;
  readonly target: InteractionElement;
  readonly constraints: ResizeConstraints;
  readonly snapTargets: readonly InteractionElement[];
}

export interface SelectionGestureInput extends SelectionScope {
  readonly pointerId: number;
  readonly screen: CanvasPoint;
}

export interface CanvasInteractionSnapshot {
  readonly canvasKey: string;
  readonly viewport: CanvasViewport;
  readonly activeInteraction:
    | { readonly kind: "pan"; readonly pointerId: number }
    | { readonly kind: "selection-box"; readonly pointerId: number }
    | { readonly kind: "move"; readonly pointerId: number; readonly targetIds: readonly string[] }
    | { readonly kind: "resize"; readonly pointerId: number; readonly targetIds: readonly string[] }
    | null;
  readonly selectedIds: readonly string[];
  readonly selectionPreviewIds: readonly string[];
  readonly selectionRectangle: CanvasRectangle | null;
  /** Only this part of the box shows; the rest has scrolled out of its container's view. */
  readonly selectionClip: CanvasRectangle | null;
  readonly geometryPreviews: readonly GeometryPreview[];
  readonly snapGuides: readonly SnapGuide[];
}

export interface CanvasInteractionControllerOptions {
  readonly canvasKey: string;
  readonly viewport: CanvasViewport;
  readonly commitPort: CanvasInteractionCommitPort;
  readonly panFrameScheduler?: PanGestureFrameScheduler;
  readonly onViewportSettled?: (viewport: CanvasViewport, canvasKey: string) => void;
}

export interface CanvasInteractionController extends TransientInteractionService {
  readonly getSnapshot: () => CanvasInteractionSnapshot;
  readonly select: (id: string, additive: boolean) => void;
  readonly setSelection: (ids: readonly string[]) => void;
  readonly clearSelection: () => void;
  readonly beginPan: (pointerId: number, screen: CanvasPoint) => boolean;
  readonly beginSelection: (input: SelectionGestureInput) => boolean;
  readonly beginMove: (input: MoveGestureInput) => boolean;
  readonly beginResize: (input: ResizeGestureInput) => boolean;
  readonly updatePointer: (sample: PointerSample) => void;
  readonly setMoveSnapping: (pointerId: number, enabled: boolean) => void;
  readonly completePointer: (sample: PointerSample) => void;
  readonly cancelPointer: (pointerId: number) => void;
  readonly wheelZoom: (screen: CanvasPoint, deltaY: number) => void;
  readonly resetZoom: () => void;
  /**
   * Centres the camera on a world point, e.g. from the minimap. `settled` marks the end of a
   * navigation gesture; only then is the camera remembered.
   */
  readonly centerOn: (world: CanvasPoint, settled: boolean) => void;
  readonly resizeViewport: (screen: CanvasSize) => void;
  readonly replaceCanvas: (canvasKey: string, viewport: CanvasViewport) => void;
  readonly reorder: (ids: readonly string[], direction: LayerDirection) => void;
  readonly dispose: () => void;
}

/**
 * One shared empty guide list: every unsnapped move frame would otherwise publish a new empty
 * array, and subscribers that compare snapshot fields would re-render for nothing.
 */
export const NO_SNAP_GUIDES: readonly SnapGuide[] = Object.freeze([]);
export const snapGuidesOf = (guides: readonly SnapGuide[]) =>
  guides.length > 0 ? guides : NO_SNAP_GUIDES;

export function idleCanvasInteractionSnapshot(
  canvasKey: string,
  viewport: CanvasViewport,
): CanvasInteractionSnapshot {
  return {
    canvasKey,
    viewport,
    activeInteraction: null,
    selectedIds: [],
    selectionPreviewIds: [],
    selectionRectangle: null,
    selectionClip: null,
    geometryPreviews: [],
    snapGuides: NO_SNAP_GUIDES,
  };
}
