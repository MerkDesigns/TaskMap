import type { CanvasInteractionController } from "../../app/interactions/canvasInteractionController";

export type LegacySelectionAction = readonly string[] | ((current: string[]) => readonly string[]);

export function applyLegacySelectionAction(
  controller: CanvasInteractionController,
  action: LegacySelectionAction,
): void {
  const current = [...controller.getSnapshot().selectedIds];
  controller.setSelection(typeof action === "function" ? action(current) : action);
}
