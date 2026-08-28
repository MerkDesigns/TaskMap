import { StrictMode, useSyncExternalStore } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { createCanvasInteractionController } from "./canvasInteractionController";
import type { CanvasInteractionController } from "./canvasInteractionController";
import { useStableCanvasInteractionController } from "./useStableCanvasInteractionController";

afterEach(cleanup);

describe("stable React interaction-controller ownership", () => {
  it("remains subscribed and usable after the StrictMode effect probe", () => {
    let controller: CanvasInteractionController | undefined;
    const create = vi.fn(() =>
      createCanvasInteractionController({
        canvasKey: "canvas",
        viewport: createViewport({ x: 0, y: 0 }, 1, { width: 100, height: 100 }),
        commitPort: {
          commitMove: vi.fn(),
          commitResize: vi.fn(),
          commitLayerOrder: vi.fn(),
        },
      }),
    );
    function Harness() {
      controller = useStableCanvasInteractionController(create);
      const snapshot = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
        controller.getSnapshot,
      );
      return <output>{snapshot.viewport.screen.width}</output>;
    }

    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    act(() => controller!.resizeViewport({ width: 240, height: 120 }));
    expect(screen.getByText("240")).toBeInTheDocument();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
