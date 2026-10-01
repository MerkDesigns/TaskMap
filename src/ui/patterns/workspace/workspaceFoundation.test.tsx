import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
    expect(getByTestId("chrome").querySelector("[data-workspace-major-glass]")).not.toBeNull();
    expect(getByTestId("chrome").querySelectorAll(".taskmap-native-glass-backdrop")).toHaveLength(
      1,
    );
    expect(document.documentElement).not.toHaveClass("taskmap-target-theme");
    expect(document.body).not.toHaveClass("taskmap-target-theme");
  });
});
