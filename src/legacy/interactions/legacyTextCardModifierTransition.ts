import type { CanvasInteractionController } from "../../app/interactions/canvasInteractionController";
import type { LegacyTextCardInteractionService } from "./legacyTextCardInteraction";

/** Applies a Shift transition to the pointer-owned specialized card gesture. */
export function applyLegacyTextCardShiftTransition(
  controller: CanvasInteractionController,
  interaction: LegacyTextCardInteractionService,
  enabled: boolean,
): void {
  const active = interaction.getSnapshot().active;
  const controllerGesture = controller.getSnapshot().activeInteraction;
  if (
    !active ||
    controllerGesture?.kind !== "move" ||
    controllerGesture.pointerId !== active.pointerId
  ) {
    return;
  }

  controller.setMoveSnapping(active.pointerId, enabled);
  if (!enabled) return;

  const preview = controller
    .getSnapshot()
    .geometryPreviews.find(({ id }) => id === active.primaryId);
  if (!preview) {
    interaction.enableTrueSize(active.pointerId);
    return;
  }
  interaction.update({
    pointerId: active.pointerId,
    screen: active.latestScreen,
    world: active.latestWorld,
    primaryGeometry: preview.geometry,
    shiftKey: true,
  });
}
