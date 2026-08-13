import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";

interface Props {
  readonly canvasCardCount: number;
  readonly canvasCardOrder: readonly number[];
  readonly activeCanvasCardId: number;
  readonly runtime: LiquidSceneBenchmarkRuntime;
  readonly onOrderCommit: (order: readonly number[]) => void;
  readonly onSelect: (id: number) => void;
}

export function BenchmarkCanvasBrowser({
  canvasCardCount,
  canvasCardOrder,
  activeCanvasCardId,
  runtime,
  onOrderCommit,
  onSelect,
}: Props) {
  useLayoutEffect(() => {
    return runtime.attachCanvasBrowserOrderCommit(onOrderCommit);
  }, [onOrderCommit, runtime]);

  const browser = (
    <section
      className="renderer-benchmark__canvas-browser"
      aria-label="Canvas Browser"
      data-benchmark-glass="canvas-browser"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        runtime.scrollCanvasBrowserByWheel(event.deltaY, event.deltaMode);
      }}
    >
      <header className="renderer-benchmark__canvas-browser-header">
        <div>
          <strong>Canvas Browser</strong>
          <span>{canvasCardCount} Canvas Cards</span>
        </div>
        <output>{canvasCardCount}</output>
      </header>
      <div className="renderer-benchmark__canvas-browser-scroll" aria-label="Canvas Cards" />
    </section>
  );

  return (
    <>
      {createPortal(browser, runtime.canvasBrowserHost)}
      {canvasCardOrder.map((id) => {
        const host = runtime.getCanvasCardHost(id);
        return host
          ? createPortal(
              <BenchmarkCanvasCardContent
                id={id}
                active={id === activeCanvasCardId}
                runtime={runtime}
                onSelect={onSelect}
              />,
              host,
            )
          : null;
      })}
    </>
  );
}

function BenchmarkCanvasCardContent({
  id,
  active,
  runtime,
  onSelect,
}: {
  id: number;
  active: boolean;
  runtime: LiquidSceneBenchmarkRuntime;
  onSelect: (id: number) => void;
}) {
  return (
    <article
      className={`renderer-benchmark__canvas-card ${active ? "is-active" : ""}`}
      data-benchmark-canvas-card={id + 1}
      data-benchmark-glass="canvas-card"
      aria-current={active ? "true" : undefined}
      onPointerDown={(event) => {
        event.stopPropagation();
        runtime.beginCanvasCardDrag(id, event.nativeEvent, event.currentTarget);
      }}
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        runtime.scrollCanvasBrowserByWheel(event.deltaY, event.deltaMode);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (!runtime.consumeSuppressedCanvasCardClick(id)) onSelect(id);
      }}
    >
      <span className="renderer-benchmark__canvas-card-active" />
      <svg viewBox="0 0 96 58" aria-hidden="true">
        <rect width="96" height="58" rx="6" className="renderer-benchmark__canvas-card-bg" />
        <rect x="12" y="11" width="31" height="16" rx="3" />
        <rect x="49" y="18" width="33" height="25" rx="3" />
        <rect x="19" y="34" width="24" height="11" rx="3" />
      </svg>
      <div>
        <strong>Canvas {id + 1}</strong>
        <span>{active ? "Active canvas" : "TaskMap canvas"}</span>
      </div>
    </article>
  );
}
