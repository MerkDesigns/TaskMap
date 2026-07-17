import { AppData, TaskCanvas } from "../types";

export type CanvasHistory = Record<string, TaskCanvas[]>;
export type CanvasHistoryIndex = Record<string, number>;

export type HistoryAvailability = {
  canUndo: boolean;
  canRedo: boolean;
};

const HISTORY_LIMIT = 60;

export const cloneCanvas = (canvas: TaskCanvas): TaskCanvas => structuredClone(canvas);

export const omitCameraFromHistory = (canvas: TaskCanvas): TaskCanvas => ({
  ...canvas,
  pan: { x: 0, y: 0 },
  zoom: 1,
  previewViewport: undefined,
});

export const getCanvasHistoryState = (
  historyByCanvasId: CanvasHistory,
  historyIndexByCanvasId: CanvasHistoryIndex,
  canvasId: string,
): HistoryAvailability => {
  const history = historyByCanvasId[canvasId] ?? [];
  const historyIndex = historyIndexByCanvasId[canvasId] ?? -1;

  return {
    canUndo: historyIndex > 0,
    canRedo: historyIndex >= 0 && historyIndex < history.length - 1,
  };
};

export const createInitialCanvasHistory = (canvas: TaskCanvas) => ({
  historyByCanvasId: {
    [canvas.id]: [omitCameraFromHistory(cloneCanvas(canvas))],
  } as CanvasHistory,
  historyIndexByCanvasId: {
    [canvas.id]: 0,
  } as CanvasHistoryIndex,
});

export const pushCanvasHistorySnapshot = (
  historyByCanvasId: CanvasHistory,
  historyIndexByCanvasId: CanvasHistoryIndex,
  data: AppData,
  canvasId = data.activeCanvasId,
) => {
  const canvas = data.canvases.find((currentCanvas) => currentCanvas.id === canvasId);
  if (!canvas) {
    return null;
  }

  const snapshot = omitCameraFromHistory(cloneCanvas(canvas));
  const currentHistory = historyByCanvasId[canvas.id] ?? [];
  const currentHistoryIndex = historyIndexByCanvasId[canvas.id] ?? -1;
  const previous = currentHistory[currentHistoryIndex];

  if (previous && JSON.stringify(previous) === JSON.stringify(snapshot)) {
    return {
      canvasId: canvas.id,
      historyByCanvasId,
      historyIndexByCanvasId,
    };
  }

  const nextHistory = currentHistory.slice(0, currentHistoryIndex + 1);
  nextHistory.push(snapshot);

  if (nextHistory.length > HISTORY_LIMIT) {
    nextHistory.shift();
  }

  return {
    canvasId: canvas.id,
    historyByCanvasId: {
      ...historyByCanvasId,
      [canvas.id]: nextHistory,
    },
    historyIndexByCanvasId: {
      ...historyIndexByCanvasId,
      [canvas.id]: nextHistory.length - 1,
    },
  };
};
