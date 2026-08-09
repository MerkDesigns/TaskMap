import type { CanvasRectangle } from "../../canvas/geometry/canvasGeometry";
import type { BackdropPrimitive } from "../../ui/materials/compositor/backdropScene";
import type { ContainerElement, TextBlockElement } from "../../types";

const BODY_FILL = "#1b1b1e";
const OUTER_RADIUS = 12;
const INNER_RADIUS = 10;
const BORDER_WIDTH = 2;
const CONTAINER_HEADER_HEIGHT = 48;
const CONTAINER_SEARCH_HEIGHT = 42;
const TEXT_BLOCK_HEADER_HEIGHT = 40;

export function projectLegacyContainerPrimitives(
  container: ContainerElement,
): readonly BackdropPrimitive[] {
  return panelPrimitives(container, container.accent, getLegacyContainerHeaderHeight(container));
}

export function getLegacyContainerHeaderHeight(container: ContainerElement): number {
  return CONTAINER_HEADER_HEIGHT + (container.extensions?.search ? CONTAINER_SEARCH_HEIGHT : 0);
}

export function projectLegacyTextBlockPrimitives(
  block: TextBlockElement,
): readonly BackdropPrimitive[] {
  return panelPrimitives(block, block.accent, TEXT_BLOCK_HEADER_HEIGHT);
}

function panelPrimitives(
  bounds: CanvasRectangle,
  accent: string,
  requestedHeaderHeight: number,
): readonly BackdropPrimitive[] {
  const body = rounded(bounds, BODY_FILL, OUTER_RADIUS, {
    color: accent,
    widthWorld: BORDER_WIDTH,
  });
  const inner = {
    x: bounds.x + BORDER_WIDTH,
    y: bounds.y + BORDER_WIDTH,
    width: Math.max(0, bounds.width - BORDER_WIDTH * 2),
    height: Math.max(0, bounds.height - BORDER_WIDTH * 2),
  };
  const headerHeight = Math.min(requestedHeaderHeight, inner.height);
  if (inner.width <= 0 || headerHeight <= 0) return [body];
  const top = rounded(
    { ...inner, height: headerHeight },
    accent,
    Math.min(INNER_RADIUS, headerHeight / 2),
    null,
  );
  const squareFillHeight = Math.max(0, headerHeight - INNER_RADIUS);
  return squareFillHeight > 0
    ? [
        body,
        top,
        {
          kind: "filled-rectangle",
          bounds: {
            x: inner.x,
            y: inner.y + INNER_RADIUS,
            width: inner.width,
            height: squareFillHeight,
          },
          fill: accent,
          stroke: null,
        },
      ]
    : [body, top];
}

function rounded(
  bounds: CanvasRectangle,
  fill: string,
  radiusWorld: number,
  stroke: { readonly color: string; readonly widthWorld: number } | null,
): BackdropPrimitive {
  return { kind: "filled-rounded-rectangle", bounds, radiusWorld, fill, stroke };
}
