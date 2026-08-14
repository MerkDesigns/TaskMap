import {
  BENCHMARK_CANVAS_BROWSER,
  calculateCanvasBrowserLayout,
} from "./benchmarkCanvasBrowserLayout";
import type { LiquidCanvasCardRecord } from "./liquidCanvasCardGeometry";
import type { CanvasCardDiagnosticPresentation } from "./canvasCardDiagnosticPresentation";

type CardGroup = LiquidCanvasCardRecord["group"];
type CardGlass = LiquidCanvasCardRecord["glass"];
type CardHtml = LiquidCanvasCardRecord["content"];

export interface LiquidCanvasCardFactories {
  createGroup: () => CardGroup;
  createGlass: (options: Record<string, number | boolean>) => CardGlass;
  createHtml: (host: HTMLDivElement) => CardHtml;
}

export function reconcileLiquidCanvasCardRecords(
  cards: Map<number, LiquidCanvasCardRecord>,
  order: readonly number[],
  scrollGroup: CardGroup,
  cardWidth: number,
  diagnostic: CanvasCardDiagnosticPresentation,
  factories: LiquidCanvasCardFactories,
) {
  let changed = false;
  const ids = new Set(order);
  for (const [id, record] of cards) {
    if (ids.has(id)) continue;
    record.content.remove();
    record.glass.remove();
    record.group.remove();
    diagnostic.remove(id);
    cards.delete(id);
    changed = true;
  }
  for (const id of order) {
    if (cards.has(id)) continue;
    cards.set(
      id,
      createLiquidCanvasCard(
        scrollGroup,
        id,
        cardWidth,
        factories.createGroup,
        factories.createGlass,
        factories.createHtml,
      ),
    );
    diagnostic.add(id);
    changed = true;
  }
  return changed;
}

export function createLiquidCanvasCard(
  scrollGroup: CardGroup,
  id: number,
  cardWidth: number,
  createGroup: () => CardGroup,
  createGlass: (options: Record<string, number | boolean>) => CardGlass,
  createHtml: (host: HTMLDivElement) => CardHtml,
): LiquidCanvasCardRecord {
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
    contentDirect: false,
  };
}

export function resizeLiquidCanvasBrowserSurface(
  glass: CardGlass,
  content: CardHtml,
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
