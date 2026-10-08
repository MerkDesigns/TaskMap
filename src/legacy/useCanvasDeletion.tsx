import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import { planCanvasDeletion } from "../app/canvasDocument";
import { ClearCanvasModal } from "../components/Modals";
import type { CanvasId, ElementId } from "../domain/ids/entityIds";
import type { TaskCanvas } from "../types";
import { ModalPresence } from "../ui/patterns/overlays";
import type { ElementIdsByKind } from "./useElementPresenceMarks";

/** How long removed elements play their exit animation before the deletion is committed. */
const DELETE_ANIMATION_MS = 180;

export interface CanvasDeletionPorts {
  readonly callbacks: RetainedActionCallbacks;
  readonly activeCanvas: () => Pick<
    TaskCanvas,
    "id" | "containers" | "textCards" | "textBlocks" | "images"
  >;
  readonly isDeletionLocked: (id: string) => boolean;
  readonly markDeleting: (ids: ElementIdsByKind) => void;
  readonly clearDeleting: () => void;
  readonly clearSelection: () => void;
  readonly closeContextMenus: () => void;
  /** Ends renames and text edits once the canvas has been cleared. */
  readonly endEditing: () => void;
}

/**
 * Removing elements and clearing the canvas. Removed elements play their exit animation first and
 * the deletion lands when it ends, as one transaction captured up front; leaving the canvas
 * cancels deletions still waiting. Clearing the canvas asks for confirmation in a dialog.
 */
export function useCanvasDeletion(ports: CanvasDeletionPorts) {
  const latest = useRef(ports);
  latest.current = ports;
  const pending = useRef(new Map<string, Set<number>>());
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  useEffect(() => {
    const timers = pending.current;
    return () => {
      timers.forEach((canvasTimers) => canvasTimers.forEach((timer) => window.clearTimeout(timer)));
      timers.clear();
    };
  }, []);

  const actions = useMemo(() => {
    const schedule = (canvasId: string, commit: () => void) => {
      const timer = window.setTimeout(() => {
        const canvasTimers = pending.current.get(canvasId);
        canvasTimers?.delete(timer);
        if (canvasTimers?.size === 0) pending.current.delete(canvasId);
        commit();
      }, DELETE_ANIMATION_MS);
      const canvasTimers = pending.current.get(canvasId) ?? new Set<number>();
      canvasTimers.add(timer);
      pending.current.set(canvasId, canvasTimers);
    };

    return {
      /** Removes the elements that are not deletion-locked, after their exit animation. */
      remove(ids: string[]) {
        const p = latest.current;
        const capture = p.callbacks.captureDelete(ids as ElementId[]);
        if (!capture) return;
        const canvas = p.activeCanvas();
        const plan = planCanvasDeletion(canvas, ids, p.isDeletionLocked);
        p.markDeleting({
          containers: plan.containerIds,
          textCards: plan.textCardIds,
          textBlocks: plan.textBlockIds,
          images: plan.imageIds,
        });
        p.closeContextMenus();
        schedule(canvas.id, () => {
          capture.complete();
          latest.current.clearDeleting();
          latest.current.clearSelection();
        });
      },
      /** Drops the canvas's deletions that have not landed yet. */
      cancelPending(canvasId: string) {
        pending.current.get(canvasId)?.forEach((timer) => window.clearTimeout(timer));
        pending.current.delete(canvasId);
        if (canvasId === latest.current.activeCanvas().id) latest.current.clearDeleting();
      },
      requestClear() {
        latest.current.closeContextMenus();
        setClearDialogOpen(true);
      },
      clear() {
        const p = latest.current;
        const result = p.callbacks
          .captureRemoveCanvas(p.activeCanvas().id as CanvasId, "clear")
          ?.complete(true);
        if (!result?.ok) return;
        p.closeContextMenus();
        p.clearSelection();
        p.endEditing();
        setClearDialogOpen(false);
      },
    };
  }, []);

  const clearDialog = (
    <ModalPresence open={clearDialogOpen}>
      <Suspense fallback={null}>
        <ClearCanvasModal onCancel={() => setClearDialogOpen(false)} onConfirm={actions.clear} />
      </Suspense>
    </ModalPresence>
  );

  return { ...actions, clearDialogOpen, clearDialog };
}
