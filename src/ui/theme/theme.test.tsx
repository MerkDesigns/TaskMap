import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "./theme.css";
import { WORKSPACE_VISUAL_VALUES } from "./workspaceVisualValues";

afterEach(cleanup);

describe("target theme tokens", () => {
  it("keeps the target theme scoped and preserves the exact foundation and chrome values", () => {
    const { container } = render(<div className="taskmap-target-theme" />);
    const target = getComputedStyle(container.firstElementChild as Element);
    const root = getComputedStyle(document.documentElement);

    expect(root.getPropertyValue("--taskmap-accent")).toBe("");
    expect(target.getPropertyValue("--taskmap-void-bg")).toBe("#0b0b0c");
    expect(target.getPropertyValue("--taskmap-canvas-bg")).toBe("#0f1011");
    expect(target.getPropertyValue("--taskmap-canvas-dot-rgb")).toBe("70 79 96");
    expect(target.getPropertyValue("--taskmap-canvas-line-rgb")).toBe("88 101 124");
    expect(target.getPropertyValue("--taskmap-canvas-line-major-rgb")).toBe("118 136 164");
    expect(target.getPropertyValue("--taskmap-canvas-grid-spacing")).toBe("24px");
    expect(target.getPropertyValue("--taskmap-canvas-grid-major-spacing")).toBe("120px");
    expect(target.getPropertyValue("--taskmap-canvas-grid-major-every")).toBe("5");
    expect(target.getPropertyValue("--taskmap-canvas-line-minor-opacity-scale")).toBe("0.62");
    expect(target.getPropertyValue("--taskmap-canvas-line-major-opacity-scale")).toBe("0.48");
    expect(target.getPropertyValue("--taskmap-canvas-dot-radius")).toBe("1.25px");
    expect(target.getPropertyValue("--taskmap-canvas-dot-opacity-fade-start")).toBe("0.55");
    expect(target.getPropertyValue("--taskmap-canvas-dot-opacity-fade-span")).toBe("0.45");
    expect(target.getPropertyValue("--taskmap-canvas-border")).toBe("rgb(255 255 255 / 0.15)");
    expect(target.getPropertyValue("--taskmap-canvas-shadow")).toBe("0 22px 60px rgb(0 0 0 / 0.3)");
    expect(target.getPropertyValue("--taskmap-container-bg")).toBe("#1b1b1e");
    expect(target.getPropertyValue("--taskmap-accent")).toBe("#e36b55");
    expect(target.getPropertyValue("--taskmap-text")).toBe("rgb(255 255 255 / 0.88)");
    expect(target.getPropertyValue("--taskmap-muted")).toBe("rgb(255 255 255 / 0.45)");
    expect(target.getPropertyValue("--taskmap-font-family")).toBe(
      '"Segoe UI", Inter, system-ui, sans-serif',
    );
    expect(target.getPropertyValue("--taskmap-layer-workspace-chrome")).toBe("41");
    expect(target.getPropertyValue("--taskmap-toolbar-group-padding-inline")).toBe("6px");

    expect(WORKSPACE_VISUAL_VALUES).toMatchObject({
      canvasGridSpacingWorld: 24,
      canvasGridMajorEvery: 5,
      canvasLineMinorOpacityScale: 0.62,
      canvasLineMajorOpacityScale: 0.48,
      canvasDotRadiusScreen: 1.25,
      canvasDotOpacityFadeStart: 0.55,
      canvasDotOpacityFadeSpan: 0.45,
      canvasCornerRadius: 24,
    });
  });

  it("separates chrome aliases from semantic and spatial tokens", () => {
    const { container } = render(<div className="taskmap-target-theme" />);
    const target = getComputedStyle(container.firstElementChild as Element);

    for (const token of [
      "--taskmap-focus",
      "--taskmap-active",
      "--taskmap-selection",
      "--taskmap-switch-on",
      "--taskmap-tab-active",
      "--taskmap-control-accent",
    ]) {
      expect(target.getPropertyValue(token)).toBe("var(--taskmap-accent)");
    }
    expect(target.getPropertyValue("--taskmap-danger")).toBe("#ff4949");
    expect(target.getPropertyValue("--taskmap-link")).toBe("#65d7e4");
    expect(target.getPropertyValue("--taskmap-minimap-element")).toBe("#7aa2c8");
    expect(target.getPropertyValue("--taskmap-minimap-viewport")).toBe("#c8dae8");
  });
});
