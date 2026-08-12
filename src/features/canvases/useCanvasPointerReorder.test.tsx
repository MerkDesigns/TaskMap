import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasId } from "../../domain/ids/entityIds";
import { useCanvasPointerReorder } from "./useCanvasPointerReorder";

const ids = ["canvas-a", "canvas-b", "canvas-c"] as CanvasId[];
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

function Harness({ onCommit }: { readonly onCommit: (order: readonly CanvasId[]) => void }) {
  const reorder = useCanvasPointerReorder(ids, onCommit);
  return (
    <>
      <div data-testid="list">
        {reorder.displayOrder.map((id) => (
          <div
            key={id}
            data-card-id={id}
            ref={(node) => reorder.registerCardNode(id, node)}
            onPointerDown={(event) => reorder.onPointerDown(id, event)}
          >
            {id}
          </div>
        ))}
      </div>
      <button onClick={reorder.cancel}>Cancel drag</button>
    </>
  );
}

function flushFrames() {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(performance.now());
}

beforeEach(() => {
  frames = new Map();
  nextFrame = 1;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const id = this.getAttribute("data-card-id");
    const order = [...(this.parentElement?.children ?? [])];
    const index = id ? order.indexOf(this) : 0;
    const top = Math.max(0, index) * 90;
    return new DOMRect(0, top, 250, 80);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useCanvasPointerReorder", () => {
  it("commits the transient order once after crossing a midpoint", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const first = screen.getByText("canvas-a");
    fireEvent.pointerDown(first, { button: 0, pointerId: 1, clientY: 20 });
    fireEvent.pointerMove(document, { pointerId: 1, clientY: 145 });
    act(flushFrames);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(document, { pointerId: 1, clientY: 145 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith([ids[1], ids[0], ids[2]]);
  });

  it("cancels without committing and restores document order", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    fireEvent.pointerDown(screen.getByText("canvas-a"), {
      button: 0,
      pointerId: 2,
      clientY: 20,
    });
    fireEvent.pointerMove(document, { pointerId: 2, clientY: 145 });
    act(flushFrames);
    fireEvent.click(screen.getByRole("button", { name: "Cancel drag" }));

    expect(onCommit).not.toHaveBeenCalled();
    expect([...screen.getByTestId("list").children].map((node) => node.textContent)).toEqual(ids);
  });
});
