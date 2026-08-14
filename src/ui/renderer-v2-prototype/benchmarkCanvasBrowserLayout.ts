export const BENCHMARK_CANVAS_BROWSER = Object.freeze({
  x: 16,
  y: 16,
  width: 288,
  edgeGap: 16,
  headerHeight: 58,
  cardInset: 12,
  cardHeight: 84,
  cardGap: 10,
  cornerRadius: 23,
  cardCornerRadius: 13,
});

export interface BenchmarkCanvasCardPresentation {
  readonly previewInset: number;
  readonly previewRatioPercent: number;
  readonly previewCornerRadius: number;
  readonly largeTextSize: number;
  readonly smallTextSize: number;
  readonly largeText: string;
  readonly smallText: string;
  readonly optionsRightGap: number;
}

export const DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION: BenchmarkCanvasCardPresentation =
  Object.freeze({
    previewInset: 7,
    previewRatioPercent: 90,
    previewCornerRadius: 8,
    largeTextSize: 14,
    smallTextSize: 11,
    largeText: "Canvas {number}",
    smallText: "{status} canvas",
    optionsRightGap: 11,
  });

export function canvasCardPreviewAspectRatio(percent: number) {
  const progress = Math.min(100, Math.max(0, percent)) / 100;
  const minimum = 4 / 3;
  const maximum = 16 / 9;
  return minimum + (maximum - minimum) * progress;
}

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
  cardGap: number = BENCHMARK_CANVAS_BROWSER.cardGap,
): BenchmarkCanvasBrowserLayout {
  const browser = BENCHMARK_CANVAS_BROWSER;
  const height = canvasBrowserHeight(viewportHeight, cardCount, cardGap);
  const cardWidth = browser.width - browser.cardInset * 2;
  const bodyTop = browser.y + browser.headerHeight;
  const bodyBottom = browser.y + height - browser.cardInset;
  const cards = Array.from({ length: cardCount }, (_, index) => {
    const y = bodyTop + index * (browser.cardHeight + cardGap) - scrollTop;
    return {
      index,
      x: browser.x + browser.cardInset,
      y,
      width: cardWidth,
      height: browser.cardHeight,
      visible: y < bodyBottom && y + browser.cardHeight > bodyTop,
    };
  });
  return { x: browser.x, y: browser.y, width: browser.width, height, cards };
}

export function canvasBrowserScrollHeight(
  cardCount: number,
  cardGap: number = BENCHMARK_CANVAS_BROWSER.cardGap,
) {
  const { cardHeight } = BENCHMARK_CANVAS_BROWSER;
  return cardCount * cardHeight + Math.max(0, cardCount - 1) * cardGap;
}

export function canvasBrowserBodyBottom(
  viewportHeight: number,
  cardCount: number,
  cardGap: number = BENCHMARK_CANVAS_BROWSER.cardGap,
) {
  const browser = BENCHMARK_CANVAS_BROWSER;
  const height = canvasBrowserHeight(viewportHeight, cardCount, cardGap);
  return browser.y + height - browser.cardInset;
}

export function canvasBrowserHeight(
  viewportHeight: number,
  cardCount: number,
  cardGap: number = BENCHMARK_CANVAS_BROWSER.cardGap,
) {
  const browser = BENCHMARK_CANVAS_BROWSER;
  const contentHeight =
    browser.headerHeight + browser.cardInset + canvasBrowserScrollHeight(cardCount, cardGap);
  const maximumHeight = Math.max(browser.headerHeight, viewportHeight - browser.edgeGap * 2);
  return Math.min(contentHeight, maximumHeight);
}
