import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { CapturedCompletion } from "../app/commands/retainedCompletionOwner";
import type { ConnectionCompletion } from "../app/commands/retainedConnectionCallbacks";
import { clamp } from "../canvasMath";
import { createEntityId, type ElementId } from "../domain/ids/entityIds";
import { getMindmapPortPoint, type MindmapBounds } from "../mindmapMath";
import type { MindmapPort } from "../types";

type Point = { readonly x: number; readonly y: number };
const uuids = { nextUuid: () => crypto.randomUUID() };

/** The connection being drawn from a port, as the canvas previews it. */
export interface ConnectionDraft {
  readonly pointerId: number;
  readonly sourceId: string;
  readonly sourcePort: MindmapPort;
  readonly source: Point;
  readonly target: Point;
  readonly targetId?: string;
  readonly targetPort?: MindmapPort;
}

export interface ConnectionDrawingPorts {
  readonly callbacks: RetainedActionCallbacks;
  /** The element's bounds as connections attach to them, or null when it cannot connect. */
  readonly boundsOf: (id: string) => MindmapBounds | null;
  /** Whether a connection already joins the two elements, in either direction. */
  readonly connected: (first: string, second: string) => boolean;
  readonly isMindmapNode: (id: string) => boolean;
  readonly canvasPoint: (clientX: number, clientY: number) => Point;
  readonly canvasSize: () => { width: number; height: number };
  readonly mindmapAccent: () => string;
  readonly onNodeCreated: (id: string) => void;
  readonly closeContextMenus: () => void;
}

/**
 * Drawing connections between elements: holding C shows the ports (connection mode), dragging from
 * one draws a connection, and releasing on another element's port connects them. Released on empty
 * canvas, a connection from a mind-map node creates a new node there; from anything else it is
 * dropped. The edit is captured when drawing starts, so it lands as one transaction or none.
 */
export function useConnectionDrawing(ports: ConnectionDrawingPorts) {
  const latest = useRef(ports);
  latest.current = ports;
  const [mode, setMode] = useState(false);
  const [draft, setDraft] = useState<ConnectionDraft | null>(null);
  const drafting = useRef<ConnectionDraft | null>(null);
  const captured = useRef<CapturedCompletion<ConnectionCompletion> | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const actions = useMemo(() => {
    const show = (next: ConnectionDraft | null) => {
      drafting.current = next;
      setDraft(next);
    };
    const cancel = () => {
      captured.current?.cancel();
      captured.current = null;
      show(null);
    };
    /** The port under the pointer that the draft may connect to. */
    const endpointAt = (clientX: number, clientY: number, sourceId: string) => {
      const port = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>("[data-connection-port]");
      const id = port?.dataset.connectionPortOwner;
      const side = port?.dataset.connectionPort as MindmapPort | undefined;
      const p = latest.current;
      if (!id || !side || id === sourceId || !p.boundsOf(id) || p.connected(sourceId, id))
        return null;
      return { id, port: side };
    };

    const start = (event: PointerEvent<HTMLButtonElement>, ownerId: string, port: MindmapPort) => {
      if (event.button !== 0 || !modeRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
        event.pointerId,
      );
      const p = latest.current;
      const bounds = p.boundsOf(ownerId);
      if (!bounds) return;
      captured.current?.cancel();
      captured.current = p.callbacks.captureConnection(ownerId as ElementId, port);
      if (!captured.current) return;
      const source = getMindmapPortPoint(bounds, port);
      show({
        pointerId: event.pointerId,
        sourceId: ownerId,
        sourcePort: port,
        source,
        target: source,
      });
      p.closeContextMenus();
    };

    /** Follows the pointer; true when the pointer is drawing a connection. */
    const move = (event: { pointerId: number; clientX: number; clientY: number }) => {
      const current = drafting.current;
      if (current?.pointerId !== event.pointerId) return false;
      const endpoint = endpointAt(event.clientX, event.clientY, current.sourceId);
      const bounds = endpoint ? latest.current.boundsOf(endpoint.id) : null;
      show({
        ...current,
        target:
          endpoint && bounds
            ? getMindmapPortPoint(bounds, endpoint.port)
            : latest.current.canvasPoint(event.clientX, event.clientY),
        targetId: endpoint?.id,
        targetPort: endpoint?.port,
      });
      return true;
    };

    /** Completes the connection the pointer was drawing; true when it was drawing one. */
    const finish = (event: { pointerId: number; clientX: number; clientY: number }) => {
      const current = drafting.current;
      if (current?.pointerId !== event.pointerId) return false;
      const p = latest.current;
      const endpoint = endpointAt(event.clientX, event.clientY, current.sourceId);
      const completion = captured.current;
      captured.current = null;
      const connectionId = createEntityId("connection", uuids);
      if (endpoint) {
        completion?.complete({
          connectionId,
          target: { elementId: endpoint.id as ElementId, portId: endpoint.port },
        });
      } else if (p.isMindmapNode(current.sourceId)) {
        const point = p.canvasPoint(event.clientX, event.clientY);
        const canvas = p.canvasSize();
        const id = createEntityId("element", uuids);
        const result = completion?.complete({
          connectionId,
          newNode: {
            id,
            geometry: {
              x: clamp(point.x, 0, canvas.width),
              y: clamp(point.y, 0, canvas.height),
              width: 1,
              height: 1,
            },
            data: { text: "Mindmap", accent: p.mindmapAccent() },
          },
        });
        if (result?.ok) p.onNodeCreated(id);
      } else completion?.cancel();
      show(null);
      return true;
    };

    /** Abandons the connection the pointer was drawing, if any. */
    const cancelPointer = (pointerId: number) => {
      if (drafting.current?.pointerId === pointerId) cancel();
    };

    /** Holding C; releasing it (or leaving the window) also abandons a connection being drawn. */
    const setConnectionMode = (active: boolean) => {
      setMode(active);
      if (!active) cancel();
    };

    return { start, move, finish, cancelPointer, cancel, setConnectionMode };
  }, []);

  const { callbacks } = ports;
  useEffect(() => {
    const unsubscribe = callbacks.subscribeInvalidation(actions.cancel);
    return () => {
      unsubscribe();
      actions.cancel();
    };
  }, [actions, callbacks]);

  return useMemo(() => ({ mode, draft, ...actions }), [actions, draft, mode]);
}
