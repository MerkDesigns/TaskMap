import type { ElementId } from "../../domain/ids/entityIds";
import type { RetainedActionCallbacks } from "../commands/createRetainedActionCallbacks";
import type { CompletionResult } from "../commands/retainedCompletionOwner";
import type { ResolvedTextCardDrop } from "../commands/retainedTextCardDrop";
import { createCanvasInteractionController } from "./canvasInteractionController";
import type {
  CanvasInteractionController,
  CanvasInteractionControllerOptions,
  MoveGestureInput,
} from "./canvasInteractionTypes";

export interface RetainedMoveGestureInput extends MoveGestureInput {
  // As in the current UI, update the placement service with the release sample before completing.
  // Read only at completion; the view still owns pickup/settle presentation and its reset on cancel.
  readonly resolveTextCardDrop?: () => ResolvedTextCardDrop | null;
}
export interface RetainedCanvasInteractionController extends CanvasInteractionController {
  readonly beginMove: (input: RetainedMoveGestureInput) => boolean;
}

type Options = Omit<CanvasInteractionControllerOptions, "commitPort"> & {
  readonly actions: RetainedActionCallbacks;
  readonly onCompletion?: (result: CompletionResult) => void;
};
type Pending = {
  readonly pointerId: number;
  readonly move?: NonNullable<ReturnType<RetainedActionCallbacks["captureMove"]>>;
  readonly resize?: NonNullable<ReturnType<RetainedActionCallbacks["captureResize"]>>;
  readonly resolveDrop?: () => ResolvedTextCardDrop | null;
};

// Unmounted composition of the existing gesture engine and command callbacks, not another engine.
export function createRetainedCanvasInteractionController(
  options: Options,
): RetainedCanvasInteractionController {
  const { actions } = options;
  let disposed = false;
  let completing = false;
  let invalidating = false;
  let pending: Pending | null = null;
  const cancelCapture = () => {
    const captured = pending;
    pending = null;
    captured?.move?.cancel();
    captured?.resize?.cancel();
  };
  const report = (result: CompletionResult | undefined) => {
    if (result) options.onCompletion?.(result);
  };
  const controller = createCanvasInteractionController({
    ...options,
    commitPort: {
      commitMove: (operation) => {
        const captured = pending;
        try {
          const completion = captured?.resolveDrop
            ? { operation, textCardDrop: captured.resolveDrop() }
            : { operation };
          report(captured?.move?.complete(completion));
        } catch {
          report({ ok: false, code: "invalid-action" });
        }
      },
      commitResize: (operation) => report(pending?.resize?.complete(operation)),
      commitLayerOrder: ({ selectedIds, direction }) => {
        report(actions.captureLayers(selectedIds as ElementId[], direction)?.complete());
      },
    },
  });
  const canBegin = () =>
    !disposed &&
    !completing &&
    !invalidating &&
    actions.canInteract(controller.getSnapshot().canvasKey);
  const invalidate = () => {
    invalidating = true;
    try {
      cancelCapture();
      const active = controller.getSnapshot().activeInteraction;
      if (active) controller.cancelPointer(active.pointerId);
      controller.clearSelection();
    } finally {
      invalidating = false;
    }
  };
  // Reuse the callbacks' single workspace/session subscription pair, not per-gesture observers.
  const unsubscribe = actions.subscribeInvalidation(invalidate);
  return {
    ...controller,
    beginPan: (pointerId, screen) => canBegin() && controller.beginPan(pointerId, screen),
    beginSelection: (input) => canBegin() && controller.beginSelection(input),
    beginMove(input) {
      const placing = input.completionBehavior === "place";
      if (
        !canBegin() ||
        placing !== !!input.resolveTextCardDrop ||
        !controller.beginMove({
          ...input,
          ...(placing
            ? { commitThresholdScreen: Math.max(3, input.commitThresholdScreen ?? 3) }
            : {}),
        })
      )
        return false;
      const active = controller.getSnapshot().activeInteraction;
      if (active?.kind !== "move" || active.pointerId !== input.pointerId) return false;
      // Capture the controller's eligible set, not the unfiltered selection (e.g. locked members).
      const move = actions.captureMove(
        input.primaryId as ElementId,
        active.targetIds as ElementId[],
        placing ? (active.targetIds as ElementId[]) : [],
        placing ? "text-card" : undefined,
      );
      if (!move) {
        controller.cancelPointer(input.pointerId);
        return false;
      }
      pending = { pointerId: input.pointerId, move, resolveDrop: input.resolveTextCardDrop };
      return true;
    },
    beginResize(input) {
      if (!canBegin() || !controller.beginResize(input)) return false;
      const active = controller.getSnapshot().activeInteraction;
      if (active?.kind !== "resize" || active.pointerId !== input.pointerId) return false;
      const capturedResize = actions.captureResize(input.target.id as ElementId);
      if (!capturedResize) {
        controller.cancelPointer(input.pointerId);
        return false;
      }
      pending = { pointerId: input.pointerId, resize: capturedResize };
      return true;
    },
    completePointer(sample) {
      if (
        disposed ||
        completing ||
        controller.getSnapshot().activeInteraction?.pointerId !== sample.pointerId
      )
        return;
      completing = true;
      try {
        controller.completePointer(sample);
      } finally {
        // The engine deliberately emits no commit for unchanged/below-threshold gestures.
        cancelCapture();
        completing = false;
      }
    },
    cancelPointer(pointerId) {
      if (pending?.pointerId === pointerId) cancelCapture();
      controller.cancelPointer(pointerId);
    },
    replaceCanvas(canvasKey, viewport) {
      cancelCapture();
      controller.replaceCanvas(canvasKey, viewport);
    },
    reorder(ids, direction) {
      if (canBegin()) controller.reorder(ids, direction);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      cancelCapture();
      try {
        controller.replaceCanvas("", controller.getSnapshot().viewport);
      } finally {
        controller.dispose();
      }
    },
  };
}
