import type { Glass, Group } from "@liquid-dom/core";
import { BENCHMARK_CARD_SLOT_TRANSITION_MS } from "./benchmarkCanvasCardInteraction";
import { BENCHMARK_CANVAS_BROWSER } from "./benchmarkCanvasBrowserLayout";

interface GeometryRecord {
  readonly group: Group;
  readonly glass: Glass;
}

interface SlotAnimation {
  readonly from: number;
  readonly to: number;
  readonly startedAt: number;
}

export class LiquidCanvasCardGeometry {
  readonly slotSize = BENCHMARK_CANVAS_BROWSER.cardHeight + BENCHMARK_CANVAS_BROWSER.cardGap;
  private readonly animations = new Map<number, SlotAnimation>();
  syncCount = 0;

  resetSyncCount() {
    this.syncCount = 0;
  }

  position(
    order: readonly number[],
    records: ReadonlyMap<number, GeometryRecord>,
    bodyTop: number,
    now: number,
    animate: boolean,
    excludedId: number | null,
  ) {
    order.forEach((id, index) => {
      const record = records.get(id);
      if (!record || id === excludedId) return;
      const target = bodyTop + index * this.slotSize;
      record.group.x = BENCHMARK_CANVAS_BROWSER.x + BENCHMARK_CANVAS_BROWSER.cardInset;
      if (animate && record.group.y !== target) {
        this.animations.set(id, { from: record.group.y, to: target, startedAt: now });
      } else if (record.group.y !== target) {
        record.group.y = target;
        this.syncCount += 1;
      }
    });
  }

  syncVisibility(
    order: readonly number[],
    records: ReadonlyMap<number, GeometryRecord>,
    bodyTop: number,
    bodyBottom: number,
    scrollTop: number,
    cardWidth: number,
    excludedId: number | null,
  ) {
    order.forEach((id, index) => {
      if (id === excludedId) return;
      const record = records.get(id);
      if (!record) return;
      const top = bodyTop + index * this.slotSize - scrollTop;
      const visible = top >= bodyTop && top + BENCHMARK_CANVAS_BROWSER.cardHeight <= bodyBottom;
      const width = visible ? cardWidth : 0;
      if (record.glass.width !== width) record.glass.width = width;
    });
  }

  tick(now: number, records: ReadonlyMap<number, GeometryRecord>) {
    for (const [id, animation] of this.animations) {
      const record = records.get(id);
      if (!record) continue;
      const progress = Math.min(1, (now - animation.startedAt) / BENCHMARK_CARD_SLOT_TRANSITION_MS);
      record.group.y = animation.from + (animation.to - animation.from) * easeOutQuart(progress);
      this.syncCount += 1;
      if (progress === 1) this.animations.delete(id);
    }
  }
}

const easeOutQuart = (progress: number) => 1 - (1 - progress) ** 4;
