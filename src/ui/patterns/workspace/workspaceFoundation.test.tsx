import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TaskCanvas } from "../../../types";
import { projectLegacyBackdropScene } from "../../../legacy/materials/legacyBackdropScene";
import { CanvasFrame } from "./CanvasFrame";
import { WorkspaceBackdropLayer, WorkspaceChromeLayer, WorkspaceRoot } from "./WorkspaceRoot";

afterEach(cleanup);

describe("Phase 4.5C2A workspace foundation", () => {
  it("scopes the target theme and chrome layer to the workspace", () => {
    const { getByTestId } = render(
      <WorkspaceRoot data-testid="workspace">
        <WorkspaceBackdropLayer data-testid="backdrop" />
        <WorkspaceChromeLayer data-testid="chrome" />
      </WorkspaceRoot>,
    );

    expect(getByTestId("workspace")).toHaveClass("taskmap-target-theme", "taskmap-workspace-root");
    expect(getByTestId("chrome")).toHaveClass("taskmap-workspace-chrome-layer");
    expect(getByTestId("backdrop")).toHaveClass("taskmap-workspace-backdrop-layer");
    expect(document.documentElement).not.toHaveClass("taskmap-target-theme");
    expect(document.body).not.toHaveClass("taskmap-target-theme");
  });

  it("keeps visible canvas and BackdropScene background and line colors synchronized", () => {
    const { getByTestId } = render(
      <WorkspaceRoot data-testid="workspace">
        <CanvasFrame data-testid="canvas" data-grid-style="lines" />
      </WorkspaceRoot>,
    );
    const theme = getComputedStyle(getByTestId("workspace"));
    const scene = projectScene("lines", 15);
    const spacing = cssNumber(theme, "--taskmap-canvas-grid-spacing");
    const majorSpacing = cssNumber(theme, "--taskmap-canvas-grid-major-spacing");
    const majorEvery = cssNumber(theme, "--taskmap-canvas-grid-major-every");
    const minorOpacityScale = cssNumber(theme, "--taskmap-canvas-line-minor-opacity-scale");
    const majorOpacityScale = cssNumber(theme, "--taskmap-canvas-line-major-opacity-scale");

    expect(getByTestId("canvas")).toHaveClass("taskmap-canvas-frame");
    expect(scene.background).toEqual({
      cacheFill: theme.getPropertyValue("--taskmap-void-bg"),
      worldFill: theme.getPropertyValue("--taskmap-canvas-bg"),
      worldCornerRadius: cssNumber(theme, "--taskmap-radius-canvas"),
    });
    expect(scene.grid).toMatchObject({
      kind: "lines",
      spacingWorld: spacing,
      majorEvery,
      minorColor: `rgb(${theme.getPropertyValue("--taskmap-canvas-line-rgb")} / ${0.15 * minorOpacityScale})`,
      majorColor: `rgb(${theme.getPropertyValue("--taskmap-canvas-line-major-rgb")} / ${0.15 * majorOpacityScale})`,
    });
    expect(spacing * majorEvery).toBe(majorSpacing);
  });

  it("keeps visible canvas and BackdropScene dot colors synchronized", () => {
    const { getByTestId } = render(<WorkspaceRoot data-testid="workspace" />);
    const theme = getComputedStyle(getByTestId("workspace"));
    const zoom = 0.775;
    const gridOpacity = 0.5;
    const fadeStart = cssNumber(theme, "--taskmap-canvas-dot-opacity-fade-start");
    const fadeSpan = cssNumber(theme, "--taskmap-canvas-dot-opacity-fade-span");
    const opacityScale = Math.min(1, Math.max(0, (zoom - fadeStart) / fadeSpan));
    const dotRadius = cssNumber(theme, "--taskmap-canvas-dot-radius");

    expect(projectScene("dots", 50, zoom).grid).toMatchObject({
      kind: "dots",
      spacingWorld: cssNumber(theme, "--taskmap-canvas-grid-spacing"),
      color: `rgb(${theme.getPropertyValue("--taskmap-canvas-dot-rgb")} / ${gridOpacity * opacityScale})`,
      radiusWorld: dotRadius / zoom,
    });
  });
});

function cssNumber(style: CSSStyleDeclaration, property: string): number {
  return Number.parseFloat(style.getPropertyValue(property));
}

function projectScene(gridStyle: "dots" | "lines", gridOpacityPercent: number, anchorZoom = 1.5) {
  return projectLegacyBackdropScene({
    canvas: emptyCanvas(),
    sceneRevision: 1,
    gridStyle,
    gridOpacityPercent,
    cacheWorldBounds: { x: 0, y: 0, width: 500, height: 400 },
    anchorZoom,
  });
}

function emptyCanvas(): TaskCanvas {
  return {
    id: "workspace-test",
    name: "Workspace test",
    width: 3000,
    height: 3000,
    containers: [],
    textCards: [],
    textBlocks: [],
    images: [],
    mindmapConnections: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
  };
}
