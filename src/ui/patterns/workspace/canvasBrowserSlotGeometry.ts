import { CANVAS_CARD_SLOT_TRANSITION_MS, easeOutQuart } from "./canvasBrowserInteraction";
import { CANVAS_BROWSER_LAYOUT } from "./canvasBrowserLayout";
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
  ) {
    order.forEach((id, index) => {
      const record = records.get(id);
      if (!record || id === excludedId) return;
      const target = canvasCardSlotTop(order, index, records);
      if (animate && record.y !== target) {
        this.animations.set(id, { from: record.y, to: target, startedAt: now });
      } else {
        this.animations.delete(id);
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
      if (progress === 1) this.animations.delete(id);
    }
    return changed;
  }

  settle(order: readonly Id[], records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>) {
    this.animations.clear();
    order.forEach((id, index) => {
      const record = records.get(id);
      if (record) this.write(record, canvasCardSlotTop(order, index, records));
    });
  }

  private write(record: CanvasBrowserCardRecord<Id>, y: number) {
    if (record.y === y) return;
    record.y = y;
    record.host.style.transform = `translate3d(0, ${y}px, 0)`;
  }
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
