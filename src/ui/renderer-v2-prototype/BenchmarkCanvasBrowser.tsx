import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { BenchmarkCanvasCardPresentation } from "./benchmarkCanvasBrowserLayout";
import type { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";

interface Props {
  readonly canvasCardCount: number;
  readonly canvasCardOrder: readonly number[];
  readonly activeCanvasCardId: number;
  readonly cardPresentation: BenchmarkCanvasCardPresentation;
  readonly runtime: LiquidSceneBenchmarkRuntime;
  readonly onOrderCommit: (order: readonly number[]) => void;
  readonly onSelect: (id: number) => void;
}

export function BenchmarkCanvasBrowser({
  canvasCardCount,
  canvasCardOrder,
  activeCanvasCardId,
  cardPresentation,
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
                cardPresentation={cardPresentation}
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
  cardPresentation,
  runtime,
  onSelect,
}: {
  id: number;
  active: boolean;
  cardPresentation: BenchmarkCanvasCardPresentation;
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
      <svg viewBox="0 0 96 54" aria-hidden="true">
        <rect x="12" y="11" width="31" height="16" rx="3" />
        <rect x="49" y="18" width="33" height="25" rx="3" />
        <rect x="19" y="34" width="24" height="11" rx="3" />
      </svg>
      <div className="renderer-benchmark__canvas-card-copy">
        <strong>{formatCardText(cardPresentation.largeText, id, active)}</strong>
        <span>{formatCardText(cardPresentation.smallText, id, active)}</span>
      </div>
      <button
        type="button"
        className="renderer-benchmark__canvas-card-options"
        aria-label={`Canvas ${id + 1} options`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="renderer-benchmark__canvas-card-options-dots" aria-hidden="true" />
      </button>
    </article>
  );
}

function formatCardText(template: string, id: number, active: boolean) {
  return template
    .split("{number}")
    .join(String(id + 1))
    .split("{status}")
    .join(active ? "Active" : "TaskMap");
}
