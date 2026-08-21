import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FrostedGlassTuner, type WorkspaceGeometryValues } from "./FrostedGlassTuner";

afterEach(cleanup);

describe("FrostedGlassTuner geometry controls", () => {
  it("edits panel radii and independent side/top edge gaps", () => {
    const geometryValues: WorkspaceGeometryValues = {
      canvasBrowserRadius: 22.5,
      canvasCardRadius: 13.5,
      topBarRadius: 16,
      sideInset: 16,
      topInset: 16,
    };
    const onGeometryChange = vi.fn();

    render(
      <FrostedGlassTuner
        frostedValues={{
          bgOpacity: 0,
          bgBrightness: 0,
          borderOpacity: 0.16,
          blur: 4,
          shadowOpacity: 0.55,
          shadowY: 10,
          shadowBlur: 32,
        }}
        cardValues={{ bgOpacity: 1, outlineOpacity: 0.13 }}
        geometryValues={geometryValues}
        onFrostedChange={vi.fn()}
        onCardChange={vi.fn()}
        onGeometryChange={onGeometryChange}
      />,
    );

    const changes = [
      ["Canvas Browser radius", "28", "canvasBrowserRadius", 28],
      ["Canvas card radius", "16", "canvasCardRadius", 16],
      ["Top bars radius", "18", "topBarRadius", 18],
      ["Side edge gap", "24", "sideInset", 24],
      ["Top edge gap", "8", "topInset", 8],
    ] as const;

    changes.forEach(([label, value, key, expected], index) => {
      fireEvent.change(screen.getByRole("slider", { name: new RegExp(label) }), {
        target: { value },
      });
      expect(onGeometryChange).toHaveBeenNthCalledWith(index + 1, {
        ...geometryValues,
        [key]: expected,
      });
    });
  });
});
