import type { LegacyTextCardPresentation } from "./legacyTextCardInteraction";
import { getLegacyTextCardActiveOffset } from "./legacyTextCardPlacement";

export interface LegacyTextCardDragRenderPosition {
  readonly x: number;
  readonly y: number;
}

/** Keeps measured interaction geometry out of TextCardRenderer's text-layout position contract. */
export function getLegacyTextCardDragRenderPosition(
  presentation: LegacyTextCardPresentation,
  id: string,
): LegacyTextCardDragRenderPosition {
  const offset = presentation.offsets.find((candidate) => candidate.id === id);
  const active = offset
    ? getLegacyTextCardActiveOffset(offset, presentation.spread)
    : { x: 0, y: 0 };
  return { x: presentation.current.x + active.x, y: presentation.current.y + active.y };
}

/** Held cards show in their original arrangement over open canvas, stacked over a container. */
export function isLegacyTextCardSpread(presentation: LegacyTextCardPresentation) {
  return presentation.spread;
}
