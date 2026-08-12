import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../../app/AppProviders";
import { createAppStore } from "../../app/store";
import { useDevelopmentWorkspaceBootstrap } from "./useDevelopmentWorkspaceBootstrap";

function BootstrapProbe() {
  useDevelopmentWorkspaceBootstrap();
  return null;
}

describe("useDevelopmentWorkspaceBootstrap", () => {
  it("loads one real ephemeral document into an empty development workspace", async () => {
    const store = createAppStore();
    render(
      <AppProviders store={store}>
        <BootstrapProbe />
      </AppProviders>,
    );

    await waitFor(() => expect(store.getState().documentWorkspace.document).not.toBeNull());
    const workspace = store.getState().documentWorkspace;
    expect(workspace.document?.canvasOrder).toHaveLength(1);
    expect(workspace.document?.activeCanvasId).toBe(workspace.document?.canvasOrder[0]);
    expect(workspace.autosavePermitted).toBe(false);
  });
});
