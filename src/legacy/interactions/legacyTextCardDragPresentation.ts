import type { LegacyTextCardPresentation } from "./legacyTextCardInteraction";

export interface LegacyTextCardDragRenderPosition {
  readonly x: number;
  readonly y: number;
}

/** Keeps measured interaction geometry out of TextCardNode's text-layout position contract. */
export function getLegacyTextCardDragRenderPosition(
  presentation: LegacyTextCardPresentation,
  id: string,
): LegacyTextCardDragRenderPosition {
  const offset = presentation.offsets.find((candidate) => candidate.id === id);
  return {
    x: presentation.current.x + (offset?.x ?? 0),
    y: presentation.current.y + (offset?.y ?? 0),
  };
}
