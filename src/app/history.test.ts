import { describe, expect, it } from "vitest";

import { AppData, TaskCanvas } from "../types";
import { DEFAULT_ELEMENT_COLORS } from "../constants";
import {
  createInitialCanvasHistory,
  getCanvasHistoryState,
  omitCameraFromHistory,
  pushCanvasHistorySnapshot,
} from "./history";

const createCanvas = (overrides: Partial<TaskCanvas> = {}): TaskCanvas => ({
  id: "canvas-1",
  name: "Canvas 1",
  width: 3000,
  height: 3000,
  containers: [],
  textCards: [],
  textBlocks: [],
  images: [],
  pan: { x: -520, y: -420 },
  zoom: 1.5,
  previewViewport: { width: 1280, height: 820 },
  ...overrides,
});

const createData = (canvas: TaskCanvas): AppData => ({
  schemaVersion: 1,
  activeCanvasId: canvas.id,
  canvases: [canvas],
  canvasGridStyle: "dots",
  canvasGridOpacity: { dots: 50, lines: 15 },
  defaultElementColors: DEFAULT_ELEMENT_COLORS,
  recentColors: [],
  shadowsUnderElements: true,
  allowLockedElementDeletion: true,
  discordRpcEnabled: false,
  discordRpcShowCanvas: true,
  minimapEnabled: true,
  privacyModeEnabled: false,
  toolbarButtonsVisible: false,
});

describe("canvas history", () => {
  it("excludes camera state without mutating the source canvas", () => {
    const canvas = createCanvas();

    const snapshot = omitCameraFromHistory(canvas);

    expect(snapshot.pan).toEqual({ x: 0, y: 0 });
    expect(snapshot.zoom).toBe(1);
    expect(snapshot.previewViewport).toBeUndefined();
    expect(canvas.pan).toEqual({ x: -520, y: -420 });
    expect(canvas.zoom).toBe(1.5);
  });

  it("does not append an identical snapshot", () => {
    const canvas = createCanvas();
    const initial = createInitialCanvasHistory(canvas);

    const result = pushCanvasHistorySnapshot(
      initial.historyByCanvasId,
      initial.historyIndexByCanvasId,
      createData(canvas),
    );

    expect(result?.historyByCanvasId).toBe(initial.historyByCanvasId);
    expect(result?.historyIndexByCanvasId).toBe(initial.historyIndexByCanvasId);
  });

  it("truncates redo history when a new branch is recorded", () => {
    const initial = createInitialCanvasHistory(createCanvas());
    const firstPush = pushCanvasHistorySnapshot(
      initial.historyByCanvasId,
      initial.historyIndexByCanvasId,
      createData(createCanvas({ name: "Old future" })),
    );

    expect(firstPush).not.toBeNull();
    const branched = pushCanvasHistorySnapshot(
      firstPush!.historyByCanvasId,
      { "canvas-1": 0 },
      createData(createCanvas({ name: "New branch" })),
    );

    expect(branched?.historyByCanvasId["canvas-1"]).toHaveLength(2);
    expect(branched?.historyByCanvasId["canvas-1"][1].name).toBe("New branch");
    expect(
      getCanvasHistoryState(branched!.historyByCanvasId, { "canvas-1": 0 }, "canvas-1"),
    ).toEqual({ canUndo: false, canRedo: true });
  });

  it("retains only the latest sixty snapshots", () => {
    let state = createInitialCanvasHistory(createCanvas());

    for (let index = 1; index <= 65; index += 1) {
      const result = pushCanvasHistorySnapshot(
        state.historyByCanvasId,
        state.historyIndexByCanvasId,
        createData(createCanvas({ name: `Canvas ${index}` })),
      );
      expect(result).not.toBeNull();
      state = {
        historyByCanvasId: result!.historyByCanvasId,
        historyIndexByCanvasId: result!.historyIndexByCanvasId,
      };
    }

    const history = state.historyByCanvasId["canvas-1"];
    expect(history).toHaveLength(60);
    expect(history[0].name).toBe("Canvas 6");
    expect(history[history.length - 1]?.name).toBe("Canvas 65");
  });

  it("records an explicitly targeted canvas when another canvas is active", () => {
    const firstCanvas = createCanvas();
    const secondCanvas = { ...createCanvas(), id: "canvas-2", name: "Second" };
    const initial = createInitialCanvasHistory(firstCanvas);
    const data = {
      ...createData(secondCanvas),
      canvases: [{ ...firstCanvas, name: "Updated first" }, secondCanvas],
    };

    const result = pushCanvasHistorySnapshot(
      initial.historyByCanvasId,
      initial.historyIndexByCanvasId,
      data,
      firstCanvas.id,
    );

    expect(result?.canvasId).toBe(firstCanvas.id);
    expect(result?.historyByCanvasId[firstCanvas.id]).toHaveLength(2);
    expect(result?.historyByCanvasId[firstCanvas.id][1].name).toBe("Updated first");
    expect(result?.historyByCanvasId[secondCanvas.id]).toBeUndefined();
  });

  it("keeps separate immediate actions as separate undo steps", () => {
    const canvas = createCanvas();
    let state = createInitialCanvasHistory(canvas);

    for (const name of ["First action", "Second action"]) {
      const result = pushCanvasHistorySnapshot(
        state.historyByCanvasId,
        state.historyIndexByCanvasId,
        createData({ ...canvas, name }),
      )!;
      state = {
        historyByCanvasId: result.historyByCanvasId,
        historyIndexByCanvasId: result.historyIndexByCanvasId,
      };
    }

    expect(state.historyByCanvasId[canvas.id].map((snapshot) => snapshot.name)).toEqual([
      "Canvas 1",
      "First action",
      "Second action",
    ]);
  });
});
