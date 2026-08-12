import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvasCameraSession } from "./interaction/canvasCameraSession";
import { RendererV2CanvasViewport } from "./RendererV2CanvasViewport";

let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  frames = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function flushFrames() {
  const pending = frames;
  frames = [];
  for (const frame of pending) frame(performance.now());
}

describe("RendererV2CanvasViewport camera session", () => {
  it("restores a separate transient camera when the active canvas changes", () => {
    const session = createCanvasCameraSession();
    session.set("canvas-a", { pan: { x: 24, y: -12 }, zoom: 1.25 });
    session.set("canvas-b", { pan: { x: -90, y: 60 }, zoom: 0.75 });
    const view = render(
      <RendererV2CanvasViewport activeCanvasId="canvas-a" cameraSession={session} />,
    );
    const world = view.container.querySelector(".taskmap-renderer-v2-canvas-world") as HTMLElement;
    expect(world.style.transform).toBe("translate3d(24px, -12px, 0) scale(1.25)");

    view.rerender(<RendererV2CanvasViewport activeCanvasId="canvas-b" cameraSession={session} />);
    act(flushFrames);
    expect(world.style.transform).toBe("translate3d(-90px, 60px, 0) scale(0.75)");

    view.rerender(<RendererV2CanvasViewport activeCanvasId="canvas-a" cameraSession={session} />);
    act(flushFrames);
    expect(world.style.transform).toBe("translate3d(24px, -12px, 0) scale(1.25)");
  });
});
