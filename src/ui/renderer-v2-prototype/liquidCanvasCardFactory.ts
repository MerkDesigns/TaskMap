import {
  BENCHMARK_CANVAS_BROWSER,
  calculateCanvasBrowserLayout,
} from "./benchmarkCanvasBrowserLayout";
import type { LiquidCanvasCardRecord } from "./liquidCanvasCardGeometry";
import type { CanvasBrowserItemId } from "./liquidCanvasBrowserTypes";

type CardGroup = LiquidCanvasCardRecord["group"];
type CardGlass = LiquidCanvasCardRecord["glass"];
type CardHtml = LiquidCanvasCardRecord["content"];
type BrowserSurfaceGlass = Pick<CardGlass, "x" | "y" | "width" | "height" | "cornerRadius">;
type BrowserSurfaceHtml = Pick<CardHtml, "width" | "height">;

export interface LiquidCanvasCardFactories {
  createGroup: () => CardGroup;
  createGlass: (options: Record<string, number | boolean>) => CardGlass;
  createHtml: (host: HTMLDivElement) => CardHtml;
}

export interface LiquidCanvasCardLifecycle<Id extends string = CanvasBrowserItemId> {
  added(record: LiquidCanvasCardRecord<Id>): void;
  removing(record: LiquidCanvasCardRecord<Id>): void;
}

export function removeLiquidCanvasCardRecords<Id extends string = CanvasBrowserItemId>(
  cards: ReadonlyMap<Id, LiquidCanvasCardRecord<Id>>,
  lifecycle: LiquidCanvasCardLifecycle<Id>,
) {
  cards.forEach((record) => {
    lifecycle.removing(record);
    const { content, glass, group } = record;
    content.remove();
    glass.remove();
    group.remove();
  });
}

export function reconcileLiquidCanvasCardRecords<Id extends string = CanvasBrowserItemId>(
  cards: Map<Id, LiquidCanvasCardRecord<Id>>,
  order: readonly Id[],
  scrollGroup: CardGroup,
  cardWidth: number,
  lifecycle: LiquidCanvasCardLifecycle<Id>,
  factories: LiquidCanvasCardFactories,
) {
  let changed = false;
  const ids = new Set(order);
  for (const [id, record] of cards) {
    if (ids.has(id)) continue;
    record.content.remove();
    record.glass.remove();
    record.group.remove();
    lifecycle.removing(record);
    cards.delete(id);
    changed = true;
  }
  for (const id of order) {
    if (cards.has(id)) continue;
    const record = createLiquidCanvasCard(
      scrollGroup,
      id,
      cardWidth,
      factories.createGroup,
      factories.createGlass,
      factories.createHtml,
    );
    cards.set(id, record);
    lifecycle.added(record);
    changed = true;
  }
  return changed;
}

export function createLiquidCanvasCard<Id extends string = CanvasBrowserItemId>(
  scrollGroup: CardGroup,
  id: Id,
  cardWidth: number,
  createGroup: () => CardGroup,
  createGlass: (options: Record<string, number | boolean>) => CardGlass,
  createHtml: (host: HTMLDivElement) => CardHtml,
): LiquidCanvasCardRecord<Id> {
  const group = scrollGroup.add(createGroup());
  const glass = group.add(
    createGlass({
      width: cardWidth,
      height: BENCHMARK_CANVAS_BROWSER.cardHeight,
      cornerRadius: BENCHMARK_CANVAS_BROWSER.cardCornerRadius,
      cornerSmoothing: 0,
      pointerEvents: false,
    }),
  );
  const host = document.createElement("div");
  host.className = "renderer-benchmark__canvas-card-host";
  host.style.width = `${cardWidth}px`;
  host.style.height = `${BENCHMARK_CANVAS_BROWSER.cardHeight}px`;
  const content = glass.add(createHtml(host));
  content.width = cardWidth;
  content.height = BENCHMARK_CANVAS_BROWSER.cardHeight;
  return {
    id,
    group,
    glass,
    content,
    host,
  };
}

export function resizeLiquidCanvasBrowserSurface(
  glass: BrowserSurfaceGlass,
  content: BrowserSurfaceHtml,
  viewportHeight: number,
  cardCount: number,
  cardGap: number = BENCHMARK_CANVAS_BROWSER.cardGap,
  cornerRadius: number = BENCHMARK_CANVAS_BROWSER.cornerRadius,
) {
  const layout = calculateCanvasBrowserLayout(viewportHeight, cardCount, 0, cardGap);
  Object.assign(glass, {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    cornerRadius,
  });
  content.width = layout.width;
  content.height = layout.height;
}
