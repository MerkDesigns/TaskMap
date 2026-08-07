import type {
  CanvasPoint,
  CanvasRectangle,
  CanvasSize,
  ElementGeometry,
} from "../../canvas/geometry/canvasGeometry";
import type { CanvasViewport } from "../../canvas/geometry/viewportMath";

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
  readonly geometryPreviews: readonly GeometryPreview[];
  readonly snapGuides: readonly SnapGuide[];
}

export interface CanvasInteractionControllerOptions {
  readonly canvasKey: string;
  readonly viewport: CanvasViewport;
  readonly commitPort: CanvasInteractionCommitPort;
  readonly onViewportSettled?: (viewport: CanvasViewport, canvasKey: string) => void;
}
