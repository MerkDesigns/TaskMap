import { useEffect, useMemo, useRef, type PointerEvent, type WheelEvent } from "react";
import type { PointerSample, SelectionScope } from "../app/interactions/canvasInteractionTypes";
import type { ContainerElement } from "../types";
import {
  captureOnStage,
  createElementGestures,
  type CanvasGesturePorts,
} from "./canvasElementGestures";

export type { CanvasGesturePorts } from "./canvasElementGestures";

/** The will-change hint on the world layer outlives a wheel burst by this much. */
const WHEEL_LAYER_MS = 120;
/**
 * Dragging a selection past a container's card area scrolls it, faster the further out the
 * pointer is: screen px per ms at the edge, the gain per px beyond it, and the cap.
 */
const EDGE_SCROLL = { base: 0.15, gain: 0.01, max: 1.5 } as const;

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

    // The latest pointer sample, replayed when content scrolls under a still pointer.
    let lastSample: PointerSample | null = null;

    const startBoxSelection = (
      event: PointerEvent<HTMLElement>,
      scope: Omit<SelectionScope, "additive">,
    ) => {
      p().closeContextMenus();
      p().saveOpenEdits();
      p().endRename();
      captureOnStage(event);
      lastSample = {
        pointerId: event.pointerId,
        screen: { x: event.clientX, y: event.clientY },
        snapping: false,
      };
      return p().controller.beginSelection({
        ...scope,
        pointerId: event.pointerId,
        screen: lastSample.screen,
        additive: event.shiftKey,
      });
    };

    /**
     * While a box selection runs inside a container, scrolls it when the pointer is past its card
     * area and keeps the box on the content as it scrolls (by this or by the wheel). Runs once per
     * frame for the gesture only; it stops when the selection ends.
     */
    const followContainerSelection = (
      container: ContainerElement,
      scope: Omit<SelectionScope, "additive">,
      pointerId: number,
    ) => {
      const offsetOf = () => scope.contentOffset?.().y ?? 0;
      const clip = scope.clip;
      let shownOffset = offsetOf();
      let previous: number | null = null;
      const tick = (now: number) => {
        const { controller } = p();
        const active = controller.getSnapshot().activeInteraction;
        if (active?.kind !== "selection-box" || active.pointerId !== pointerId) return;
        const elapsed = previous === null ? 0 : Math.min(48, now - previous);
        previous = now;
        const sample = lastSample?.pointerId === pointerId ? lastSample : null;
        if (sample && clip) {
          const world = p().canvasPoint({ clientX: sample.screen.x, clientY: sample.screen.y });
          const beyond =
            world.y < clip.y ? world.y - clip.y : Math.max(0, world.y - (clip.y + clip.height));
          if (beyond !== 0) {
            const { zoom } = p().camera();
            const screenPerMs = Math.min(
              EDGE_SCROLL.max,
              EDGE_SCROLL.base + Math.abs(beyond) * zoom * EDGE_SCROLL.gain,
            );
            // The scope's offset reader clamps to the container's scroll range.
            const next = offsetOf() + Math.sign(beyond) * (screenPerMs / zoom) * elapsed;
            p().scrollContainer(container.id, Math.max(0, next));
          }
        }
        const offset = offsetOf();
        if (sample && offset !== shownOffset) {
          shownOffset = offset;
          controller.updatePointer(sample);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const pointerMove = (event: PointerEvent<HTMLElement>) => {
      if (p().connections.move(event)) return;
      const { controller, cardDrags } = p();
      lastSample = {
        pointerId: event.pointerId,
        screen: { x: event.clientX, y: event.clientY },
        snapping: event.shiftKey,
      };
      controller.updatePointer(lastSample);
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
        startBoxSelection(event, { candidates: [...p().interactionElements()] });
      },
      /**
       * A press in a container's empty card area box-selects its cards; the wheel or dragging past
       * the card area scrolls the container and carries the box on with the content.
       */
      containerContentPointerDown(event: PointerEvent<HTMLElement>, container: ContainerElement) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const scope = p().containerSelectionScope(
          container,
          () => p().containerScrollOffsets()[container.id] ?? 0,
        );
        if (startBoxSelection(event, scope))
          followContainerSelection(container, scope, event.pointerId);
      },

      ...elementGestures,

      pointerMove,
      pointerUp(event: PointerEvent<HTMLDivElement>) {
        if (p().connections.finish(event)) release(event);
        pointerMove(event);
        const { retained, controller, cardDrags } = p();
        controller.completePointer({
          pointerId: event.pointerId,
          screen: { x: event.clientX, y: event.clientY },
          snapping: event.shiftKey,
        });
        // Released cards settle from where they were let go: into their new places after a drop,
        // back into their old ones when the drag changed nothing.
        if (cardDrags.getSnapshot().active?.pointerId === event.pointerId) {
          const snapshot = retained.binding.getSnapshot();
          if (snapshot.phase === "ready" && snapshot.activeCanvas) {
            const canvas = snapshot.activeCanvas;
            const { pan, zoom } = p().camera();
            cardDrags.finish({
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
