export const BENCHMARK_CANVAS_BROWSER = Object.freeze({
  x: 16,
  y: 16,
  width: 288,
  edgeGap: 16,
  minimumHeight: 320,
  headerHeight: 58,
  cardInset: 12,
  cardHeight: 84,
  cardGap: 8,
  cornerRadius: 14,
  cardCornerRadius: 12,
});

export interface BenchmarkCanvasBrowserLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly cards: readonly BenchmarkCanvasCardLayout[];
}

export interface BenchmarkCanvasCardLayout {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly visible: boolean;
}

export function calculateCanvasBrowserLayout(
  viewportHeight: number,
  cardCount: number,
  scrollTop: number,
): BenchmarkCanvasBrowserLayout {
  const browser = BENCHMARK_CANVAS_BROWSER;
  const height = Math.max(browser.minimumHeight, viewportHeight - browser.edgeGap * 2);
  const cardWidth = browser.width - browser.cardInset * 2;
  const bodyTop = browser.y + browser.headerHeight;
  const bodyBottom = browser.y + height - browser.cardInset;
  const cards = Array.from({ length: cardCount }, (_, index) => {
    const y = bodyTop + index * (browser.cardHeight + browser.cardGap) - scrollTop;
    return {
      index,
      x: browser.x + browser.cardInset,
      y,
      width: cardWidth,
      height: browser.cardHeight,
      visible: y >= bodyTop && y + browser.cardHeight <= bodyBottom,
    };
  });
  return { x: browser.x, y: browser.y, width: browser.width, height, cards };
}

export function canvasBrowserScrollHeight(cardCount: number) {
  const { cardHeight, cardGap, cardInset } = BENCHMARK_CANVAS_BROWSER;
  return cardInset + cardCount * cardHeight + Math.max(0, cardCount - 1) * cardGap;
}

export function canvasBrowserBodyBottom(viewportHeight: number) {
  const browser = BENCHMARK_CANVAS_BROWSER;
  const height = Math.max(browser.minimumHeight, viewportHeight - browser.edgeGap * 2);
  return browser.y + height - browser.cardInset;
}
