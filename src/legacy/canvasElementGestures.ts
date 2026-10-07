import type { PointerEvent } from "react";
import type { CanvasInteractionController } from "../app/interactions/canvasInteractionController";
import type { InteractionElement } from "../app/interactions/canvasInteractionTypes";
import type { ElementGeometry } from "../canvas/geometry/canvasGeometry";
import { MIN_HEIGHT, MIN_IMAGE_SIZE, MIN_WIDTH } from "../constants";
import type { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";
import { filterLegacyResizeSnapTargets } from "./interactions/legacyCanvasGeometry";
import {
  getLegacyTextCardDragIds,
  type LegacyTextCardInteractionService,
} from "./interactions/legacyTextCardInteraction";
import type { RetainedCanvasContextValue } from "./RetainedCanvasContext";

type Point = { readonly x: number; readonly y: number };
type Frame = ContainerElement | TextBlockElement;
type Pointer = { readonly pointerId: number; readonly clientX: number; readonly clientY: number };

/** A text card starts moving only after the pointer travels this far, so a click stays a click. */
const CARD_MOVE_THRESHOLD = 3;

export interface CanvasGesturePorts {
  readonly retained: RetainedCanvasContextValue;
  readonly controller: CanvasInteractionController;
  readonly cardDrags: LegacyTextCardInteractionService;
  readonly connections: {
    readonly move: (event: Pointer) => boolean;
    readonly finish: (event: Pointer) => boolean;
    readonly cancelPointer: (pointerId: number) => void;
  };
  readonly world: () => HTMLElement | null;
  readonly selection: () => readonly string[];
  /** Every element as the interaction controller hit-tests and snaps it. */
  readonly interactionElements: () => readonly InteractionElement[];
  /** One element as a gesture target; contained cards only when asked for. */
  readonly gestureElement: (
    id: string,
    includeContainedCard?: boolean,
  ) => InteractionElement | null;
  readonly scene: () => {
    readonly containers: readonly ContainerElement[];
    readonly textBlocks: readonly TextBlockElement[];
    readonly textCards: readonly TextCardElement[];
  };
  readonly isLocked: (id: string) => boolean;
  /** Hidden-content frames neither snap nor take dropped cards. */
  readonly isFrameVisible: (frame: Frame) => boolean;
  readonly canvasPoint: (event: { clientX: number; clientY: number }) => Point;
  readonly canvasSize: () => { readonly width: number; readonly height: number };
  /** Where a card sits, inside its container's rows or loose. */
  readonly cardPosition: (card: TextCardElement) => Point;
  /** A container's visible cards as box-selection candidates. */
  readonly containerCardCandidates: (container: ContainerElement) => InteractionElement[];
  readonly containerScrollOffsets: () => Record<string, number>;
  readonly camera: () => { readonly pan: Point; readonly zoom: number };
  readonly editingCardId: () => string | null;
  /** Commits whatever text is being edited, as clicking elsewhere does. */
  readonly saveOpenEdits: () => void;
  readonly saveTextBlockEdit: () => void;
  /** Ends renaming and text editing without saving, as starting a move does. */
  readonly endEditing: () => void;
  readonly endRename: () => void;
  readonly closeContextMenus: () => void;
  readonly showMinimap: () => void;
}

/** Captures the pointer on the canvas stage, so the gesture follows it outside the element. */
export const captureOnStage = (event: PointerEvent<Element>) =>
  (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
    event.pointerId,
  );

/**
 * Starting gestures on elements: moving elements (and the selection they are in), resizing frames
 * and images within the canvas, and dragging text cards between containers. `ports` returns the
 * latest ports when a press arrives.
 */
export function createElementGestures(ports: () => CanvasGesturePorts) {
  const p = ports;
  const snapTargets = () =>
    p()
      .interactionElements()
      .filter((candidate) => {
        const { containers, textBlocks } = p().scene();
        const frame =
          containers.find(({ id }) => id === candidate.id) ??
          textBlocks.find(({ id }) => id === candidate.id);
        return !frame || p().isFrameVisible(frame);
      });

  /**
   * Starts moving `id` (and the selection it is in). Shift adds it to the selection instead, and
   * a locked element is only selected. False when no move started.
   */
  const beginMove = (
    event: PointerEvent<HTMLElement>,
    id: string,
    options: {
      readonly threshold?: number;
      readonly targetIds?: readonly string[];
      readonly selectionAfterStart?: readonly string[];
      readonly placeTextCards?: boolean;
      readonly primaryGeometry?: ElementGeometry;
    } = {},
  ) => {
    const { controller } = p();
    if (event.button !== 0) return false;
    event.stopPropagation();
    if (event.shiftKey) {
      controller.select(id, true);
      p().closeContextMenus();
      return false;
    }
    if (p().isLocked(id)) {
      controller.setSelection([id]);
      p().closeContextMenus();
      return false;
    }
    const selection = p().selection();
    const movingIds = options.targetIds ?? (selection.includes(id) ? selection : [id]);
    const targets = movingIds.flatMap((targetId) => {
      const target = p().gestureElement(targetId, options.placeTextCards);
      if (!target) return [];
      return [
        targetId === id && options.primaryGeometry
          ? { ...target, geometry: options.primaryGeometry }
          : target,
      ];
    });
    captureOnStage(event);
    if (options.selectionAfterStart) controller.setSelection(options.selectionAfterStart);
    else if (!selection.includes(id)) controller.setSelection([id]);
    p().closeContextMenus();
    p().endEditing();
    return p().retained.binding.interaction.beginMove({
      pointerId: event.pointerId,
      screen: { x: event.clientX, y: event.clientY },
      primaryId: id,
      targets,
      snapTargets: snapTargets(),
      commitThresholdScreen: options.threshold ?? 0,
      completionBehavior: options.placeTextCards ? "place" : "translate",
      ...(options.placeTextCards ? { resolveTextCardDrop: p().cardDrags.getDecision } : {}),
    });
  };

  const beginResize = (
    event: PointerEvent<HTMLButtonElement>,
    id: string,
    activeKind: "container" | "text-block" | "image",
    constraints: Parameters<CanvasInteractionController["beginResize"]>[0]["constraints"],
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (p().isLocked(id)) return;
    captureOnStage(event);
    p().controller.setSelection([id]);
    p().closeContextMenus();
    p().endRename();
    const target = p().gestureElement(id);
    if (!target) return;
    const { containers, textBlocks } = p().scene();
    p().controller.beginResize({
      pointerId: event.pointerId,
      screen: { x: event.clientX, y: event.clientY },
      target,
      constraints,
      snapTargets: filterLegacyResizeSnapTargets(p().interactionElements(), {
        activeId: id,
        activeKind,
        containerIds: new Set(containers.map((frame) => frame.id)),
        textBlockIds: new Set(textBlocks.map((frame) => frame.id)),
        visibleIds: new Set(
          [...containers, ...textBlocks].filter(p().isFrameVisible).map((frame) => frame.id),
        ),
      }),
    });
  };

  return {
    moveFrame(event: PointerEvent<HTMLElement>, frame: Frame) {
      p().saveTextBlockEdit();
      beginMove(event, frame.id);
    },
    moveImage(event: PointerEvent<HTMLElement>, image: ImageElement) {
      beginMove(event, image.id);
    },
    /**
     * Text cards drop into container slots and fly back when released elsewhere; a card in
     * a container drags with the selected cards of that container. Mind-map nodes and loose
     * multi-selections move like any other element.
     */
    moveTextCard(event: PointerEvent<HTMLElement>, card: TextCardElement) {
      if (p().editingCardId() === card.id) return;
      const selection = p().selection();
      // Mind-map nodes never drop into containers, and text-card placement rejects other
      // element types (which cancelled every mind-map drag).
      if (
        card.kind === "mindmap" ||
        (!card.containerId && selection.length > 1 && selection.includes(card.id))
      ) {
        beginMove(event, card.id);
        return;
      }
      const scene = p().scene();
      const movableIds = getLegacyTextCardDragIds([...scene.textCards], card.id, [...selection]);
      const start = p().cardPosition(card);
      const rect = event.currentTarget.getBoundingClientRect();
      const { zoom } = p().controller.getSnapshot().viewport;
      const primaryGeometry = {
        x: start.x,
        y: start.y,
        width: event.currentTarget.offsetWidth || rect.width / zoom,
        height: event.currentTarget.offsetHeight || rect.height / zoom,
      };
      const started = beginMove(event, card.id, {
        threshold: CARD_MOVE_THRESHOLD,
        targetIds: movableIds.length > 0 ? movableIds : [card.id],
        selectionAfterStart: movableIds.length > 1 ? movableIds : [],
        placeTextCards: true,
        primaryGeometry,
      });
      if (!started) return;
      const geometries = new Map<string, ElementGeometry>();
      movableIds.forEach((id) => {
        const target = p().gestureElement(id, true);
        if (target) geometries.set(id, id === card.id ? primaryGeometry : target.geometry);
      });
      p().cardDrags.begin({
        pointerId: event.pointerId,
        primaryId: card.id,
        draggedIds: movableIds,
        cards: [...scene.textCards],
        containers: scene.containers.filter(p().isFrameVisible),
        textBlocks: scene.textBlocks.filter(p().isFrameVisible),
        geometries,
        startScreen: { x: event.clientX, y: event.clientY },
        startWorld: p().canvasPoint(event),
        scrollOffsets: p().containerScrollOffsets(),
      });
    },

    /** Frames resize down to the minimum size and up to the canvas edge. */
    resizeFrame(event: PointerEvent<HTMLButtonElement>, frame: Frame) {
      const canvas = p().canvasSize();
      const kind = p()
        .scene()
        .containers.some(({ id }) => id === frame.id)
        ? "container"
        : "text-block";
      beginResize(event, frame.id, kind, {
        minimum: { width: MIN_WIDTH, height: MIN_HEIGHT },
        maximum: { width: canvas.width - frame.x, height: canvas.height - frame.y },
      });
    },
    /** Images keep their aspect ratio between the minimum size and the canvas edge. */
    resizeImage(event: PointerEvent<HTMLButtonElement>, image: ImageElement) {
      const canvas = p().canvasSize();
      const aspectRatio = image.height > 0 ? image.width / image.height : 1;
      beginResize(event, image.id, "image", {
        minimum: { width: MIN_IMAGE_SIZE, height: MIN_IMAGE_SIZE / aspectRatio },
        maximum: {
          width: Math.min(canvas.width - image.x, (canvas.height - image.y) * aspectRatio),
          height: canvas.height - image.y,
        },
        aspectRatio,
      });
    },
  };
}
