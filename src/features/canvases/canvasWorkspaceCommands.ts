import type { WorkspaceOperations } from "../../app/workspace/workspaceOperations";
import { createEntityId, type CanvasId } from "../../domain/ids/entityIds";

export interface CanvasDraft {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

export function normalizeCanvasDraft(draft: CanvasDraft): CanvasDraft {
  const dimension = (value: number) =>
    Number.isFinite(value) ? Math.min(10_000, Math.max(600, Math.round(value))) : 3_000;
  return {
    name: draft.name.trim() || "Untitled canvas",
    width: dimension(draft.width),
    height: dimension(draft.height),
  };
}

export function createCanvas(workspace: WorkspaceOperations, draft: CanvasDraft): CanvasId {
  const normalized = normalizeCanvasDraft(draft);
  const canvasId = createEntityId("canvas", { nextUuid: () => crypto.randomUUID() });
  workspace.dispatchCommand({
    type: "document.canvas.create",
    payload: {
      canvas: {
        id: canvasId,
        name: normalized.name,
        settings: { width: normalized.width, height: normalized.height },
      },
    },
  });
  workspace.dispatchCommand({
    type: "document.canvas.set-active",
    payload: { canvasId },
  });
  return canvasId;
}

export function updateCanvas(
  workspace: WorkspaceOperations,
  canvasId: CanvasId,
  draft: CanvasDraft,
) {
  const normalized = normalizeCanvasDraft(draft);
  workspace.dispatchCommand({
    type: "document.canvas.update",
    payload: {
      canvasId,
      name: normalized.name,
      settings: { width: normalized.width, height: normalized.height },
    },
  });
}

export function selectCanvas(workspace: WorkspaceOperations, canvasId: CanvasId) {
  return workspace.dispatchCommand({
    type: "document.canvas.set-active",
    payload: { canvasId },
  });
}

export function deleteCanvas(workspace: WorkspaceOperations, canvasId: CanvasId) {
  return workspace.dispatchCommand({ type: "document.canvas.remove", payload: { canvasId } });
}

export function reorderCanvases(workspace: WorkspaceOperations, order: readonly CanvasId[]) {
  return workspace.dispatchCommand({
    type: "document.canvas.reorder",
    payload: { order: [...order] },
  });
}
