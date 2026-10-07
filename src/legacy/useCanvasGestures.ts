import { useEffect, useMemo, useRef, type PointerEvent, type WheelEvent } from "react";
import type { InteractionElement } from "../app/interactions/canvasInteractionTypes";
import type { ContainerElement } from "../types";
import {
  captureOnStage,
  createElementGestures,
  type CanvasGesturePorts,
} from "./canvasElementGestures";

export type { CanvasGesturePorts } from "./canvasElementGestures";

/** The will-change hint on the world layer outlives a wheel burst by this much. */
const WHEEL_LAYER_MS = 120;

const release = (event: PointerEvent<HTMLElement>) => {
  if (event.currentTarget.hasPointerCapture(event.pointerId))
    event.currentTarget.releasePointerCapture(event.pointerId);
};

/**
 * The canvas pointer gestures over the interaction controller: panning (middle button or
 * Ctrl+drag), box selection on the canvas and inside a container, moving elements, resizing
 * frames and images within the canvas, and dragging text cards between containers. Every handler
 * reads the latest ports when the pointer event arrives.
 */
export function useCanvasGestures(ports: CanvasGesturePorts) {
  const latest = useRef(ports);
  latest.current = ports;
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (wheelTimer.current !== null) clearTimeout(wheelTimer.current);
    },
    [],
  );

  return useMemo(() => {
    const p = () => latest.current;
    const elementGestures = createElementGestures(p);

    const shouldPan = (event: PointerEvent<HTMLElement>) => {
      if (event.button === 1) return true;
      if (event.button !== 0 || !event.ctrlKey) return false;
      const target = event.target;
      return !(
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      );
    };

    const startPan = (event: PointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      p().closeContextMenus();
      p().endRename();
      p().showMinimap();
      p().controller.beginPan(event.pointerId, { x: event.clientX, y: event.clientY });
    };

    const startBoxSelection = (
      event: PointerEvent<HTMLElement>,
      candidates: readonly InteractionElement[],
    ) => {
      p().closeContextMenus();
      p().saveOpenEdits();
      p().endRename();
      captureOnStage(event);
      p().controller.beginSelection({
        pointerId: event.pointerId,
        screen: { x: event.clientX, y: event.clientY },
        candidates: [...candidates],
        additive: event.shiftKey,
      });
    };

    const pointerMove = (event: PointerEvent<HTMLElement>) => {
      if (p().connections.move(event)) return;
      const { controller, cardDrags } = p();
      controller.updatePointer({
        pointerId: event.pointerId,
        screen: { x: event.clientX, y: event.clientY },
        snapping: event.shiftKey,
      });
      const held = cardDrags.getSnapshot().active;
      if (held?.pointerId !== event.pointerId) return;
      const primary = controller
        .getSnapshot()
        .geometryPreviews.find(({ id }) => id === held.primaryId);
      if (!primary) return;
      cardDrags.update({
        pointerId: event.pointerId,
        screen: { x: event.clientX, y: event.clientY },
        world: p().canvasPoint(event),
        primaryGeometry: primary.geometry,
        shiftKey: event.shiftKey,
      });
    };

    return {
      /** Ctrl+drag pans even over elements, so the stage claims it before they see the press. */
      stagePointerDownCapture(event: PointerEvent<HTMLDivElement>) {
        if (event.button === 0 && event.ctrlKey && shouldPan(event)) startPan(event);
      },
      stagePointerDown(event: PointerEvent<HTMLDivElement>) {
        if (shouldPan(event)) startPan(event);
      },
      /** A press on empty canvas starts a box selection over every element. */
      worldPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0 || event.target !== p().world()) return;
        event.preventDefault();
        startBoxSelection(event, p().interactionElements());
      },
      /** A press in a container's empty card area box-selects its visible cards. */
      containerContentPointerDown(event: PointerEvent<HTMLElement>, container: ContainerElement) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        startBoxSelection(event, p().containerCardCandidates(container));
      },

      ...elementGestures,

      pointerMove,
      pointerUp(event: PointerEvent<HTMLDivElement>) {
        if (p().connections.finish(event)) release(event);
        pointerMove(event);
        const { retained, controller, cardDrags } = p();
        const workspace = () => retained.runtime.controller.store.getState().documentWorkspace;
        const before = workspace().document;
        controller.completePointer({
          pointerId: event.pointerId,
          screen: { x: event.clientX, y: event.clientY },
          snapping: event.shiftKey,
        });
        // A committed card drop lets the released cards fly from where they were let go.
        if (before !== workspace().document) {
          const snapshot = retained.binding.getSnapshot();
          if (snapshot.phase === "ready" && snapshot.activeCanvas) {
            const canvas = snapshot.activeCanvas;
            const { pan, zoom } = p().camera();
            cardDrags.finishCommitted({
              ...canvas,
              containers: [...canvas.containers],
              textCards: [...canvas.textCards],
              textBlocks: [...canvas.textBlocks],
              images: [...canvas.images],
              mindmapConnections: [...canvas.mindmapConnections],
              pan,
              zoom,
            });
          }
        }
        cardDrags.cancelActive(event.pointerId);
        release(event);
      },
      pointerCancel(event: PointerEvent<HTMLDivElement>) {
        p().connections.cancelPointer(event.pointerId);
        p().controller.cancelPointer(event.pointerId);
        p().cardDrags.cancelActive(event.pointerId);
        release(event);
      },

      /** Zooms around the pointer, keeping the world layer promoted for the burst. */
      wheel(event: WheelEvent<HTMLDivElement>) {
        event.preventDefault();
        p().closeContextMenus();
        p().endRename();
        p().showMinimap();
        const world = p().world();
        if (world) world.style.willChange = "transform";
        if (wheelTimer.current !== null) clearTimeout(wheelTimer.current);
        wheelTimer.current = setTimeout(() => {
          wheelTimer.current = null;
          const current = p().world();
          if (current) current.style.willChange = "";
        }, WHEEL_LAYER_MS);
        p().controller.wheelZoom({ x: event.clientX, y: event.clientY }, event.deltaY);
      },
    };
  }, []);
}
