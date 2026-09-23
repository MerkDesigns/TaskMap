import type { MaterialRectangle } from "../../materials/materialSamplingBoundary";
import type { SharedSmallGlassShape } from "../../materials/SharedSmallGlassPlane";

/** Intersect visibility, never resize or re-round the material's original geometry. */
export function glassListShape(
  card: SharedSmallGlassShape,
  ...viewports: readonly MaterialRectangle[]
): SharedSmallGlassShape | null {
  let left = card.x;
  let top = card.y;
  let right = left + card.width;
  let bottom = top + card.height;
  for (const viewport of viewports) {
    left = Math.max(left, viewport.left);
    top = Math.max(top, viewport.top);
    right = Math.min(right, viewport.left + viewport.width);
    bottom = Math.min(bottom, viewport.top + viewport.height);
  }
  if (right <= left || bottom <= top) return null;
  return { ...card, clip: { left, top, width: right - left, height: bottom - top } };
}

/** External effects use a rectangular list boundary, independent of the rounded content mask. */
export function writeGlassListEffectsClip(
  host: HTMLElement,
  top: number,
  height: number,
  viewportHeight: number,
) {
  host.style.setProperty("--taskmap-glass-list-clip-top", `${-top}px`);
  host.style.setProperty("--taskmap-glass-list-clip-bottom", `${top + height - viewportHeight}px`);
}
