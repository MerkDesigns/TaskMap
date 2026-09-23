import { act, cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvasInteractionController } from "../../app/interactions/canvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { LegacyCanvasVisibility } from "./LegacyCanvasVisibility";
import { useLegacyCameraPresentation } from "./useLegacyCameraPresentation";
import { useLegacyInteractionSnapshot } from "./useLegacyInteractionSnapshot";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup() {
  const controller = createCanvasInteractionController({
    canvasKey: "a",
    viewport: createViewport({ x: 0, y: 0 }, 1, { width: 800, height: 600 }),
    commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder: vi.fn() },
  });
  const appRender = vi.fn();
  const chromeRender = vi.fn();
  const elements = [{ id: "far", geometry: { x: 2000, y: 0, width: 100, height: 100 } }];
  const pinnedIds = new Set<string>();
  function Chrome() {
    chromeRender();
    return <div>Static chrome</div>;
  }
  function AppBoundary() {
    appRender();
    const stageRef = useRef<HTMLDivElement>(null);
    const selectionRef = useRef<HTMLDivElement>(null);
    const snapshot = useLegacyInteractionSnapshot(controller);
    useLegacyCameraPresentation(controller, stageRef, selectionRef);
    return (
      <div ref={stageRef} data-testid="stage">
        <Chrome />
        <span data-testid="canvas-key">{snapshot.canvasKey}</span>
        {snapshot.selectionRectangle && <div ref={selectionRef} data-testid="selection" />}
        <LegacyCanvasVisibility controller={controller} elements={elements} pinnedIds={pinnedIds}>
          {(visible) => visible.has("far") && <div>Far element</div>}
        </LegacyCanvasVisibility>
      </div>
    );
  }
  const mounted = render(<AppBoundary />);
  return { controller, appRender, chromeRender, ...mounted };
}

describe("legacy camera presentation isolation", () => {
  it("presents successive pan frames and changes the culled set without rendering App/chrome", () => {
    const { controller, appRender, chromeRender } = setup();
    expect(screen.queryByText("Far element")).not.toBeInTheDocument();
    act(() => controller.beginPan(1, { x: 0, y: 0 }));
    appRender.mockClear();
    chromeRender.mockClear();
    const measurements = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");

    for (let frame = 1; frame <= 100; frame++) {
      act(() =>
        controller.updatePointer({
          pointerId: 1,
          screen: { x: -16 * frame, y: 0 },
          snapping: false,
        }),
      );
    }
    expect(screen.getByText("Far element")).toBeInTheDocument();
    expect(appRender).not.toHaveBeenCalled();
    expect(chromeRender).not.toHaveBeenCalled();
    expect(measurements).not.toHaveBeenCalled();
    expect(screen.getByTestId("stage").style.getPropertyValue("--taskmap-camera-transform")).toBe(
      "translate3d(-1600px, 0px, 0) scale(1)",
    );

    act(() => controller.cancelPointer(1));
    expect(screen.queryByText("Far element")).not.toBeInTheDocument();
    expect(screen.getByTestId("stage").style.getPropertyValue("--taskmap-camera-transform")).toBe(
      "translate3d(0px, 0px, 0) scale(1)",
    );
  });

  it("presents wheel zoom/reset with no App/chrome renders and no geometry reads", () => {
    const { controller, appRender, chromeRender } = setup();
    appRender.mockClear();
    chromeRender.mockClear();
    const measurements = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    for (let frame = 0; frame < 40; frame++) {
      act(() => controller.wheelZoom({ x: 200, y: 200 }, frame < 20 ? -5 : 5));
    }
    act(() => controller.resetZoom());
    expect(controller.getSnapshot().viewport.zoom).toBe(1);
    expect(
      screen.getByTestId("stage").style.getPropertyValue("--taskmap-camera-inverse-zoom"),
    ).toBe("1");
    expect(appRender).not.toHaveBeenCalled();
    expect(chromeRender).not.toHaveBeenCalled();
    expect(measurements).not.toHaveBeenCalled();
  });

  it("keeps a mounted selection aligned when the camera changes without a React render", () => {
    const { controller, appRender } = setup();
    act(() =>
      controller.beginSelection({
        pointerId: 1,
        screen: { x: 10, y: 20 },
        candidates: [],
        additive: false,
      }),
    );
    act(() =>
      controller.updatePointer({ pointerId: 1, screen: { x: 110, y: 100 }, snapping: false }),
    );
    expect(screen.getByTestId("selection")).toHaveStyle({
      left: "10px",
      top: "20px",
      width: "100px",
      height: "80px",
    });
    appRender.mockClear();
    act(() => controller.wheelZoom({ x: 0, y: 0 }, -100));
    const { zoom } = controller.getSnapshot().viewport;
    expect(screen.getByTestId("selection")).toHaveStyle({
      left: `${10 * zoom}px`,
      width: `${100 * zoom}px`,
    });
    expect(appRender).not.toHaveBeenCalled();
  });

  it("adopts replacement canvases and unsubscribes DOM presentation on unmount", () => {
    const { controller, unmount } = setup();
    act(() =>
      controller.replaceCanvas(
        "b",
        createViewport({ x: 70, y: 80 }, 2, { width: 800, height: 600 }),
      ),
    );
    expect(screen.getByTestId("canvas-key")).toHaveTextContent("b");
    const stage = screen.getByTestId("stage");
    expect(stage.style.getPropertyValue("--taskmap-camera-transform")).toBe(
      "translate3d(70px, 80px, 0) scale(2)",
    );
    unmount();
    const write = vi.spyOn(stage.style, "setProperty");
    controller.resetZoom();
    expect(write).not.toHaveBeenCalled();
  });
});
