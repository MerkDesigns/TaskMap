import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it } from "vitest";
import { createDatabaseEntryPreview } from "../features/database-entry/preview/createDatabaseEntryPreview";
import { RetainedCanvasContext } from "./RetainedCanvasContext";
import { useRetainedCanvasSettings } from "./useRetainedCanvasSettings";

async function setup() {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("fixture", "test-only");
  await runtime.initializeResources();
  const binding = runtime.bindCanvas({
    viewport: { pan: { x: 0, y: 0 }, zoom: 1, screen: { width: 1000, height: 800 } },
    onRevoke() {},
  });
  const value = { runtime, binding };
  const hook = renderHook(useRetainedCanvasSettings, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <RetainedCanvasContext.Provider value={value}>{children}</RetainedCanvasContext.Provider>
    ),
  });
  return {
    runtime,
    hook,
    dispose: async () => {
      hook.unmount();
      binding.dispose();
      await runtime.controller.dispose();
    },
  };
}

it("keeps 100 opacity previews out of document/history and commits one transaction on release", async () => {
  const test = await setup();
  try {
    const before = test.runtime.controller.store.getState().documentWorkspace;
    act(() => test.hook.result.current.gridOpacityEdit!.begin());
    for (let value = 0; value < 100; value++)
      act(() =>
        test.hook.result.current.setCanvasGridOpacity((current) => ({ ...current, dots: value })),
      );
    expect(test.hook.result.current.canvasGridOpacity.dots).toBe(99);
    expect(test.runtime.controller.store.getState().documentWorkspace).toBe(before);
    act(() => test.hook.result.current.gridOpacityEdit!.commit());
    const after = test.runtime.controller.store.getState().documentWorkspace;
    expect(after.history.past).toHaveLength(1);
    expect(after.document!.documentSettings.grid.opacityPercent.dots).toBe(99);
    act(() => {
      test.runtime.callbacks.undo();
    });
    expect(test.hook.result.current.canvasGridOpacity.dots).toBe(
      before.document!.documentSettings.grid.opacityPercent.dots,
    );
  } finally {
    await test.dispose();
  }
});

it("cancels slider previews and keeps device edits outside document history", async () => {
  const test = await setup();
  try {
    const before = test.runtime.controller.store.getState().documentWorkspace;
    act(() => test.hook.result.current.gridOpacityEdit!.begin());
    act(() =>
      test.hook.result.current.setCanvasGridOpacity((current) => ({ ...current, dots: 12 })),
    );
    act(() => test.hook.result.current.gridOpacityEdit!.cancel());
    expect(test.runtime.controller.store.getState().documentWorkspace).toBe(before);
    expect(test.hook.result.current.canvasGridOpacity.dots).toBe(
      before.document!.documentSettings.grid.opacityPercent.dots,
    );
    await act(async () => {
      test.hook.result.current.setRecentColors((current) => [...current, "#123456"]);
      test.hook.result.current.setRecentColors((current) => [...current, "#abcdef"]);
      test.hook.result.current.setToolbarButtonsVisible(true);
      await test.runtime.preferences.flush();
    });
    expect(test.hook.result.current.recentColors).toEqual(["#123456", "#abcdef"]);
    expect(test.hook.result.current.toolbarButtonsVisible).toBe(true);
    expect(test.runtime.controller.store.getState().documentWorkspace).toBe(before);
  } finally {
    await test.dispose();
  }
});
