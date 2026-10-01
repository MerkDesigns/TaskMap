import { CANVAS_CARD_SLOT_TRANSITION_MS, easeOutQuart } from "./canvasBrowserInteraction";
import { CANVAS_BROWSER_LAYOUT } from "./canvasBrowserLayout";
import type { CanvasCardHeldSpread } from "./canvasBrowserHeldLift";
import type { CanvasBrowserCardRecord } from "./canvasBrowserRuntimeTypes";

interface SlotAnimation {
  readonly from: number;
  readonly to: number;
  readonly startedAt: number;
}

export class CanvasBrowserSlotGeometry<Id extends string> {
  private readonly animations = new Map<Id, SlotAnimation>();

  isAnimating() {
    return this.animations.size > 0;
  }

  cancel(id: Id) {
    this.animations.delete(id);
  }

  position(
    order: readonly Id[],
    records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
    now: number,
    animate: boolean,
    excludedId: Id | null,
    spread: CanvasCardHeldSpread<Id> | null = null,
  ) {
    const heldIndex = spread ? order.indexOf(spread.id) : -1;
    order.forEach((id, index) => {
      const record = records.get(id);
      if (!record || id === excludedId) return;
      const target =
        canvasCardSlotTop(order, index, records) +
        canvasCardSpreadOffset(index, heldIndex, order.length, spread?.amount ?? 0);
      if (animate && record.y !== target) {
        this.animations.set(id, { from: record.y, to: target, startedAt: now });
        record.host.dataset.slotMotion = "true";
      } else {
        this.animations.delete(id);
        delete record.host.dataset.slotMotion;
        this.write(record, target);
      }
    });
  }

  tick(now: number, records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>, reducedMotion: boolean) {
    let changed = false;
    for (const [id, animation] of this.animations) {
      const record = records.get(id);
      if (!record) {
        this.animations.delete(id);
        continue;
      }
      const progress = reducedMotion
        ? 1
        : Math.min(1, (now - animation.startedAt) / CANVAS_CARD_SLOT_TRANSITION_MS);
      this.write(record, animation.from + (animation.to - animation.from) * easeOutQuart(progress));
      changed = true;
      if (progress === 1) {
        this.animations.delete(id);
        delete record.host.dataset.slotMotion;
      }
    }
    return changed;
  }

  settle(order: readonly Id[], records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>) {
    this.animations.clear();
    order.forEach((id, index) => {
      const record = records.get(id);
      if (record) {
        delete record.host.dataset.slotMotion;
        this.write(record, canvasCardSlotTop(order, index, records));
      }
    });
  }

  private write(record: CanvasBrowserCardRecord<Id>, y: number) {
    if (record.y === y) return;
    record.y = y;
  }
}

/**
 * Neighbours make room for the lifted card while the first and last cards stay put, so no card is
 * pushed past the list edge (where its rim would be clipped). Each side absorbs the push evenly:
 * the nearest card moves most, the outermost not at all, and that side's gaps stay equal.
 */
export function canvasCardSpreadOffset(
  index: number,
  heldIndex: number,
  count: number,
  amount: number,
) {
  if (heldIndex < 0 || index === heldIndex || amount === 0) return 0;
  if (index < heldIndex) return (-amount * index) / heldIndex;
  const below = count - 1 - heldIndex;
  return (amount * (count - 1 - index)) / below;
}

export function canvasCardSlotTop<Id extends string>(
  order: readonly Id[],
  index: number,
  records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
) {
  let top = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    top +=
      (records.get(order[cursor])?.height ?? CANVAS_BROWSER_LAYOUT.cardHeight) +
      CANVAS_BROWSER_LAYOUT.cardGap;
  }
  return top;
}

export function canvasCardContentHeight<Id extends string>(
  order: readonly Id[],
  records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
) {
  if (order.length === 0) return 0;
  return order.reduce(
    (height, id) => height + (records.get(id)?.height ?? CANVAS_BROWSER_LAYOUT.cardHeight),
    (order.length - 1) * CANVAS_BROWSER_LAYOUT.cardGap,
  );
}
