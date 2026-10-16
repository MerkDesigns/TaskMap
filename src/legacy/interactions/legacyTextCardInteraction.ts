import type { ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import type { ContainerElement, TaskCanvas, TextBlockElement, TextCardElement } from "../../types";
import {
  getLegacyTextCardActiveOffset,
  getLegacyTextCardFinalPosition,
  getLegacyTextCardPlacementDecision,
  LEGACY_TEXT_CARD_ROW_HEIGHT,
  resolveLegacyTextCardPlacement,
  type LegacyTextCardOffset,
  type LegacyTextCardPlacementDecision,
  type LegacyTextCardPlacementState,
} from "./legacyTextCardPlacement";

export {
  getLegacyTextCardDragIds,
  type LegacyTextCardPlacementDecision,
} from "./legacyTextCardPlacement";

export interface LegacyTextCardPresentation {
  readonly pointerId: number;
  readonly primaryId: string;
  readonly ids: readonly string[];
  readonly start: { x: number; y: number };
  readonly current: { x: number; y: number };
  readonly latestScreen: { x: number; y: number };
  readonly latestWorld: { x: number; y: number };
  readonly size: { width: number; height: number };
  readonly offsets: readonly LegacyTextCardOffset[];
  readonly sway: { x: number; y: number };
  readonly trueSize: boolean;
  /** Picked up over a container, so the cards gather into the stack as they are picked up. */
  readonly stackedAtPickup: boolean;
  /**
   * Shown in their original arrangement rather than stacked. It follows whether a container is
   * targeted only once that has held for a moment, so carrying the stack across the gap between
   * two containers does not flick it apart and back.
   */
  readonly spread: boolean;
  readonly startContainerId?: string;
  readonly targetContainerId: string | null;
  readonly insertionIndex: number | null;
  readonly dropPreview: ElementGeometry | null;
}

export interface LegacyTextCardRelease {
  readonly active: boolean;
  readonly cards: readonly {
    card: TextCardElement;
    from: { x: number; y: number };
    to: { x: number; y: number };
  }[];
}

export interface LegacyTextCardInteractionSnapshot {
  readonly active: LegacyTextCardPresentation | null;
  readonly release: LegacyTextCardRelease | null;
}

export interface LegacyTextCardInteractionService {
  readonly getSnapshot: () => LegacyTextCardInteractionSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly begin: (input: BeginInput) => void;
  readonly update: (input: UpdateInput) => void;
  readonly enableTrueSize: (pointerId: number) => void;
  readonly getDecision: () => LegacyTextCardPlacementDecision | null;
  /**
   * Ends the drag: the held cards settle from where they were shown to where `canvas` now has
   * them, their new places after a drop or their old ones when nothing changed.
   */
  readonly finish: (canvas: TaskCanvas) => void;
  readonly cancelActive: (pointerId: number) => void;
  readonly reset: () => void;
  readonly cancelScheduledPresentation: () => void;
}

interface BeginInput {
  readonly pointerId: number;
  readonly primaryId: string;
  readonly draggedIds: readonly string[];
  readonly cards: readonly TextCardElement[];
  readonly containers: readonly ContainerElement[];
  readonly textBlocks: readonly TextBlockElement[];
  readonly geometries: ReadonlyMap<string, ElementGeometry>;
  readonly startScreen: { x: number; y: number };
  readonly startWorld: { x: number; y: number };
  readonly scrollOffsets: Readonly<Record<string, number>>;
}

interface UpdateInput {
  readonly pointerId: number;
  readonly screen: { x: number; y: number };
  readonly world: { x: number; y: number };
  readonly primaryGeometry: ElementGeometry;
  readonly shiftKey: boolean;
}

type ActiveState = LegacyTextCardPresentation &
  LegacyTextCardPlacementState & {
    readonly cards: readonly TextCardElement[];
    readonly containers: readonly ContainerElement[];
    readonly textBlocks: readonly TextBlockElement[];
    readonly scrollOffsets: Readonly<Record<string, number>>;
    readonly pointerOffsetY: number;
    readonly lastCenterY: number;
  };

export function createLegacyTextCardInteractionService(options: {
  readonly requestFrame: (callback: () => void) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly setTimer: (callback: () => void, delay: number) => number;
  readonly clearTimer: (handle: number) => void;
}): LegacyTextCardInteractionService {
  let active: ActiveState | null = null;
  let snapshot: LegacyTextCardInteractionSnapshot = { active: null, release: null };
  const listeners = new Set<() => void>();
  let frames: number[] = [];
  let timer: number | null = null;
  let spreadTimer: number | null = null;
  const publish = (next: LegacyTextCardInteractionSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const cancelSpreadChange = () => {
    if (spreadTimer !== null) options.clearTimer(spreadTimer);
    spreadTimer = null;
  };
  /** Shows the held cards spread (or stacked) once that has been wanted for a moment. */
  const settleSpread = (spread: boolean) => {
    if (!active || active.spread === spread) {
      cancelSpreadChange();
      return;
    }
    if (spreadTimer !== null) return;
    spreadTimer = options.setTimer(() => {
      spreadTimer = null;
      if (!active || (active.targetContainerId === null) !== spread) return;
      active = { ...active, spread };
      publish({ ...snapshot, active });
    }, SPREAD_CHANGE_DELAY_MS);
  };
  const cancelScheduledPresentation = () => {
    frames.forEach(options.cancelFrame);
    frames = [];
    if (timer !== null) options.clearTimer(timer);
    timer = null;
    cancelSpreadChange();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    begin: (input) => {
      cancelScheduledPresentation();
      const primary = input.geometries.get(input.primaryId)!;
      const orderedIds = input.draggedIds.includes(input.primaryId)
        ? [...input.draggedIds]
        : [input.primaryId, ...input.draggedIds];
      const visualIds = [input.primaryId, ...orderedIds.filter((id) => id !== input.primaryId)];
      const primaryCard = input.cards.find(({ id }) => id === input.primaryId)!;
      // Held cards keep the order they were painted in: loose cards by canvas layer, a
      // container's cards by row (the order of `orderedIds`).
      const paintOrder = primaryCard.containerId
        ? orderedIds
        : [...orderedIds].sort(
            (left, right) => layerOf(input.cards, left) - layerOf(input.cards, right),
          );
      const offsets = visualIds.map((id, index) => {
        const geometry = input.geometries.get(id)!;
        return {
          id,
          x: index === 0 ? 0 : (index % 2 === 0 ? -1 : 1) * (5 + Math.min(index, 4) * 2),
          y: index === 0 ? 0 : Math.min(index, 5) * 4,
          formation: { x: geometry.x - primary.x, y: geometry.y - primary.y },
          depth: paintOrder.indexOf(id),
        };
      });
      const picked: ActiveState = {
        pointerId: input.pointerId,
        primaryId: input.primaryId,
        ids: orderedIds,
        start: { x: primary.x, y: primary.y },
        current: { x: primary.x, y: primary.y },
        latestScreen: input.startScreen,
        latestWorld: input.startWorld,
        size: { width: primary.width, height: primary.height },
        offsets,
        sway: { x: 0, y: 0 },
        trueSize: false,
        stackedAtPickup: false,
        spread: true,
        startContainerId: primaryCard.containerId,
        targetContainerId: null,
        insertionIndex: null,
        dropPreview: null,
        cards: input.cards,
        containers: input.containers,
        textBlocks: input.textBlocks,
        scrollOffsets: input.scrollOffsets,
        pointerOffsetY: input.startWorld.y - primary.y,
        lastCenterY: primary.y + LEGACY_TEXT_CARD_ROW_HEIGHT / 2,
      };
      // Resolve the slot under the pointer at once: cards picked up in a container keep their gap
      // open from the first frame instead of closing it until the pointer first moves.
      const placement = resolveLegacyTextCardPlacement(picked, input.startWorld, primary);
      active = {
        ...picked,
        stackedAtPickup: placement.targetContainerId !== null,
        spread: placement.targetContainerId === null,
        targetContainerId: placement.targetContainerId,
        insertionIndex: placement.insertionIndex,
        dropPreview: placement.dropPreview,
        lastCenterY: placement.centerY,
      };
      publish({ active, release: null });
    },
    update: (input) => {
      if (!active || active.pointerId !== input.pointerId) return;
      const placement = resolveLegacyTextCardPlacement(active, input.world, input.primaryGeometry);
      const sway = {
        x: clamp(active.sway.x * 0.55 + (input.screen.x - active.latestScreen.x) * 0.45, -14, 14),
        y: clamp(active.sway.y * 0.55 + (input.screen.y - active.latestScreen.y) * 0.45, -10, 10),
      };
      active = {
        ...active,
        current: { x: input.primaryGeometry.x, y: input.primaryGeometry.y },
        latestScreen: input.screen,
        latestWorld: input.world,
        size: { width: input.primaryGeometry.width, height: input.primaryGeometry.height },
        sway,
        trueSize: active.trueSize || input.shiftKey,
        targetContainerId: placement.targetContainerId,
        insertionIndex: placement.insertionIndex,
        dropPreview: placement.dropPreview,
        lastCenterY: placement.centerY,
      };
      settleSpread(placement.targetContainerId === null);
      publish({ ...snapshot, active });
    },
    enableTrueSize: (pointerId) => {
      if (!active || active.pointerId !== pointerId || active.trueSize) return;
      active = { ...active, trueSize: true };
      publish({ ...snapshot, active });
    },
    getDecision: () => (active ? getLegacyTextCardPlacementDecision(active) : null),
    finish: (canvas) => {
      if (!active) return;
      cancelSpreadChange();
      const current = active;
      // Cards settle from where they were shown (stacked or spread, which can lag the drop target
      // for a moment) in the order they were painted in, so none passes in front of another.
      const { spread } = current;
      const offsetOf = (id: string) => current.offsets.find((offset) => offset.id === id);
      const depthOf = (id: string) => offsetOf(id)?.depth ?? 0;
      const cards = current.ids.flatMap((id, index) => {
        const card = canvas.textCards.find((candidate) => candidate.id === id);
        const offset = offsetOf(id);
        if (!card || !offset) return [];
        const shown = getLegacyTextCardActiveOffset(offset, spread);
        const fromPosition = { x: current.current.x + shown.x, y: current.current.y + shown.y };
        const swaying = index > 0 && !spread;
        const factor = 0.18 + Math.min(index, 5) * 0.04;
        return [
          {
            card,
            from: {
              x: fromPosition.x + (swaying ? current.sway.x * factor : 0),
              y:
                fromPosition.y +
                (swaying ? Math.abs(current.sway.x) * 0.08 + current.sway.y * 0.12 : 0),
            },
            to: getLegacyTextCardFinalPosition(canvas, card, current.scrollOffsets),
          },
        ];
      });
      cards.sort((left, right) => depthOf(left.card.id) - depthOf(right.card.id));
      active = null;
      // Nothing to settle (a click on a single card): the cards are already where they belong,
      // and no settling overlay should sit over a card about to be clicked again.
      const moving = cards.some(
        ({ from, to }) => Math.abs(from.x - to.x) > 0.5 || Math.abs(from.y - to.y) > 0.5,
      );
      if (!moving) {
        publish({ active: null, release: null });
        return;
      }
      publish({ active: null, release: { active: false, cards } });
      frames.push(
        options.requestFrame(() => {
          frames.push(
            options.requestFrame(() => publish({ active: null, release: { active: true, cards } })),
          );
        }),
      );
      timer = options.setTimer(() => {
        timer = null;
        frames = [];
        publish({ active: null, release: null });
      }, 240);
    },
    cancelActive: (pointerId) => {
      if (active?.pointerId !== pointerId) return;
      cancelSpreadChange();
      active = null;
      publish({ ...snapshot, active: null });
    },
    reset: () => {
      cancelScheduledPresentation();
      active = null;
      publish({ active: null, release: null });
    },
    cancelScheduledPresentation,
  };
}

/**
 * The card-drag snapshot as everything but the held-card overlay reads it: it keeps its identity
 * while pointer moves only carry the held cards along, and changes when a drag starts or ends, its
 * cards, target slot or size change, or a release plays. The overlay follows the motion itself.
 */
export function createLegacyTextCardStructureSelector(
  service: Pick<LegacyTextCardInteractionService, "getSnapshot">,
): () => LegacyTextCardInteractionSnapshot {
  let previous = service.getSnapshot();
  return () => {
    const next = service.getSnapshot();
    if (next.release !== previous.release || structureChanged(previous.active, next.active)) {
      previous = next;
    }
    return previous;
  };
}

function structureChanged(
  previous: LegacyTextCardPresentation | null,
  next: LegacyTextCardPresentation | null,
): boolean {
  if (previous === next) return false;
  if (!previous || !next) return true;
  return (
    previous.pointerId !== next.pointerId ||
    previous.primaryId !== next.primaryId ||
    previous.ids !== next.ids ||
    previous.offsets !== next.offsets ||
    previous.targetContainerId !== next.targetContainerId ||
    previous.insertionIndex !== next.insertionIndex ||
    previous.trueSize !== next.trueSize
  );
}

/** How long held cards wait before gathering into the stack or spreading back out. */
const SPREAD_CHANGE_DELAY_MS = 150;

const layerOf = (cards: readonly TextCardElement[], id: string) =>
  cards.find((card) => card.id === id)?.layer ?? 0;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));
