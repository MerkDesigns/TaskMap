import type { ElementGeometry } from "../../canvas/geometry/canvasGeometry";
import type { ContainerElement, TaskCanvas, TextBlockElement, TextCardElement } from "../../types";
import {
  getLegacyTextCardFinalPosition,
  getLegacyTextCardPlacementDecision,
  LEGACY_TEXT_CARD_ROW_HEIGHT,
  resolveLegacyTextCardPlacement,
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
  readonly offsets: readonly {
    id: string;
    x: number;
    y: number;
    pickupX: number;
    pickupY: number;
  }[];
  readonly sway: { x: number; y: number };
  readonly trueSize: boolean;
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
  readonly finishCommitted: (canvas: TaskCanvas) => void;
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
  const publish = (next: LegacyTextCardInteractionSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const cancelScheduledPresentation = () => {
    frames.forEach(options.cancelFrame);
    frames = [];
    if (timer !== null) options.clearTimer(timer);
    timer = null;
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
      const offsets = visualIds.map((id, index) => {
        const geometry = input.geometries.get(id)!;
        const x = index === 0 ? 0 : (index % 2 === 0 ? -1 : 1) * (5 + Math.min(index, 4) * 2);
        const y = index === 0 ? 0 : Math.min(index, 5) * 4;
        return {
          id,
          x,
          y,
          pickupX: geometry.x - (primary.x + x),
          pickupY: geometry.y - (primary.y + y),
        };
      });
      const primaryCard = input.cards.find(({ id }) => id === input.primaryId)!;
      active = {
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
        startContainerId: primaryCard.containerId,
        targetContainerId: null,
        insertionIndex: null,
        dropPreview: null,
        cards: input.cards,
        containers: input.containers,
        textBlocks: input.textBlocks,
        scrollOffsets: input.scrollOffsets,
        pointerOffsetY: input.startWorld.y - primary.y,
        lastCenterY:
          input.startWorld.y - (input.startWorld.y - primary.y) + LEGACY_TEXT_CARD_ROW_HEIGHT / 2,
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
      publish({ ...snapshot, active });
    },
    enableTrueSize: (pointerId) => {
      if (!active || active.pointerId !== pointerId || active.trueSize) return;
      active = { ...active, trueSize: true };
      publish({ ...snapshot, active });
    },
    getDecision: () => (active ? getLegacyTextCardPlacementDecision(active) : null),
    finishCommitted: (canvas) => {
      if (!active) return;
      const current = active;
      const placement = getLegacyTextCardPlacementDecision(current);
      const positions = new Map(
        placement.loosePositions.map((position) => [position.id, position]),
      );
      const cards = current.ids.flatMap((id, index) => {
        const card = canvas.textCards.find((candidate) => candidate.id === id);
        const fromPosition = positions.get(id);
        if (!card || !fromPosition) return [];
        const factor = 0.18 + Math.min(index, 5) * 0.04;
        return [
          {
            card,
            from: {
              x: fromPosition.x + (index > 0 ? current.sway.x * factor : 0),
              y:
                fromPosition.y +
                (index > 0 ? Math.abs(current.sway.x) * 0.08 + current.sway.y * 0.12 : 0),
            },
            to: getLegacyTextCardFinalPosition(canvas, card, current.scrollOffsets),
          },
        ];
      });
      active = null;
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

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));
