// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { sessionSetup, unlockTestSession } from "./databaseSessionTestSupport";
import { acceptRetainedDocument } from "./acceptRetainedDocument";
import { createAppStore } from "../store";
import { createCardContainerInput, TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { createCanvasInteractionController } from "../interactions/canvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";

describe("retained acceptance lifecycle and hot-path isolation", () => {
  it("closes and purges a confirmed candidate rejected by workspace feature acceptance", async () => {
    const setup = sessionSetup(acceptRetainedDocument);
    await unlockTestSession(setup);
    expect(setup.controller.getSnapshot().phase).toBe("closed");
    expect(setup.controller.store.getState().documentWorkspace.document).toBeNull();
    expect(setup.client.closeDatabase).toHaveBeenCalledTimes(1);
    expect(setup.purge).toHaveBeenCalled();
    expect(setup.client.saveDocument).not.toHaveBeenCalled();
    await setup.controller.dispose();
  });

  it("admits the existing empty fresh-database factory without feature defaults or conversion", async () => {
    const setup = sessionSetup(acceptRetainedDocument);
    await setup.controller.resume();
    expect((await setup.controller.create("test-token", "test")).ok).toBe(true);
    expect(setup.controller.getSnapshot().phase).toBe("unlocked");
    expect(setup.controller.store.getState().documentWorkspace.document?.elements).toEqual({});
    expect(setup.client.saveDocument).not.toHaveBeenCalled();
    await setup.controller.dispose();
  });

  it("never calls the acceptance gate, serializes or changes history on real camera frames", () => {
    const acceptDocument = vi.fn(acceptRetainedDocument);
    const store = createAppStore({ acceptDocument });
    store.workspace.load(createCardContainerInput(), 4);
    const before = store.getState().documentWorkspace;
    acceptDocument.mockClear();
    const stringify = vi.spyOn(JSON, "stringify");
    const controller = createCanvasInteractionController({
      canvasKey: TEST_IDS.canvasA,
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
      commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder: vi.fn() },
    });
    try {
      controller.beginPan(1, { x: 0, y: 0 });
      for (let frame = 1; frame <= 100; frame++)
        controller.updatePointer({ pointerId: 1, screen: { x: frame, y: frame }, snapping: false });
      controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
      for (let frame = 0; frame < 100; frame++) controller.wheelZoom({ x: 500, y: 400 }, -1);
      expect(acceptDocument).not.toHaveBeenCalled();
      expect(stringify).not.toHaveBeenCalled();
      expect(store.getState().documentWorkspace).toBe(before);
    } finally {
      vi.restoreAllMocks();
      controller.dispose();
      store.disposeWorkspace();
    }
  });
});
