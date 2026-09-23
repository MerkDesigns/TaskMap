import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MaterialCompositorProvider } from "./MaterialCompositorProvider";
import { MaterialSurface } from "./MaterialSurface";
import { SharedSmallGlassPlane } from "./SharedSmallGlassPlane";
import { useMaterialSurfaceRegistry } from "./MaterialSurfaceRegistration";

describe("production native glass boundary", () => {
  it("allocates no cached registry and never reads the parked presentation source", () => {
    const read = vi.fn(() => null);
    function Child() {
      expect(useMaterialSurfaceRegistry()).toBeNull();
      return <div>Native child</div>;
    }
    const { unmount } = render(
      <MaterialCompositorProvider presentation={{ getSnapshot: read, subscribe: vi.fn() }}>
        <Child />
      </MaterialCompositorProvider>,
    );
    unmount();
    expect(read).not.toHaveBeenCalled();
  });

  it("uses the same permanent recipe classes and optical constants for standalone and batched Small", () => {
    const { container } = render(
      <>
        <MaterialSurface material="acrylic-small" geometryActive={false}>
          Standalone
        </MaterialSurface>
        <SharedSmallGlassPlane />
      </>,
    );
    const roots = [...container.querySelectorAll<HTMLElement>(".taskmap-native-glass-recipe")];
    expect(roots).toHaveLength(2);
    for (const property of [
      "blur",
      "preblur",
      "saturation",
      "brightness",
      "contrast",
      "tint-rgb",
      "tint-opacity",
      "tone-rgb",
      "tone-opacity",
    ]) {
      const value = roots[0].style.getPropertyValue(`--taskmap-material-${property}`);
      expect(value).not.toBe("");
      expect(roots[1].style.getPropertyValue(`--taskmap-material-${property}`)).toBe(value);
    }
    for (const root of roots) {
      expect(
        root.querySelectorAll(".taskmap-native-glass-preblur[data-enabled='true']"),
      ).toHaveLength(1);
      expect(root.querySelectorAll(".taskmap-native-glass-backdrop")).toHaveLength(1);
      expect(
        root
          .querySelector<HTMLElement>(".taskmap-native-glass-backdrop")!
          .style.getPropertyValue("backdrop-filter"),
      ).toBe("");
    }
  });

  it("preserves the frozen popup finish without legacy feature-owned filter classes", () => {
    const { container } = render(<MaterialSurface material="frosted-popup">Popup</MaterialSurface>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.materialStrategy).toBe("css");
    expect(root.style.getPropertyValue("--taskmap-material-css-backdrop")).toBe("blur(4px)");
    expect(root.style.getPropertyValue("--taskmap-material-fill-opacity")).toBe("0.94");
    expect(root.style.getPropertyValue("--taskmap-material-shadow")).toBe(
      "0px 18px 48px rgb(0 0 0 / 0.48)",
    );
    expect(root.querySelector("canvas")).toBeNull();
  });
});
