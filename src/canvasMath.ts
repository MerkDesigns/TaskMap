import { ALIGN_SNAP_DISTANCE, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "./constants";

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

/** Zoom steps for one wheel event: at least one per event, at most four. */
export function wheelZoomSteps(deltaY: number) {
  const rawSteps = -deltaY / 100;
  const direction = Math.sign(rawSteps);
  if (!Number.isFinite(rawSteps) || direction === 0) return 0;
  return direction * Math.min(4, Math.max(1, Math.round(Math.abs(rawSteps))));
}

/** The zoom `steps` wheel steps from `zoom`, before it is rounded to a step or clamped. */
export function zoomAfterWheelSteps(zoom: number, steps: number) {
  return zoom * (1 + ZOOM_STEP) ** steps;
}

export function getWheelZoom(currentZoom: number, deltaY: number) {
  return quantizeZoom(zoomAfterWheelSteps(currentZoom, wheelZoomSteps(deltaY)));
}

/** Clamps a zoom to the allowed range without rounding it to a step. */
export function clampZoom(value: number) {
  return clamp(Number.isFinite(value) ? value : 1, MIN_ZOOM, MAX_ZOOM);
}

type AlignmentGuide = {
  value: number;
  kind: "start" | "center" | "end";
};

export function findSnapOffset(movingGuides: AlignmentGuide[], targetGuides: AlignmentGuide[]) {
  let bestOffset = 0;
  let bestDistance = ALIGN_SNAP_DISTANCE + 1;

  movingGuides.forEach((movingGuide) => {
    targetGuides.forEach((targetGuide) => {
      if (movingGuide.kind !== targetGuide.kind) {
        return;
      }

      const offset = targetGuide.value - movingGuide.value;
      const distance = Math.abs(offset);

      if (distance < bestDistance && distance <= ALIGN_SNAP_DISTANCE) {
        bestDistance = distance;
        bestOffset = offset;
      }
    });
  });

  if (bestDistance > ALIGN_SNAP_DISTANCE) {
    return { offset: 0, guide: null, guides: [] };
  }

  const guides = Array.from(
    new Set(
      movingGuides.flatMap((movingGuide) =>
        targetGuides
          .filter(
            (targetGuide) =>
              movingGuide.kind === targetGuide.kind &&
              Math.abs(targetGuide.value - movingGuide.value - bestOffset) < 0.001,
          )
          .map((targetGuide) => targetGuide.value),
      ),
    ),
  );

  return {
    offset: bestOffset,
    guide: guides[0] ?? null,
    guides,
  };
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
