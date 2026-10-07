import type { CSSProperties } from "react";
import type { SnapGuide } from "../app/interactions/canvasInteractionTypes";

/** A guide fades out this far either side of the pointer, so long guides stay quiet. */
const GUIDE_REACH = 260;
const GUIDE_DASHES = "rgba(45, 216, 200, 0.48) 0 6px, transparent 6px 13px";
const GUIDE_THICKNESS = "calc(2px * var(--taskmap-camera-inverse-zoom, 1))";

function guideStyle(guide: SnapGuide, canvasWidth: number, canvasHeight: number): CSSProperties {
  const vertical = guide.axis === "x";
  const length = vertical ? canvasHeight : canvasWidth;
  const direction = vertical ? "to bottom" : "to right";
  const mask = `linear-gradient(${direction}, transparent 0, black ${Math.max(
    guide.pointerPosition - GUIDE_REACH,
    0,
  )}px, black ${Math.min(guide.pointerPosition + GUIDE_REACH, length)}px, transparent 100%)`;
  const fade = {
    backgroundImage: `repeating-linear-gradient(${direction}, ${GUIDE_DASHES})`,
    maskImage: mask,
    WebkitMaskImage: mask,
  };
  return vertical
    ? {
        left: guide.position,
        top: 0,
        width: GUIDE_THICKNESS,
        height: canvasHeight,
        transform: "translateX(-50%)",
        ...fade,
      }
    : {
        left: 0,
        top: guide.position,
        width: canvasWidth,
        height: GUIDE_THICKNESS,
        transform: "translateY(-50%)",
        ...fade,
      };
}

/** The dashed alignment guides a move snaps to, drawn across the canvas in canvas units. */
export function CanvasSnapGuides({
  guides,
  canvasWidth,
  canvasHeight,
}: {
  readonly guides: readonly SnapGuide[];
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}) {
  return guides.map((guide) => (
    <div
      key={`${guide.axis}-${guide.position}`}
      className="pointer-events-none absolute z-0"
      style={guideStyle(guide, canvasWidth, canvasHeight)}
    />
  ));
}
