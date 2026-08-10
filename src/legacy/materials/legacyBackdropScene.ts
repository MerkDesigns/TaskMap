import { rectanglesIntersect, type CanvasRectangle } from "../../canvas/geometry/canvasGeometry";
import {
  MAX_BACKDROP_PRIMITIVES,
  type BackdropPrimitive,
  type BackdropScene,
} from "../../ui/materials/compositor/backdropScene";
import { parseBackdropScene } from "../../ui/materials/compositor/backdropSceneValidation";
import { formatWorkspaceRgb, WORKSPACE_VISUAL_VALUES } from "../../ui/theme/workspaceVisualValues";
import type { CanvasGridStyle, ContainerElement, TaskCanvas, TextCardElement } from "../../types";
import { getLegacyVisibleContainerTextCardPlacements } from "../interactions/legacyTextCardPlacement";
import {
  getLegacyContainerHeaderHeight,
  projectLegacyContainerPrimitives,
  projectLegacyTextBlockPrimitives,
} from "./legacyBackdropPanelPrimitives";

const PANEL_BODY_FILL = "#1b1b1e";
const CONTAINER_CARD_PADDING = 17;

export interface LegacyTextCardPresentationSize {
  readonly width: number;
  readonly height: number;
}

export interface LegacyBackdropSceneInput {
  readonly canvas: TaskCanvas;
  readonly sceneRevision: number;
  readonly gridStyle: CanvasGridStyle;
  readonly gridOpacityPercent: number;
  readonly cacheWorldBounds: CanvasRectangle;
  readonly anchorZoom: number;
  readonly textCardSizes?: ReadonlyMap<string, LegacyTextCardPresentationSize>;
  readonly containerScrollOffsets?: Readonly<Record<string, number>>;
}

/** Transitional read-only legacy presentation projection; no persistent representation is made. */
export function projectLegacyBackdropScene(input: LegacyBackdropSceneInput): BackdropScene {
  const primitives = projectPrimitives(input);
  return parseBackdropScene({
    identity: { key: input.canvas.id, revision: input.sceneRevision },
    worldBounds: { x: 0, y: 0, width: input.canvas.width, height: input.canvas.height },
    background: {
      cacheFill: WORKSPACE_VISUAL_VALUES.voidBackground,
      worldFill: WORKSPACE_VISUAL_VALUES.canvasBackground,
      worldCornerRadius: WORKSPACE_VISUAL_VALUES.canvasCornerRadius,
    },
    grid: projectGrid(input.gridStyle, input.gridOpacityPercent, input.anchorZoom),
    primitives,
  });
}

function projectPrimitives(input: LegacyBackdropSceneInput): readonly BackdropPrimitive[] {
  const candidates: Array<
    BackdropPrimitive & { readonly layer: number; readonly sequence: number }
  > = [];
  let sequence = 0;
  const add = (primitives: readonly BackdropPrimitive[], layer = 0) => {
    if (
      candidates.length + primitives.length > MAX_BACKDROP_PRIMITIVES ||
      !primitives.some(
        (primitive) =>
          validBounds(primitive.bounds) &&
          rectanglesIntersect(input.cacheWorldBounds, primitive.bounds),
      )
    ) {
      return;
    }
    for (const primitive of primitives) {
      if (!validBounds(primitive.bounds)) continue;
      candidates.push({ ...primitive, layer, sequence });
      sequence += 1;
    }
  };
  const containedCards = groupContainedCards(input.canvas.textCards);

  for (const container of input.canvas.containers) {
    const layer = container.layer ?? 0;
    add(projectLegacyContainerPrimitives(container), layer);
    for (const placement of getLegacyVisibleContainerTextCardPlacements(
      container,
      containedCards.get(container.id) ?? [],
      input.containerScrollOffsets?.[container.id] ?? 0,
    )) {
      const bounds = clipContainedTextCard(
        containedTextCardBounds(
          placement.card,
          container,
          placement,
          input.textCardSizes?.get(placement.card.id),
        ),
        container,
      );
      if (bounds) {
        add(
          [
            rounded(bounds, PANEL_BODY_FILL, 8, {
              color: placement.card.accent,
              widthWorld: 1,
            }),
          ],
          layer,
        );
      }
    }
  }
  for (const block of input.canvas.textBlocks) {
    add(projectLegacyTextBlockPrimitives(block), block.layer);
  }
  for (const card of input.canvas.textCards) {
    if (card.containerId) continue;
    const bounds = textCardBounds(card, input.textCardSizes?.get(card.id));
    add([rounded(bounds, PANEL_BODY_FILL, 8, { color: card.accent, widthWorld: 1 })], card.layer);
  }
  for (const image of input.canvas.images) {
    if (image.containerId || image.background === false) continue;
    add([rounded(image, PANEL_BODY_FILL, 12, { color: image.accent, widthWorld: 1 })], image.layer);
  }

  candidates.sort((left, right) => left.layer - right.layer || left.sequence - right.sequence);
  return Object.freeze(
    candidates.map(({ layer: _layer, sequence: _sequence, ...primitive }) =>
      Object.freeze(primitive),
    ),
  );
}

