import type { Glass, Group, Html } from "@liquid-dom/core";
import { BENCHMARK_CARD_SLOT_TRANSITION_MS } from "./benchmarkCanvasCardInteraction";
import { BENCHMARK_CANVAS_BROWSER } from "./benchmarkCanvasBrowserLayout";

interface GeometryRecord {
  readonly group: Group;
  readonly glass: Glass;
  readonly content: Html;
  readonly host: HTMLDivElement;
}

export interface LiquidCanvasCardRecord extends GeometryRecord {
  readonly id: number;
  readonly host: HTMLDivElement;
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
      } else {
        this.animations.delete(id);
        if (record.group.y !== target) {
          record.group.y = target;
          this.syncCount += 1;
        }
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
    order.forEach((id) => {
      if (id === excludedId) return;
      const record = records.get(id);
      if (!record) return;
      const top = record.group.y - scrollTop;
      const clippedTop = Math.max(top, bodyTop);
      const clippedBottom = Math.min(top + BENCHMARK_CANVAS_BROWSER.cardHeight, bodyBottom);
      const visibleHeight = Math.max(0, clippedBottom - clippedTop);
      const clipOffset = visibleHeight > 0 ? clippedTop - top : 0;
      const width = visibleHeight > 0 ? cardWidth : 0;

      if (record.glass.y !== clipOffset) record.glass.y = clipOffset;
      if (record.glass.width !== width) record.glass.width = width;
      if (record.glass.height !== visibleHeight) record.glass.height = visibleHeight;
      if (record.content.y !== 0) record.content.y = 0;
      if (record.content.width !== width) record.content.width = width;
      if (record.content.height !== visibleHeight) record.content.height = visibleHeight;
      record.host.style.transform = clipOffset === 0 ? "" : `translate3d(0, ${-clipOffset}px, 0)`;
    });
  }

  resetFullCardViewport(record: GeometryRecord, cardWidth: number) {
    record.glass.width = cardWidth;
    record.glass.height = BENCHMARK_CANVAS_BROWSER.cardHeight;
    record.content.x = 0;
    record.content.y = 0;
    record.content.width = cardWidth;
    record.content.height = BENCHMARK_CANVAS_BROWSER.cardHeight;
    record.host.style.transform = "";
  }

  cancel(id: number) {
    this.animations.delete(id);
  }

  settle(order: readonly number[], records: ReadonlyMap<number, GeometryRecord>, bodyTop: number) {
    this.animations.clear();
    order.forEach((id, index) => {
      const record = records.get(id);
      if (!record) return;
      record.group.x = BENCHMARK_CANVAS_BROWSER.x + BENCHMARK_CANVAS_BROWSER.cardInset;
      record.group.y = bodyTop + index * this.slotSize;
    });
  }

  tick(now: number, records: ReadonlyMap<number, GeometryRecord>) {
    let changed = false;
    for (const [id, animation] of this.animations) {
      const record = records.get(id);
      if (!record) {
        this.animations.delete(id);
        continue;
      }
      const progress = Math.min(1, (now - animation.startedAt) / BENCHMARK_CARD_SLOT_TRANSITION_MS);
      record.group.y = animation.from + (animation.to - animation.from) * easeOutQuart(progress);
      this.syncCount += 1;
      changed = true;
      if (progress === 1) this.animations.delete(id);
    }
    return changed;
  }
}

const easeOutQuart = (progress: number) => 1 - (1 - progress) ** 4;
