import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CanvasSnapGuides } from "./CanvasSnapGuides";

describe("CanvasSnapGuides", () => {
  it("draws each guide across the canvas, faded out away from the pointer", () => {
    const { container } = render(
      <CanvasSnapGuides
        guides={[
          { axis: "x", position: 120, pointerPosition: 100 },
          { axis: "y", position: 300, pointerPosition: 2900 },
        ]}
        canvasWidth={3000}
        canvasHeight={2000}
      />,
    );
    const [vertical, horizontal] = [...container.querySelectorAll<HTMLElement>("div")];

    expect(vertical.style).toMatchObject({ left: "120px", height: "2000px" });
    expect(vertical.style.maskImage).toContain("black 0px, black 360px");
    expect(horizontal.style).toMatchObject({ top: "300px", width: "3000px" });
    // The fade stops at the canvas edge.
    expect(horizontal.style.maskImage).toContain("black 2640px, black 3000px");
  });
});
