import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FROSTED_SURFACE_CLASS, FrostedSurface } from "./FrostedSurface";

afterEach(cleanup);

describe("FrostedSurface", () => {
  it("renders children and applies one stable root class", () => {
    const { container } = render(
      <FrostedSurface className="feature-panel">
        <span>Surface content</span>
      </FrostedSurface>,
    );

    const root = container.firstElementChild;
    expect(screen.getByText("Surface content")).toBeInTheDocument();
    expect(root).toHaveClass(FROSTED_SURFACE_CLASS);
    expect(root).toHaveClass("feature-panel");
    expect(root?.querySelectorAll(`.${FROSTED_SURFACE_CLASS}`)).toHaveLength(0);
  });
});
