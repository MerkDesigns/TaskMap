import { StrictMode, useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDatabaseEntryPreview } from "../../features/database-entry/preview/createDatabaseEntryPreview";
import { DatabaseSessionGate } from "../../features/database-entry/DatabaseSessionGate";
import type { RetainedCanvasContextValue } from "../../legacy/RetainedCanvasContext";
import DevelopmentVisualWorkbench from "./DevelopmentVisualWorkbench";

const probe = vi.hoisted(() => ({
  keys: vi.fn(),
  binding: null as RetainedCanvasContextValue["binding"] | null,
}));
// Keep the real session, gate and canvas-binding lifetime; only replace the large presentation tree.
vi.mock("../../App", () => ({
  default: function CanvasProbe({ retained }: { retained: RetainedCanvasContextValue }) {
    probe.binding = retained.binding;
    useEffect(() => {
      window.addEventListener("keydown", probe.keys);
      return () => window.removeEventListener("keydown", probe.keys);
    }, []);
    return <div>Admitted canvas renderer</div>;
  },
}));
vi.mock("../../ui-lab/UiLabApp", () => ({ UiLabApp: () => <div>Synthetic Lab scene</div> }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("switches real bindings without replacing session, document, history or remembered camera", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("fixture", "test-only");
  await runtime.initializeResources();
  const initial = runtime.controller.store.getState().documentWorkspace.document!.documentSettings;
  expect(
    runtime.callbacks
      .captureDocumentSettings(["minimapEnabled"])
      ?.complete({ minimapEnabled: !initial.minimapEnabled }).ok,
  ).toBe(true);
  await runtime.controller.store.workspace.flushSave();
  const dispose = vi.spyOn(runtime.controller, "dispose");
  const close = vi.spyOn(runtime.controller, "close");
  const view = render(
    <StrictMode>
      <DevelopmentVisualWorkbench runtime={runtime} />
    </StrictMode>,
  );
  try {
    await screen.findByText("Admitted canvas renderer");
    const controller = probe.binding!.interaction;
    controller.beginPan(1, { x: 0, y: 0 });
    controller.completePointer({ pointerId: 1, screen: { x: 40, y: 60 }, snapping: false });
    const camera = controller.getSnapshot().viewport;
    const before = runtime.controller.store.getState().documentWorkspace;
    const session = runtime.controller.getSnapshot();
    expect(before.history.past).toHaveLength(1);
    const preferences = runtime.preferences.getSnapshot();
    for (let index = 0; index < 3; index++) {
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "UI Lab" })));
      expect(screen.queryByText("Admitted canvas renderer")).not.toBeInTheDocument();
      expect(probe.binding!.getSnapshot().phase).toBe("revoked");
      probe.keys.mockClear();
      fireEvent.keyDown(window, { key: "Delete" });
      expect(probe.keys).not.toHaveBeenCalled();
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "App" })));
      await screen.findByText("Admitted canvas renderer");
      expect(probe.binding!.interaction.getSnapshot().viewport).toEqual(camera);
      expect(runtime.controller.store.getState().documentWorkspace).toBe(before);
      expect(runtime.controller.getSnapshot()).toBe(session);
      expect(runtime.preferences.getSnapshot()).toBe(preferences);
    }
    expect(close).not.toHaveBeenCalled();
    expect(dispose).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    await act(async () => {});
    await runtime.controller.dispose();
  }
});

it("keeps tuning across views and removes the Lab and overrides on session lock", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("fixture", "test-only");
  const property = "--taskmap-material-large-blur-override";
  document.documentElement.style.setProperty(property, "61px");
  const view = render(
    <DatabaseSessionGate runtime={runtime}>
      <DevelopmentVisualWorkbench runtime={runtime} />
    </DatabaseSessionGate>,
  );
  try {
    await screen.findByText("Admitted canvas renderer");
    fireEvent.click(screen.getByText("Tuning & diagnostics"));
    const before = runtime.controller.store.getState().documentWorkspace;
    fireEvent.change(screen.getByLabelText("Major blur"), { target: { value: "30" } });
    fireEvent.click(screen.getByLabelText(/Material bounds/));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "UI Lab" })));
    expect(document.documentElement.style.getPropertyValue(property)).toBe("30px");
    expect(runtime.controller.store.getState().documentWorkspace).toBe(before);
    expect(screen.getByLabelText("Major blur")).toHaveValue("30");
    await act(async () => {
      expect((await runtime.controller.lock()).ok).toBe(true);
    });
    await waitFor(() => expect(screen.queryByText("Synthetic Lab scene")).not.toBeInTheDocument());
    expect(
      screen.queryByRole("complementary", { name: "Development workbench" }),
    ).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue(property)).toBe("61px");
    expect(document.documentElement).not.toHaveClass("taskmap-debug-material-bounds");
  } finally {
    view.unmount();
    document.documentElement.style.removeProperty(property);
    await runtime.controller.dispose();
  }
});
