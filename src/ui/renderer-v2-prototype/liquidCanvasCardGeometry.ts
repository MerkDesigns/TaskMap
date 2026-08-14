import type { Glass, Group, Html } from "@liquid-dom/core";
import { BENCHMARK_CARD_SLOT_TRANSITION_MS } from "./benchmarkCanvasCardInteraction";
import { BENCHMARK_CANVAS_BROWSER } from "./benchmarkCanvasBrowserLayout";

const OFFSCREEN_CAPTURE_Y = -100_000;

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
  slotSize = BENCHMARK_CANVAS_BROWSER.cardHeight + BENCHMARK_CANVAS_BROWSER.cardGap;
  private readonly animations = new Map<number, SlotAnimation>();
  syncCount = 0;

  resetSyncCount() {
    this.syncCount = 0;
  }

  setCardGap(cardGap: number) {
    this.slotSize = BENCHMARK_CANVAS_BROWSER.cardHeight + cardGap;
  }

  isAnimating() {
    return this.animations.size > 0;
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
      const visible = visibleHeight > 0;

      // Keep the full-size Html registered in Liquid's shared content atlas. Zero-sized Glass
      // geometry removes the entry and makes the next visible card repack and recopy the atlas.
      // Counter-positioning makes offscreen capture-host transforms stable as Scroll Group moves.
      const glassHeight = visible ? visibleHeight : BENCHMARK_CANVAS_BROWSER.cardHeight;
      const glassY = visible ? clipOffset : scrollTop - record.group.y + OFFSCREEN_CAPTURE_Y;
      if (record.glass.y !== glassY) record.glass.y = glassY;
      if (record.glass.width !== cardWidth) record.glass.width = cardWidth;
      if (record.glass.height !== glassHeight) record.glass.height = glassHeight;
      // Liquid's Glass shader masks its child Html texture. Keep the capture full-size and offset
      // it in scene space so partial cards crop on the GPU without dirtying DOM capture geometry.
      const contentY = -clipOffset;
      if (record.content.y !== contentY) record.content.y = contentY;
    });
  }

  resetFullCardViewport(record: GeometryRecord, cardWidth: number) {
    record.glass.y = 0;
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

export const easeOutQuart = (progress: number) => 1 - (1 - progress) ** 4;
