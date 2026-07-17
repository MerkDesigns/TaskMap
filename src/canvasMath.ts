import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "./constants";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function quantizeZoom(value: number) {
  const step = clamp(
    Math.round(value / ZOOM_STEP),
    Math.ceil(MIN_ZOOM / ZOOM_STEP),
    Math.floor(MAX_ZOOM / ZOOM_STEP),
  );
  return Number((step * ZOOM_STEP).toFixed(10));
}

export function getWheelZoom(currentZoom: number, deltaY: number) {
  const wheelNotch = 100;
  const rawSteps = -deltaY / wheelNotch;
  const direction = Math.sign(rawSteps);
  if (direction === 0) {
    return quantizeZoom(currentZoom);
  }

  const steps = direction * Math.min(4, Math.max(1, Math.round(Math.abs(rawSteps))));
  return quantizeZoom(currentZoom + ZOOM_STEP * steps);
}

type VirtualRowRangeOptions = {
  rowCount: number;
  rowHeight: number;
  rowGap: number;
  padding: number;
  scrollOffset: number;
  viewportHeight: number;
  overscanRows?: number;
};

export type VirtualRowRange = {
  startIndex: number;
  endIndex: number;
};

export function getVirtualRowRange({
  rowCount,
  rowHeight,
  rowGap,
  padding,
  scrollOffset,
  viewportHeight,
  overscanRows = 0,
}: VirtualRowRangeOptions): VirtualRowRange {
  const count = Math.max(0, Math.floor(rowCount));
  const stride = rowHeight + rowGap;
  if (count === 0 || rowHeight <= 0 || stride <= 0 || viewportHeight <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  const viewportStart = Math.max(0, scrollOffset);
  const viewportEnd = viewportStart + viewportHeight;
  const overscan = Math.max(0, Math.floor(overscanRows));
  const firstVisibleIndex = Math.floor((viewportStart - padding - rowHeight) / stride) + 1;
  const visibleEndIndex = Math.ceil((viewportEnd - padding) / stride);

  return {
    startIndex: clamp(firstVisibleIndex - overscan, 0, count),
    endIndex: clamp(visibleEndIndex + overscan, 0, count),
  };
}

export function isVirtualRowInRange(
  rowIndex: number,
  range: VirtualRowRange,
  renderedIndexOffset = 0,
) {
  const renderedIndex = rowIndex + renderedIndexOffset;
  return renderedIndex >= range.startIndex && renderedIndex < range.endIndex;
}
