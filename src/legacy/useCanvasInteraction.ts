import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SetStateAction,
} from "react";
import { useStableCanvasInteractionController } from "../app/interactions/useStableCanvasInteractionController";
import { applyLegacySelectionAction } from "./interactions/legacySelectionCompatibility";
import { createLegacyTextCardInteractionService } from "./interactions/legacyTextCardInteraction";
import { useLegacyCameraPresentation } from "./interactions/useLegacyCameraPresentation";
import { useLegacyInteractionSnapshot } from "./interactions/useLegacyInteractionSnapshot";
import type { RetainedCanvasContextValue } from "./RetainedCanvasContext";

const createCardDrags = () =>
  createLegacyTextCardInteractionService({
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    setTimer: (callback, delay) => window.setTimeout(callback, delay),
    clearTimer: (handle) => window.clearTimeout(handle),
  });

/**
 * The canvas's transient interaction state: the interaction controller (camera, selection and
 * gesture previews) with the camera written straight to the stage, the text card drag service, the
 * stage's size and the last pointer position. None of it enters the document.
 */
export function useCanvasInteraction(retained: RetainedCanvasContextValue) {
  const stageRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const lastPointer = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [cardDrags] = useState(createCardDrags);

  const controller = useStableCanvasInteractionController(() => retained.binding.interaction);
  const snapshot = useLegacyInteractionSnapshot(controller);
  useLegacyCameraPresentation(controller, stageRef, selectionRef);
  const cardDragSnapshot = useSyncExternalStore(
    cardDrags.subscribe,
    cardDrags.getSnapshot,
    cardDrags.getSnapshot,
  );

  useEffect(() => {
    controller.resizeViewport(stageSize);
  }, [controller, stageSize]);

  // A reloaded document invalidates any card drag in progress.
  useEffect(() => {
    const reset = () => cardDrags.reset();
    const unsubscribe = retained.runtime.callbacks.subscribeInvalidation(reset);
    return () => {
      unsubscribe();
      reset();
    };
  }, [retained, cardDrags]);
  useEffect(() => () => cardDrags.cancelScheduledPresentation(), [cardDrags]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      setStageSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const track = (event: PointerEvent) => {
      lastPointer.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", track, true);
    return () => window.removeEventListener("pointermove", track, true);
  }, []);

  const setSelection = useCallback(
    (value: SetStateAction<string[]>) => applyLegacySelectionAction(controller, value),
    [controller],
  );

  return {
    stageRef,
    selectionRef,
    stageSize,
    lastPointer,
    controller,
    snapshot,
    selectedIds: snapshot.selectedIds as string[],
    setSelection,
    cardDrags,
    cardDragSnapshot,
  };
}
