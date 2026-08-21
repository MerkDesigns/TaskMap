export const CANVAS_BROWSER_LAYOUT = Object.freeze({
  x: 16,
  y: 64,
  width: 288,
  edgeGap: 16,
  headerHeight: 58,
  cardInset: 12,
  cardWidth: 264,
  cardHeight: 84,
  compactCardHeight: 40,
  cardGap: 10,
  largeRadius: 23,
  smallRadius: 13.5,
  previewInset: 9,
  previewAspectRatio: 1.7333333333333334,
  previewHeight: 66,
  previewWidth: 114.4,
  previewRadius: 8,
  titleFontSize: 14,
  subtitleFontSize: 11,
  optionsRightGap: 11,
  selectedMarkerHeight: 22,
});

export function canvasBrowserScrollHeight(cardHeights: readonly number[]) {
  return (
    cardHeights.reduce((total, height) => total + height, 0) +
    Math.max(0, cardHeights.length - 1) * CANVAS_BROWSER_LAYOUT.cardGap
  );
}

export function canvasBrowserPanelHeight(scrollHeight: number) {
  return CANVAS_BROWSER_LAYOUT.headerHeight + scrollHeight + CANVAS_BROWSER_LAYOUT.cardInset;
}
