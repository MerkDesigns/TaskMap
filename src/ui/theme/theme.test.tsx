import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "./theme.css";

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
    expect(target.getPropertyValue("--taskmap-canvas-border")).toBe("rgb(255 255 255 / 0.15)");
    expect(target.getPropertyValue("--taskmap-container-bg")).toBe("#1b1b1e");
    expect(target.getPropertyValue("--taskmap-accent")).toBe("#d87a2d");
    expect(target.getPropertyValue("--taskmap-text")).toBe("rgb(255 255 255 / 0.88)");
    expect(target.getPropertyValue("--taskmap-muted")).toBe("rgb(255 255 255 / 0.45)");
    expect(target.getPropertyValue("--taskmap-font-family")).toBe(
      '"Segoe UI", Inter, system-ui, sans-serif',
    );
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