function projectGrid(style: CanvasGridStyle, opacityPercent: number, anchorZoom: number): object {
  const opacity = clamp(opacityPercent / 100, 0, 1);
  if (style === "dots") {
    const zoomOpacity = clamp(
      (anchorZoom - WORKSPACE_VISUAL_VALUES.canvasDotOpacityFadeStart) /
        WORKSPACE_VISUAL_VALUES.canvasDotOpacityFadeSpan,
      0,
      1,
    );
    return {
      kind: "dots",
      spacingWorld: WORKSPACE_VISUAL_VALUES.canvasGridSpacingWorld,
      offsetWorld: { x: 0, y: 0 },
      color: formatWorkspaceRgb(WORKSPACE_VISUAL_VALUES.canvasDotRgb, opacity * zoomOpacity),
      radiusWorld: WORKSPACE_VISUAL_VALUES.canvasDotRadiusScreen / Math.max(anchorZoom, 0.01),
    };
  }
  return {
    kind: "lines",
    spacingWorld: WORKSPACE_VISUAL_VALUES.canvasGridSpacingWorld,
    offsetWorld: { x: 0, y: 0 },
    minorColor: formatWorkspaceRgb(
      WORKSPACE_VISUAL_VALUES.canvasLineRgb,
      opacity * WORKSPACE_VISUAL_VALUES.canvasLineMinorOpacityScale,
    ),
    majorColor: formatWorkspaceRgb(
      WORKSPACE_VISUAL_VALUES.canvasMajorLineRgb,
      opacity * WORKSPACE_VISUAL_VALUES.canvasLineMajorOpacityScale,
    ),
    majorEvery: WORKSPACE_VISUAL_VALUES.canvasGridMajorEvery,
    lineWidthWorld: 1,
  };
}

function rounded(
  bounds: CanvasRectangle,
  fill: string,
  radiusWorld: number,
  stroke: { readonly color: string; readonly widthWorld: number } | null,
): BackdropPrimitive {
  return {
    kind: "filled-rounded-rectangle",
    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    radiusWorld,
    fill,
    stroke,
  };
}

function textCardBounds(
  card: TextCardElement,
  size: LegacyTextCardPresentationSize | undefined,
): CanvasRectangle {
  if (size && size.width > 0 && size.height > 0) return { x: card.x, y: card.y, ...size };
  const lines = card.text.split("\n");
  const longest = Math.max(1, ...lines.map((line) => line.length));
  return {
    x: card.x,
    y: card.y,
    width: Math.max(44, Math.min(520, longest * 9 + 48)),
    height: card.kind === "mindmap" ? 43 + Math.max(0, lines.length - 1) * 24 : 43,
  };
}

function containedTextCardBounds(
  card: TextCardElement,
  container: ContainerElement,
  position: { readonly x: number; readonly y: number },
  size: LegacyTextCardPresentationSize | undefined,
): CanvasRectangle {
  const fallback = textCardBounds(card, size);
  return {
    x: position.x,
    y: position.y,
    width: size?.width ?? Math.max(120, container.width - CONTAINER_CARD_PADDING * 2),
    height: fallback.height,
  };
}

function groupContainedCards(
  cards: readonly TextCardElement[],
): ReadonlyMap<string, readonly TextCardElement[]> {
  const grouped = new Map<string, TextCardElement[]>();
  for (const card of cards) {
    if (!card.containerId) continue;
    const group = grouped.get(card.containerId) ?? [];
    group.push(card);
    grouped.set(card.containerId, group);
  }
  return grouped;
}

function clipContainedTextCard(
  bounds: CanvasRectangle,
  container: ContainerElement,
): CanvasRectangle | null {
  const content = {
    x: container.x + 2,
    y: container.y + getLegacyContainerHeaderHeight(container),
    width: Math.max(0, container.width - 4),
    height: Math.max(0, container.height - getLegacyContainerHeaderHeight(container) - 2),
  };
  const x = Math.max(bounds.x, content.x);
  const y = Math.max(bounds.y, content.y);
  const right = Math.min(bounds.x + bounds.width, content.x + content.width);
  const bottom = Math.min(bounds.y + bounds.height, content.y + content.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

function validBounds(bounds: CanvasRectangle): boolean {
  return (
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
