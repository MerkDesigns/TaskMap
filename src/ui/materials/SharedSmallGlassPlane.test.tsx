import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MaterialSurface } from "./MaterialSurface";
import {
  readNativeGlassDiagnostics,
  SharedSmallGlassPlane,
  writeSharedSmallGlassShapes,
} from "./SharedSmallGlassPlane";

describe("SharedSmallGlassPlane", () => {
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
    expect(readNativeGlassDiagnostics(container)).toEqual({
      nativeBackdropSurfaceCount: 2,
      nativeBackdropFilterLayerCount: 3,
      sharedSmallPlaneActive: true,
    });
  });

  it("counts a shared card's private backdrop only while it is the live dragged surface", () => {
    const { container } = render(
      <div>
        <SharedSmallGlassPlane />
        <MaterialSurface material="acrylic-small" backdropSource="shared">
          Dragged
        </MaterialSurface>
      </div>,
    );
    const plane = container.querySelector<HTMLElement>("[data-shared-small-glass-plane]")!;
    const card = container.querySelector<HTMLElement>(
      '[data-material="acrylic-small"]:not([data-shared-small-glass-plane])',
    )!;
    writeSharedSmallGlassShapes(plane, [{ x: 12, y: 0, width: 264, height: 84, radius: 13.5 }]);

    expect(readNativeGlassDiagnostics(container).nativeBackdropSurfaceCount).toBe(1);
    card.dataset.materialMotion = "active";
    writeSharedSmallGlassShapes(plane, []);
    expect(readNativeGlassDiagnostics(container)).toEqual({
      nativeBackdropSurfaceCount: 1,
      nativeBackdropFilterLayerCount: 2,
      sharedSmallPlaneActive: false,
    });
  });
});
