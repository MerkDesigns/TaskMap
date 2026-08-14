import { memo, type PointerEvent, useCallback, useLayoutEffect, useRef } from "react";
import { BenchmarkElementContent } from "./BenchmarkElementContent";
import type { BenchmarkGeometryCommit, BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkElementModel } from "./benchmarkTypes";
import {
  applyBenchmarkElementCssGeometry,
  benchmarkElementCssGeometry,
} from "./benchmarkElementCssGeometry";

interface Props {
  element: BenchmarkElementModel;
  store: BenchmarkSceneStore;
  liquidPositioned: boolean;
  moveImage: boolean;
  showGif: boolean;
  registerElement?: (id: string, element: HTMLElement | null) => void;
  onGesturePin?: (id: string, pinned: boolean) => void;
}

interface DragState {
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  resizing: boolean;
}

interface PointerSample {
  pointerId: number;
  clientX: number;
  clientY: number;
}

function BenchmarkSceneElementComponent({
  element,
  store,
  liquidPositioned,
  moveImage,
  showGif,
  registerElement,
  onGesturePin,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<DragState | null>(null);
  const pendingSample = useRef<PointerSample | null>(null);
  const preview = useRef<BenchmarkGeometryCommit | null>(null);
  const frame = useRef<number | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    registerElement?.(element.id, node);
    return () => registerElement?.(element.id, null);
  }, [element.id, registerElement]);

  const applySample = useCallback(
    (sample: PointerSample) => {
      const active = drag.current;
      if (!active || active.pointerId !== sample.pointerId) return;
      const zoom = store.scene.camera.zoom;
      const deltaX = (sample.clientX - active.clientX) / zoom;
      const deltaY = (sample.clientY - active.clientY) / zoom;
      const geometry: BenchmarkGeometryCommit = active.resizing
        ? {
            x: active.x,
            y: active.y,
            width: Math.max(220, active.width + deltaX),
            height: Math.max(140, active.height + deltaY),
          }
        : {
            x: active.x + deltaX,
            y: active.y + deltaY,
            width: active.width,
            height: active.height,
          };
      preview.current = geometry;
      const node = ref.current;
      if (active.resizing) {
        if (node) {
          node.style.width = `${geometry.width}px`;
          node.style.height = `${geometry.height}px`;
        }
      } else if (!liquidPositioned && node) {
        node.style.transform = `translate3d(${geometry.x - active.x}px, ${geometry.y - active.y}px, 0)`;
      }
    },
    [liquidPositioned, store],
  );

  const flushPendingSample = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const sample = pendingSample.current;
    pendingSample.current = null;
    if (sample) applySample(sample);
  }, [applySample]);

  useLayoutEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const start = useCallback(
    (event: PointerEvent, resizing: boolean) => {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        (!resizing && event.target instanceof Element && event.target.closest("button"))
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      drag.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        resizing,
      };
      preview.current = {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      };
      if (ref.current) ref.current.style.willChange = resizing ? "width, height" : "transform";
      onGesturePin?.(element.id, true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [element, onGesturePin],
  );

  const move = useCallback(
    (event: PointerEvent) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      pendingSample.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      if (frame.current === null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          const sample = pendingSample.current;
          pendingSample.current = null;
          if (sample) applySample(sample);
        });
      }
    },
    [applySample],
  );

  const end = useCallback(
    (event: PointerEvent) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      pendingSample.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      flushPendingSample();
      const geometry = preview.current;
      const active = drag.current;
      drag.current = null;
      preview.current = null;
      const node = ref.current;
      if (geometry && node && !liquidPositioned) {
        applyBenchmarkElementCssGeometry(node, { ...element, ...geometry });
        node.style.transform = "";
      } else if (geometry && node) {
        node.style.width = "";
        node.style.height = "";
      }
      if (node) node.style.willChange = "";
      if (geometry) store.commitElementGeometry(element.id, geometry);
      if (active) onGesturePin?.(element.id, false);
    },
    [element, flushPendingSample, liquidPositioned, onGesturePin, store],
  );

  const Tag = element.kind === "container" ? "section" : "article";
  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      className={`renderer-benchmark__element renderer-benchmark__element--${element.kind}`}
      data-benchmark-element={element.id}
      style={liquidPositioned ? undefined : benchmarkElementCssGeometry(element)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <BenchmarkElementContent
        element={element}
        store={store}
        moveImage={moveImage}
        showGif={showGif}
        onMovePointerDown={(event) => start(event, false)}
        onResizePointerDown={(event) => start(event, true)}
      />
    </Tag>
  );
}

export const BenchmarkSceneElement = memo(BenchmarkSceneElementComponent);
