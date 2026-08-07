import type {
  GeometryPreview,
  InteractionElement,
} from "../../app/interactions/canvasInteractionTypes";
import type {
  ContainerElement,
  ImageElement,
  TaskCanvas,
  TextBlockElement,
  TextCardElement,
} from "../../types";

export const LEGACY_LOOSE_CARD_CULLING_WIDTH = 540;
export const LEGACY_LOOSE_CARD_CULLING_HEIGHT = 320;
export const LEGACY_TEXT_CARD_ROW_HEIGHT = 43;

type LegacyGeometryElement = ContainerElement | TextBlockElement | TextCardElement | ImageElement;
export type LegacyResizeKind = "container" | "text-block" | "image";

export function getLegacyInteractionElements(
  canvas: TaskCanvas,
  measuredCardSizes: ReadonlyMap<string, { width: number; height: number }> = new Map(),
): InteractionElement[] {
  return [
    ...canvas.containers.map((element) => interactionElement(element)),
    ...canvas.textBlocks.map((element) => interactionElement(element)),
    ...canvas.textCards
      .filter((card) => !card.containerId)
      .map((card) =>
        interactionElement(card, measuredCardSizes.get(card.id) ?? estimateCard(card)),
      ),
    ...canvas.images
      .filter((image) => !image.containerId)
      .map((element) => interactionElement(element)),
  ];
}

export function projectLegacyGeometry<T extends LegacyGeometryElement>(
  elements: readonly T[],
  previews: readonly GeometryPreview[],
): T[] {
  if (previews.length === 0) return elements as T[];
  const byId = new Map(previews.map((preview) => [preview.id, preview.geometry]));
  return elements.map((element) => {
    const geometry = byId.get(element.id);
    return geometry ? ({ ...element, ...geometry } as T) : element;
  });
}

export function filterLegacyResizeSnapTargets(
  candidates: readonly InteractionElement[],
  options: {
    readonly activeId: string;
    readonly activeKind: LegacyResizeKind;
    readonly containerIds: ReadonlySet<string>;
    readonly textBlockIds: ReadonlySet<string>;
    readonly visibleIds: ReadonlySet<string>;
  },
): InteractionElement[] {
  return candidates.filter((candidate) => {
    if (candidate.id === options.activeId) return false;
    const container = options.containerIds.has(candidate.id);
    const textBlock = options.textBlockIds.has(candidate.id);
    if (options.activeKind === "container")
      return container && options.visibleIds.has(candidate.id);
    if (options.activeKind === "text-block")
      return textBlock && options.visibleIds.has(candidate.id);
    return (!container && !textBlock) || options.visibleIds.has(candidate.id);
  });
}

function interactionElement(
  element: LegacyGeometryElement,
  fallback?: { width: number; height: number },
): InteractionElement {
  const width = "width" in element ? element.width : fallback?.width;
  const height = "height" in element ? element.height : fallback?.height;
  return {
    id: element.id,
    geometry: {
      x: element.x,
      y: element.y,
      width: width ?? estimateCard(element as TextCardElement).width,
      height: height ?? estimateCard(element as TextCardElement).height,
    },
    locked: element.extensions?.lock?.enabled ?? false,
    movable: true,
    resizable: "width" in element && "height" in element,
    centerSnapping: "kind" in element && element.kind === "mindmap",
  };
}

export function estimateLegacyLooseTextCardSize(card: TextCardElement): {
  width: number;
  height: number;
} {
  return estimateCard(card);
}

function estimateCard(card: TextCardElement): { width: number; height: number } {
  const longestLine = Math.max(1, ...card.text.split("\n").map((line) => line.length));
  const width = Math.max(44, Math.min(520, longestLine * 9 + 48));
  const lines = card.text
    .split("\n")
    .reduce((count, line) => count + Math.max(1, Math.ceil((line.length * 9) / 472)), 0);
  return {
    width,
    height: card.kind === "mindmap" ? LEGACY_TEXT_CARD_ROW_HEIGHT + (lines - 1) * 24 : 43,
  };
}
