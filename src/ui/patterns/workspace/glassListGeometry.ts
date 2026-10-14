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

/**
 * How far a scroll-edge slice of `height` narrows on each side. A slice shorter than its corners
 * can round squeezes into a pill; narrowing it by `radius - height / 2` starts the pill's straight
 * edge exactly where the card's own corners end, so a thin strip never reaches into the corner
 * area while the list scrolls. Zero once the slice is tall enough for full corners.
 */
export function glassListMorphInset(height: number, radius: number): number {
  return height > 0 && height < radius * 2 ? radius - height / 2 : 0;
}

/** A morphing shape with its visible slice narrowed as `glassListMorphInset` describes. */
export function narrowGlassListMorph(shape: SharedSmallGlassShape): SharedSmallGlassShape {
  const inset = shape.clip ? glassListMorphInset(shape.clip.height, shape.radius) : 0;
  if (!shape.clip || inset === 0) return shape;
  return {
    ...shape,
    clip: {
      ...shape.clip,
      left: shape.clip.left + inset,
      width: Math.max(0, shape.clip.width - inset * 2),
    },
  };
}
