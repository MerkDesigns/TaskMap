import { useEffect, useMemo, useRef, useState } from "react";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import { clamp } from "../canvasMath";
import { CANVAS_WIDTH } from "../constants";
import { createEntityId, type CanvasId } from "../domain/ids/entityIds";
import type { TaskCanvas } from "../types";
import type { LeftPanelState } from "./useLeftPanel";

const uuids = { nextUuid: () => crypto.randomUUID() };
/** The Canvas Browser stays up briefly after Ctrl is released so the landing canvas is seen. */
const CYCLE_PANEL_RESTORE_DELAY_MS = 280;

export type CanvasDetails = Pick<TaskCanvas, "name" | "width" | "height">;

export interface CanvasManagementPorts {
  readonly callbacks: RetainedActionCallbacks;
  readonly activeCanvasId: () => string;
  /** Canvas ids in the Canvas Browser's order. */
  readonly canvasIds: () => readonly string[];
  /** Drops selection, edits and menus that belong to the canvas being left. */
  readonly resetPresentation: () => void;
  readonly leftPanel: {
    readonly show: (panel: "canvases") => void;
    readonly current: () => LeftPanelState;
    readonly restore: (state: LeftPanelState) => void;
  };
  readonly closeQuickExtensions: () => void;
}

interface CycleSession {
  readonly order: readonly string[];
  readonly index: number;
  readonly previousPanelState: LeftPanelState;
}

const clampCanvasSize = (value: number) =>
  clamp(Number.isFinite(value) ? value : CANVAS_WIDTH, 600, 10000);

const canvasSettings = ({ name, width, height }: CanvasDetails) => ({
  name: name.trim() || "Untitled canvas",
  settings: { width: clampCanvasSize(width), height: clampCanvasSize(height) },
});

/**
 * The open database's canvases: creating, switching, editing, deleting and reordering them, and
 * cycling through them with Ctrl+Tab. A cycle shows the Canvas Browser with the landing canvas
 * highlighted and keeps the order it started with, then puts the side panel back as it was.
 */
export function useCanvasManagement(ports: CanvasManagementPorts) {
  const latest = useRef(ports);
  latest.current = ports;
  const [cycleHighlightId, setCycleHighlightId] = useState<string | null>(null);
  const session = useRef<CycleSession | null>(null);
  const restoreTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (restoreTimer.current !== null) window.clearTimeout(restoreTimer.current);
    },
    [],
  );

  const actions = useMemo(() => {
    const cancelRestore = () => {
      if (restoreTimer.current !== null) window.clearTimeout(restoreTimer.current);
      restoreTimer.current = null;
    };
    const select = (id: string) => {
      const p = latest.current;
      if (id === p.activeCanvasId()) return;
      if (p.callbacks.switchCanvas(id as CanvasId).ok) p.resetPresentation();
    };

    return {
      select,
      create(draft: CanvasDetails) {
        const p = latest.current;
        const result = p.callbacks.captureCreateCanvas()?.complete({
          id: createEntityId("canvas", uuids) as CanvasId,
          ...canvasSettings(draft),
          elementOrder: [],
        });
        if (result?.ok) p.resetPresentation();
      },
      update(id: string, details: CanvasDetails) {
        latest.current.callbacks
          .captureCanvasDetails(id as CanvasId)
          ?.complete(canvasSettings(details));
      },
      remove(id: string) {
        const p = latest.current;
        const result = p.callbacks.captureRemoveCanvas(id as CanvasId)?.complete(true);
        if (result?.ok && id === p.activeCanvasId()) p.resetPresentation();
      },
      reorder(orderedIds: string[]) {
        latest.current.callbacks.captureCanvasOrder()?.complete(orderedIds as CanvasId[]);
      },
      cycle(direction: 1 | -1) {
        const p = latest.current;
        const current = session.current;
        const order = current?.order ?? p.canvasIds();
        if (order.length <= 1) return;
        const index = current?.index ?? Math.max(0, order.indexOf(p.activeCanvasId()));
        const nextIndex = (index + direction + order.length) % order.length;
        const nextId = order[nextIndex];
        if (!nextId) return;
        session.current = {
          order,
          index: nextIndex,
          previousPanelState: current?.previousPanelState ?? p.leftPanel.current(),
        };
        cancelRestore();
        p.closeQuickExtensions();
        setCycleHighlightId(nextId);
        p.leftPanel.show("canvases");
        select(nextId);
      },
      cycling: () => session.current !== null,
      finishCycle() {
        const previous = session.current?.previousPanelState ?? "closed";
        session.current = null;
        setCycleHighlightId(null);
        cancelRestore();
        restoreTimer.current = window.setTimeout(() => {
          restoreTimer.current = null;
          latest.current.leftPanel.restore(previous);
        }, CYCLE_PANEL_RESTORE_DELAY_MS);
      },
    };
  }, []);

  return useMemo(() => ({ ...actions, cycleHighlightId }), [actions, cycleHighlightId]);
}
