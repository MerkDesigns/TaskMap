import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BenchmarkCanvasBrowser } from "./BenchmarkCanvasBrowser";
import {
  calculateCanvasBrowserLayout,
  canvasBrowserScrollHeight,
  DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION,
} from "./benchmarkCanvasBrowserLayout";
import type { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";
import { benchmarkCanvasId } from "./benchmarkCanvasIds";

const ids = [0, 1, 2].map(benchmarkCanvasId);

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("BenchmarkCanvasBrowser input and selection", () => {
  it("selects one card and routes card wheel input to browser scrolling", () => {
    const browserHost = document.createElement("div");
    const cardHosts = new Map(
      ids.map((id) => {
        const host = document.createElement("div");
        document.body.append(host);
        return [id, host] as const;
      }),
    );
    document.body.append(browserHost);
    const scrollByWheel = vi.fn();
    const canvasWheel = vi.fn();
    const onSelect = vi.fn();
    const runtime = {
      canvasBrowserHost: browserHost,
      attachCanvasBrowserOrderCommit: () => () => undefined,
      scrollCanvasBrowserByWheel: scrollByWheel,
      getCanvasCardHost: (id: string) => cardHosts.get(id) ?? null,
      beginCanvasCardDrag: vi.fn(),
      consumeSuppressedCanvasCardClick: () => false,
    } as unknown as LiquidSceneBenchmarkRuntime;

    render(
      <div onWheel={canvasWheel}>
        <BenchmarkCanvasBrowser
          canvasCardCount={3}
          canvasCardOrder={ids}
          activeCanvasCardId={ids[0]}
          cardPresentation={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION}
          runtime={runtime}
          onOrderCommit={vi.fn()}
          onSelect={onSelect}
        />
      </div>,
    );
    const activeCard = screen.getByText("Canvas 1").closest("article");
    const nextCard = screen.getByText("Canvas 2").closest("article") as HTMLElement;
    expect(activeCard).toHaveClass("is-active");
    expect(nextCard).not.toHaveClass("is-active");

    fireEvent.wheel(nextCard, { deltaY: 72, deltaMode: 0 });
    fireEvent.click(nextCard);

    expect(scrollByWheel).toHaveBeenCalledWith(72, 0);
    expect(canvasWheel).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(ids[1]);
  });

  it("moves the active indicator on the first click after cards reorder", () => {
    const browserHost = document.createElement("div");
    const cardHosts = new Map(
      ids.map((id) => {
        const host = document.createElement("div");
        document.body.append(host);
        return [id, host] as const;
      }),
    );
    document.body.append(browserHost);
    const runtime = {
      canvasBrowserHost: browserHost,
      attachCanvasBrowserOrderCommit: () => () => undefined,
      scrollCanvasBrowserByWheel: vi.fn(),
      getCanvasCardHost: (id: string) => cardHosts.get(id) ?? null,
      beginCanvasCardDrag: vi.fn(),
      consumeSuppressedCanvasCardClick: () => false,
    } as unknown as LiquidSceneBenchmarkRuntime;

    function SelectionHarness() {
      const [activeId, setActiveId] = useState(ids[0]);
      return (
        <BenchmarkCanvasBrowser
          canvasCardCount={3}
          canvasCardOrder={[ids[2], ids[0], ids[1]]}
          activeCanvasCardId={activeId}
          cardPresentation={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION}
          runtime={runtime}
          onOrderCommit={vi.fn()}
          onSelect={setActiveId}
        />
      );
    }

    render(<SelectionHarness />);
    const previous = screen.getByText("Canvas 1").closest("article") as HTMLElement;
    const selected = screen.getByText("Canvas 2").closest("article") as HTMLElement;
    fireEvent.pointerDown(selected, { button: 0, pointerId: 9, clientY: 200 });
    fireEvent.pointerUp(selected, { button: 0, pointerId: 9, clientY: 200 });
    fireEvent.click(selected);

    expect(selected).toHaveClass("is-active");
    expect(selected).toHaveAttribute("aria-current", "true");
    expect(previous).not.toHaveClass("is-active");
  });
});

describe("BenchmarkCanvasBrowser layout", () => {
  it("fits short card lists and caps long lists at the viewport edge gap", () => {
    expect(calculateCanvasBrowserLayout(900, 1, 0).height).toBe(154);
    expect(calculateCanvasBrowserLayout(900, 2, 0).height).toBe(248);
    expect(canvasBrowserScrollHeight(2)).toBe(178);

    expect(calculateCanvasBrowserLayout(900, 20, 0).height).toBe(868);
  });
});
