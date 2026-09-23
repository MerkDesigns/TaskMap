import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MaterialSurface } from "./MaterialSurface";
import {
  refreshSharedSmallGlassTuning,
  readNativeGlassDiagnostics,
  SharedSmallGlassPlane,
  writeSharedSmallGlassShapes,
} from "./SharedSmallGlassPlane";

describe("SharedSmallGlassPlane", () => {
  it("keeps full-size rounded geometry and stable SVG nodes while changing viewport intersection", () => {
    const { container } = render(<SharedSmallGlassPlane />);
    const plane = container.querySelector<HTMLElement>("[data-shared-small-glass-plane]")!;
    const shape = {
      x: 12,
      y: -80,
      width: 264,
      height: 84,
      radius: 13.5,
      clip: { left: 12, top: 0, width: 264, height: 4 },
    };
    writeSharedSmallGlassShapes(plane, [shape]);
    const rounded = plane.querySelector("[data-shared-small-glass-clip] > rect")!;
    const viewport = plane.querySelector("[data-glass-viewport-clip] > rect")!;
    expect(rounded).toHaveAttribute("height", "84");
    expect(rounded).toHaveAttribute("rx", "13.5");
    expect(viewport).toHaveAttribute("height", "4");
    expect(rounded).toHaveAttribute("clip-path", `url(#${viewport.parentElement!.id})`);
    writeSharedSmallGlassShapes(plane, [{ ...shape, y: -82, clip: { ...shape.clip, height: 2 } }]);
    expect(plane.querySelector("[data-shared-small-glass-clip] > rect")).toBe(rounded);
    expect(plane.querySelector("[data-glass-viewport-clip] > rect")).toBe(viewport);
    expect(rounded).toHaveAttribute("height", "84");
    expect(rounded).toHaveAttribute("rx", "13.5");
    expect(viewport).toHaveAttribute("height", "2");
    writeSharedSmallGlassShapes(plane, []);
    expect(plane.querySelector("[data-glass-viewport-clip]")).toBeNull();
  });

  it("updates shared-plane overscan from the live Small blur override", () => {
    const { container } = render(<SharedSmallGlassPlane />);
    const plane = container.querySelector<HTMLElement>("[data-shared-small-glass-plane]")!;
    plane.style.setProperty("--taskmap-material-small-blur-override", "32px");

    refreshSharedSmallGlassTuning(plane);

    expect(plane.style.getPropertyValue("--taskmap-shared-small-overscan")).toBe("111px");
  });

  it("reuses one active backdrop for multiple rounded Small surface clips", () => {
    const { container } = render(
      <div>
        <SharedSmallGlassPlane />
        <MaterialSurface material="acrylic-small" backdropSource="shared">
          Shared A
        </MaterialSurface>
        <MaterialSurface material="acrylic-small" backdropSource="shared">
          Shared B
        </MaterialSurface>
        <MaterialSurface material="acrylic-large">Large</MaterialSurface>
      </div>,
    );
    const plane = container.querySelector<HTMLElement>("[data-shared-small-glass-plane]")!;

    writeSharedSmallGlassShapes(plane, [
      { x: 12, y: 0, width: 264, height: 84, radius: 13.5 },
      { x: 12, y: 94, width: 264, height: 6, radius: 13.5 },
    ]);

    const clips = plane.querySelectorAll("rect");
    expect(clips).toHaveLength(2);
    expect(clips[0]).toHaveAttribute("rx", "13.5");
    expect(clips[1]).toHaveAttribute("height", "6");
    expect(clips[1]).toHaveAttribute("rx", "3");
    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      activeDepthCount: 2,
      activeGlassBatchCount: 1,
      localMaterialBackdropFilterCount: 1,
      nativeBackdropSurfaceCount: 2,
      nativeBackdropFilterLayerCount: 4,
      sharedSmallBatchCount: 1,
      sharedSmallPlaneActive: true,
      temporaryDragBatchActive: false,
    });
  });

  it("adds one optically identical shared-style batch for the actual moving card", () => {
    const { container } = render(
      <div>
        <SharedSmallGlassPlane />
        <SharedSmallGlassPlane batchId="drag" kind="small-drag" />
        <MaterialSurface material="acrylic-small" backdropSource="shared">
          Dragged
        </MaterialSurface>
      </div>,
    );
    const [plane, dragPlane] = container.querySelectorAll<HTMLElement>(
      "[data-shared-small-glass-plane]",
    );
    const card = container.querySelector<HTMLElement>(
      '[data-material="acrylic-small"]:not([data-shared-small-glass-plane])',
    )!;
    writeSharedSmallGlassShapes(plane, [{ x: 12, y: 0, width: 264, height: 84, radius: 13.5 }]);

    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      nativeBackdropSurfaceCount: 1,
      nativeBackdropFilterLayerCount: 2,
    });
    card.dataset.materialMotion = "active";
    writeSharedSmallGlassShapes(dragPlane, [
      { x: 12, y: 94, width: 264, height: 84, radius: 13.5 },
    ]);
    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      nativeBackdropSurfaceCount: 2,
      nativeBackdropFilterLayerCount: 4,
      localMaterialBackdropFilterCount: 0,
      sharedSmallBatchCount: 2,
      sharedSmallPlaneActive: true,
      temporaryDragBatchActive: true,
    });
  });
});
