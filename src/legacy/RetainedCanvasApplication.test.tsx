import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RetainedCanvasApplication } from "./RetainedCanvasApplication";
import { createDatabaseEntryPreview } from "../features/database-entry/preview/createDatabaseEntryPreview";

const native = vi.hoisted(() => ({
  invoke: vi.fn(async () => {
    throw new Error("Unexpected native operation");
  }),
}));
vi.mock("@tauri-apps/api/core", () => native);
vi.mock("@tauri-apps/api/app", () => ({ getVersion: async () => "0.3.4" }));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: async () => () => {} }),
}));
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.clearAllMocks();
});

it("creates and switches canvases through the mounted browser and restores them through history", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("preview-token", "test-only");
  await runtime.initializeResources();
  const initialId = runtime.controller.store.getState().documentWorkspace.document!.activeCanvasId;
  const mounted = render(<RetainedCanvasApplication runtime={runtime} />);
  try {
    fireEvent.click(await screen.findByRole("button", { name: "Canvases" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create canvas" }));
    fireEvent.change(await screen.findByPlaceholderText("Canvas name"), {
      target: { value: "  Second  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    let document = runtime.controller.store.getState().documentWorkspace.document!;
    expect(document.canvasOrder).toHaveLength(2);
    const newId = document.activeCanvasId!;
    expect(document.canvases[newId].name).toBe("Second");
    fireEvent.click(screen.getByText("Canvas 1"));
    expect(runtime.controller.store.getState().documentWorkspace.document!.activeCanvasId).toBe(
      initialId,
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    document = runtime.controller.store.getState().documentWorkspace.document!;
    expect(document.canvasOrder).toHaveLength(1);
    expect(document.activeCanvasId).toBe(initialId);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(
      runtime.controller.store.getState().documentWorkspace.document!.canvases[newId].name,
    ).toBe("Second");
    expect(native.invoke).not.toHaveBeenCalled();
  } finally {
    mounted.unmount();
    await runtime.controller.dispose();
  }
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("removes an unsaved editor and its portals before native revocation returns", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("preview-token", "fixture");
  await runtime.initializeResources();
  const mounted = render(<RetainedCanvasApplication runtime={runtime} />);
  try {
    await screen.findByRole("button", { name: "Canvases" });
    fireEvent.contextMenu(mounted.container.querySelector("[data-grid-style]")!, {
      clientX: 500,
      clientY: 300,
    });
    fireEvent.click(await screen.findByRole("button", { name: "Create container" }));
    fireEvent.change(screen.getByDisplayValue("Container 1"), {
      target: { value: "private-unsaved-draft" },
    });
    let pending!: Promise<unknown>;
    act(() => {
      pending = runtime.controller.revokeFromNative();
      expect(document.querySelector('input[value="private-unsaved-draft"]')).toBeNull();
      expect(mounted.container.querySelector("[data-grid-style]")).toBeNull();
      expect(document.querySelector("[data-context-menu]")).toBeNull();
      expect(runtime.controller.store.getState().documentWorkspace.document).toBeNull();
    });
    await act(async () => {
      await pending;
    });
  } finally {
    mounted.unmount();
    await runtime.controller.dispose();
  }
});

it("copies through menus and shortcuts, consumes Paste, and clears availability on history", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("preview-token", "test-only");
  await runtime.initializeResources();
  const mounted = render(<RetainedCanvasApplication runtime={runtime} />);
  try {
    await screen.findByRole("button", { name: "Canvases" });
    const stage = mounted.container.querySelector("[data-grid-style]")!;
    fireEvent.contextMenu(stage, { clientX: 500, clientY: 300 });
    fireEvent.click(await screen.findByRole("button", { name: "Create container" }));
    fireEvent.keyDown(screen.getByDisplayValue("Container 1"), { key: "Enter" });
    fireEvent.click(screen.getByTitle("Container menu"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));
    const before = runtime.controller.store.getState().documentWorkspace;
    fireEvent.contextMenu(stage, { clientX: 800, clientY: 500 });
    fireEvent.click(await screen.findByRole("button", { name: "Paste" }));
    expect(
      Object.values(runtime.controller.store.getState().documentWorkspace.document!.elements),
    ).toHaveLength(2);
    expect(runtime.controller.store.getState().documentWorkspace.history.past).toHaveLength(
      before.history.past.length + 1,
    );
    fireEvent.keyDown(document.body, { key: "v", ctrlKey: true });
    expect(screen.queryByRole("button", { name: "Paste" })).toBeNull();
    fireEvent.keyDown(document.body, { key: "c", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "v", ctrlKey: true });
    expect(
      Object.values(runtime.controller.store.getState().documentWorkspace.document!.elements),
    ).toHaveLength(3);
    fireEvent.keyDown(document.body, { key: "c", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.keyDown(document.body, { key: "v", ctrlKey: true });
    expect(
      Object.values(runtime.controller.store.getState().documentWorkspace.document!.elements),
    ).toHaveLength(2);
    expect(native.invoke).not.toHaveBeenCalled();
  } finally {
    mounted.unmount();
    await runtime.controller.dispose();
  }
});

it("routes settings through document transactions and exits through the session owner", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("preview-token", "test-only");
  await runtime.initializeResources();
  const mounted = render(<RetainedCanvasApplication runtime={runtime} />);
  try {
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    const slider = await screen.findByTitle("Grid opacity");
    Object.defineProperty(slider, "setPointerCapture", { value: () => {} });
    const before = runtime.controller.store.getState().documentWorkspace;
    fireEvent.pointerDown(slider, { pointerId: 1 });
    fireEvent.change(slider, { target: { value: "73" } });
    expect(runtime.controller.store.getState().documentWorkspace).toBe(before);
    fireEvent.keyDown(slider, { key: "Escape" });
    fireEvent.change(slider, { target: { value: "81" } });
    fireEvent.pointerUp(slider, { pointerId: 1 });
    expect(runtime.controller.store.getState().documentWorkspace).toBe(before);
    expect(slider).toHaveValue(String(before.document!.documentSettings.grid.opacityPercent.dots));
    fireEvent.pointerDown(slider, { pointerId: 1 });
    fireEvent.change(slider, { target: { value: "73" } });
    fireEvent.pointerUp(slider, { pointerId: 1 });
    expect(runtime.controller.store.getState().documentWorkspace.history.past).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "misc" }));
    expect(screen.queryByText("Discord status")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "database" }));
    expect(screen.queryByText("Export data")).toBeNull();
    expect(screen.queryByText("Import data")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lock database" }));
    await waitFor(() => expect(mounted.container.querySelector("[data-stage]")).toBeNull());
    await runtime.controller.unlock("test-only");
    expect(
      runtime.controller.store.getState().documentWorkspace.document!.documentSettings.grid
        .opacityPercent.dots,
    ).toBe(73);
    expect(native.invoke).not.toHaveBeenCalled();
  } finally {
    mounted.unmount();
    await runtime.controller.dispose();
  }
});

it("mounts the actual canvas once in StrictMode and routes creation/history without legacy IPC", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("preview-token", "test-only");
  await runtime.initializeResources();
  const mounted = render(
    <StrictMode>
      <RetainedCanvasApplication runtime={runtime} />
    </StrictMode>,
  );
  try {
    await screen.findByRole("button", { name: "Canvases" });
    const stage = mounted.container.querySelector("[data-grid-style]")!;
    fireEvent.contextMenu(stage, { clientX: 500, clientY: 300 });
    fireEvent.click(await screen.findByRole("button", { name: "Create container" }));
    const state = runtime.controller.store.getState().documentWorkspace;
    expect(Object.values(state.document!.elements)).toHaveLength(1);
    expect(state.history.past).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      Object.values(runtime.controller.store.getState().documentWorkspace.document!.elements),
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(
      Object.values(runtime.controller.store.getState().documentWorkspace.document!.elements),
    ).toHaveLength(1);
    const content = mounted.container.querySelector("article [class*='--container-bg']")!;
    fireEvent.contextMenu(content, { clientX: 510, clientY: 380 });
    fireEvent.click(await screen.findByRole("button", { name: "Create text card" }));
    const withCard = runtime.controller.store.getState().documentWorkspace;
    const card = Object.values(withCard.document!.elements).find(
      ({ type }) => type === "text-card",
    )!;
    const container = Object.values(withCard.document!.elements).find(
      ({ type }) => type === "container",
    )!;
    expect(card.data.placement).toEqual({ containerId: container.id, order: 0 });
    expect(withCard.history.past).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      runtime.controller.store.getState().documentWorkspace.document!.elements[card.id],
    ).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(native.invoke).not.toHaveBeenCalled();
    await act(async () => {
      await runtime.controller.lock();
    });
    await waitFor(() => expect(mounted.container.querySelector("[data-stage]")).toBeNull());
    await runtime.controller.unlock("test-only");
    expect(
      runtime.controller.store.getState().documentWorkspace.document!.elements[card.id].data
        .placement,
    ).toEqual({ containerId: container.id, order: 0 });
  } finally {
    mounted.unmount();
    await runtime.controller.dispose();
  }
});
