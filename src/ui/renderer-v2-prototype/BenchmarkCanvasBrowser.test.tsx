import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BenchmarkCanvasBrowser } from "./BenchmarkCanvasBrowser";
import type { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("BenchmarkCanvasBrowser input and selection", () => {
  it("selects one card and routes card wheel input to browser scrolling", () => {
    const browserHost = document.createElement("div");
    const cardHosts = new Map(
      [0, 1, 2].map((id) => {
        const host = document.createElement("div");
        document.body.append(host);
        return [id, host] as const;
      }),
    );
    document.body.append(browserHost);
    const scrollByWheel = vi.fn();
    const onSelect = vi.fn();
    const runtime = {
      canvasBrowserHost: browserHost,
      attachCanvasBrowserScrollElement: () => () => undefined,
      setCanvasBrowserScroll: vi.fn(),
      scrollCanvasBrowserByWheel: scrollByWheel,
      getCanvasCardHost: (id: number) => cardHosts.get(id) ?? null,
      beginCanvasCardDrag: vi.fn(),
      consumeSuppressedCanvasCardClick: () => false,
    } as unknown as LiquidSceneBenchmarkRuntime;

    render(
      <BenchmarkCanvasBrowser
        canvasCardCount={3}
        canvasCardOrder={[0, 1, 2]}
        activeCanvasCardId={0}
        runtime={runtime}
        onOrderCommit={vi.fn()}
        onSelect={onSelect}
      />,
    );
    const activeCard = screen.getByText("Canvas 1").closest("article");
    const nextCard = screen.getByText("Canvas 2").closest("article") as HTMLElement;
    expect(activeCard).toHaveClass("is-active");
    expect(nextCard).not.toHaveClass("is-active");

    fireEvent.wheel(nextCard, { deltaY: 72, deltaMode: 0 });
    fireEvent.click(nextCard);

    expect(scrollByWheel).toHaveBeenCalledWith(72, 0);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
