import { Button } from "@mantine/core";
import { type PointerEvent, useLayoutEffect, useRef } from "react";
import type { BenchmarkPresentation } from "./benchmarkPresentation";
import { clampBenchmarkGlassSize, type BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkGlassModel } from "./benchmarkTypes";

interface Props {
  glass: BenchmarkGlassModel;
  store: BenchmarkSceneStore;
  presentation: BenchmarkPresentation;
  liquidPositioned: boolean;
}

interface GlassGesture {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  resizing: boolean;
}

interface PendingSample {
  clientX: number;
  clientY: number;
}

export function BenchmarkGlassPanel({ glass, store, presentation, liquidPositioned }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<GlassGesture | null>(null);
  const pendingSample = useRef<PendingSample | null>(null);
  const frame = useRef<number | null>(null);
  const preview = useRef(glass);

  useLayoutEffect(() => presentation.syncGlass(glass), [glass, presentation]);
  useLayoutEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const applyPendingSample = () => {
    frame.current = null;
    const active = gesture.current;
    const sample = pendingSample.current;
    pendingSample.current = null;
    if (!active || !sample) return;
    const deltaX = sample.clientX - active.startX;
    const deltaY = sample.clientY - active.startY;
    const size = clampBenchmarkGlassSize(active.width + deltaX, active.height + deltaY);
    const next = active.resizing
      ? {
          ...glass,
          ...size,
        }
      : { ...glass, x: active.x + deltaX, y: active.y + deltaY };
    preview.current = next;
    if (!liquidPositioned && panelRef.current) applyCssGeometry(panelRef.current, next);
    presentation.syncGlass(next);
  };

  const start = (event: PointerEvent, resizing: boolean) => {
    if (
      event.button !== 0 ||
      (!resizing && event.target instanceof Element && event.target.closest("button"))
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: glass.x,
      y: glass.y,
      width: glass.width,
      height: glass.height,
      resizing,
    };
    preview.current = glass;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    pendingSample.current = { clientX: event.clientX, clientY: event.clientY };
    if (frame.current === null) frame.current = requestAnimationFrame(applyPendingSample);
  };
  const end = (event: PointerEvent) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    if (pendingSample.current) applyPendingSample();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    gesture.current = null;
    store.commitGlassGeometry(glass.id, preview.current);
  };

  return (
    <section
      ref={panelRef}
      className={
        liquidPositioned
          ? "renderer-benchmark__glass"
          : "renderer-benchmark__glass renderer-benchmark__glass--outline"
      }
      data-benchmark-glass={glass.id}
      style={liquidPositioned ? undefined : cssGeometry(glass)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onWheel={(event) => event.stopPropagation()}
    >
      <header
        className="renderer-benchmark__glass-header"
        onPointerDown={(event) => start(event, false)}
      >
        <strong>{liquidPositioned ? "Liquid Glass" : "Glass position"}</strong>
        <span>{glass.role === "small-panel" ? "Small" : "Large"}</span>
      </header>
      <div className="renderer-benchmark__glass-controls">
        <Button size="compact-xs" variant="subtle" onClick={() => store.adjustGlassZ(glass.id, -1)}>
          Z -
        </Button>
        <output aria-label={`Glass Z ${glass.z}`}>{glass.z}</output>
        <Button size="compact-xs" variant="subtle" onClick={() => store.adjustGlassZ(glass.id, 1)}>
          Z +
        </Button>
        <Button size="compact-xs" variant="light" onClick={() => store.toggleGlassRole(glass.id)}>
          Role
        </Button>
      </div>
      <p>Independent Container · drag header · resize corner</p>
      <button
        className="renderer-benchmark__glass-resize"
        aria-label="Resize glass panel"
        onPointerDown={(event) => start(event, true)}
      />
    </section>
  );
}

function cssGeometry(glass: BenchmarkGlassModel): React.CSSProperties {
  return { left: glass.x, top: glass.y, width: glass.width, height: glass.height, zIndex: glass.z };
}

function applyCssGeometry(node: HTMLElement, glass: BenchmarkGlassModel) {
  Object.assign(node.style, {
    left: `${glass.x}px`,
    top: `${glass.y}px`,
    width: `${glass.width}px`,
    height: `${glass.height}px`,
    zIndex: String(glass.z),
  });
}
