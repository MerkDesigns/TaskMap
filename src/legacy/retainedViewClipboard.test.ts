// @vitest-environment node
import { expect, it, vi } from "vitest";
import { callbackSetup } from "../app/commands/retainedCallbackTestSupport";
import { copyInput } from "../app/commands/retainedCopyTestSupport";
import { containerCardInput } from "../app/commands/retainedContainerCardTestSupport";
import { geometryIds as ids } from "../app/commands/retainedGeometryTestSupport";
import { TEST_IDS } from "../elements/cardContainerTestFixtures";
import { captureRetainedViewCopy, pasteRetainedViewCopy } from "./retainedViewClipboard";

const freshIds = () => {
  let sequence = 7000;
  return { nextUuid: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` };
};

it("copies a container snapshot across canvases with children, then consumes the copy in one transaction", async () => {
  const setup = await callbackSetup(copyInput());
  try {
    const before = setup.store.getState().documentWorkspace.document!;
    const copy = captureRetainedViewCopy(setup.actions, before, [ids.container], () => undefined)!;
    expect(JSON.stringify(copy)).not.toContain('"text":');
    setup.actions
      .captureContent([{ elementId: ids.card, fields: ["text"] }])!
      .complete([{ elementId: ids.card, to: { text: "Changed after copy" } }]);
    setup.actions.switchCanvas(TEST_IDS.canvasB);
    expect(copy.captured.isActive()).toBe(true);
    const historyCount = setup.store.getState().documentWorkspace.history.past.length;
    const { result, inserted } = pasteRetainedViewCopy(
      copy,
      setup.store.getState().documentWorkspace.document!,
      { x: 600, y: 500 },
      freshIds(),
    );
    expect(result).toMatchObject({ ok: true });
    const after = setup.store.getState().documentWorkspace;
    expect(after.history.past).toHaveLength(historyCount + 1);
    const container = inserted.find((entry) => entry.type === "container")!;
    const card = inserted.find((entry) => entry.type === "text-card")!;
    expect(after.document!.elements[card.id].data.text).toBe(before.elements[ids.card].data.text);
    expect(after.document!.elements[card.id].data.placement).toMatchObject({
      containerId: container.id,
    });
    expect(after.document!.elements[container.id].canvasId).toBe(TEST_IDS.canvasB);
    expect(copy.captured.isActive()).toBe(false);
    expect(setup.actions.undo().ok).toBe(true);
    expect(
      setup.store.getState().documentWorkspace.document!.elements[container.id],
    ).toBeUndefined();
  } finally {
    await setup.dispose();
  }
});

it("preserves copied checkbox state and shared card/image ordering on container paste", async () => {
  const setup = await callbackSetup(containerCardInput());
  try {
    const before = setup.store.getState().documentWorkspace.document!;
    const copy = captureRetainedViewCopy(setup.actions, before, [ids.card], () => ({
      x: 120,
      y: 160,
    }))!;
    const { result, inserted } = pasteRetainedViewCopy(
      copy,
      before,
      { x: 500, y: 400 },
      freshIds(),
      { containerId: ids.container, cardIndex: 0 },
    );
    expect(result).toMatchObject({ ok: true });
    const after = setup.store.getState().documentWorkspace.document!;
    expect(after.elements[inserted[0].id].data.placement).toEqual({
      containerId: ids.container,
      order: 0,
    });
    expect(after.elements[ids.card].data.placement).toEqual({
      containerId: ids.container,
      order: 1,
    });
    const checkboxes = Object.values(after.extensionInstallations).filter(
      (entry) =>
        entry.target.kind === "element" &&
        entry.target.elementId === inserted[0].id &&
        entry.extensionId === "checkbox",
    );
    expect(checkboxes).toHaveLength(1);
    expect(checkboxes[0].configuration).toEqual({ checked: true });
  } finally {
    await setup.dispose();
  }
});

it("reports invalidation on history/session loss and keeps Copy free of commands or serialization", async () => {
  const setup = await callbackSetup(copyInput());
  const serialize = vi.spyOn(JSON, "stringify");
  const dispatch = vi.spyOn(setup.store.workspace, "dispatchCommand");
  try {
    const before = setup.store.getState().documentWorkspace;
    for (let index = 0; index < 100; index++) {
      const copy = captureRetainedViewCopy(
        setup.actions,
        before.document,
        [ids.card],
        () => undefined,
      )!;
      expect(copy.captured.isActive()).toBe(true);
      setup.actions.clear();
      expect(copy.captured.isActive()).toBe(false);
    }
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(serialize).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    await setup.dispose();
  }
});
