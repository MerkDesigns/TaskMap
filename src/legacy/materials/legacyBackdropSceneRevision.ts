import type { CanvasGridStyle, TaskCanvas } from "../../types";
import type { LegacyTextCardPresentationSize } from "./legacyBackdropScene";

export interface LegacyBackdropSceneRevisionInput {
  readonly canvas: TaskCanvas;
  readonly gridStyle: CanvasGridStyle;
  readonly gridOpacityPercent: number;
  readonly textCardSizes: ReadonlyMap<string, LegacyTextCardPresentationSize>;
}

export interface LegacyBackdropSceneRevisionState {
  readonly revision: number;
  readonly input: LegacyBackdropSceneRevisionInput;
}

export function advanceLegacyBackdropSceneRevision(
  current: LegacyBackdropSceneRevisionState | null,
  input: LegacyBackdropSceneRevisionInput,
): LegacyBackdropSceneRevisionState {
  if (current && sameRevisionInput(current.input, input)) return current;
  return Object.freeze({ revision: (current?.revision ?? 0) + 1, input });
}

function sameRevisionInput(
  left: LegacyBackdropSceneRevisionInput,
  right: LegacyBackdropSceneRevisionInput,
): boolean {
  return (
    left.canvas === right.canvas &&
    left.gridStyle === right.gridStyle &&
    left.gridOpacityPercent === right.gridOpacityPercent &&
    left.textCardSizes === right.textCardSizes
  );
}
