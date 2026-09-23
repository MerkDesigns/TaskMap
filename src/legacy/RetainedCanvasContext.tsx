import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { createTauriDatabaseSessionController } from "../app/database/createTauriDatabaseSessionController";
import type { createRetainedCanvasBinding } from "../app/view-projection/createRetainedCanvasBinding";
import type { useCanvasDocument } from "../hooks/useCanvasDocument";
import type { TaskCanvas } from "../types";

export type RetainedApplicationRuntime = Extract<
  Awaited<ReturnType<typeof createTauriDatabaseSessionController>>,
  { ok: true }
>["value"];
export interface RetainedCanvasContextValue {
  readonly runtime: RetainedApplicationRuntime;
  readonly binding: ReturnType<typeof createRetainedCanvasBinding>;
}
export const RetainedCanvasContext = createContext<RetainedCanvasContextValue | null>(null);
const rejectLegacyMutation = (): never => {
  throw new Error("This document requires a named application action.");
};

/** Read-only compatibility props for the retained App presentation; never a writable TaskCanvas mirror. */
export function useRetainedCanvasDocument(): ReturnType<typeof useCanvasDocument> {
  const context = useContext(RetainedCanvasContext);
  if (!context) throw new Error("The retained canvas requires its session owner.");
  const { binding, runtime } = context;
  const snapshot = useSyncExternalStore(
    binding.subscribe,
    binding.getSnapshot,
    binding.getSnapshot,
  );
  return useMemo(() => {
    if (snapshot.phase !== "ready") throw new Error("The canvas session has been revoked.");
    const canvases: TaskCanvas[] = snapshot.canvases.map((canvas) => {
      const camera = runtime.views.get(canvas.id);
      return {
        ...canvas,
        containers: [...canvas.containers],
        textCards: [...canvas.textCards],
        textBlocks: [...canvas.textBlocks],
        images: [...canvas.images],
        mindmapConnections: [...canvas.mindmapConnections],
        pan: camera?.pan ?? { x: -520, y: -420 },
        zoom: camera?.zoom ?? 1,
      };
    });
    const activeCanvas = canvases.find(({ id }) => id === snapshot.activeCanvas?.id);
    if (!activeCanvas) throw new Error("The workspace has no active canvas.");
    return {
      canvases,
      activeCanvas,
      elements: activeCanvas.containers,
      textCards: activeCanvas.textCards,
      textBlocks: activeCanvas.textBlocks,
      images: activeCanvas.images,
      mindmapConnections: activeCanvas.mindmapConnections,
      pan: activeCanvas.pan,
      zoom: activeCanvas.zoom,
      setCanvases: rejectLegacyMutation,
      setActiveCanvas: rejectLegacyMutation,
      setCamera: rejectLegacyMutation,
      setElements: rejectLegacyMutation,
      setImages: rejectLegacyMutation,
      setTextBlocks: rejectLegacyMutation,
      setTextCards: rejectLegacyMutation,
      setMindmapConnections: rejectLegacyMutation,
      setPan: rejectLegacyMutation,
      setZoom: rejectLegacyMutation,
    };
  }, [runtime, snapshot]);
}
