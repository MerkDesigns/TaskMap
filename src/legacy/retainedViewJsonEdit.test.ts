// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "../app/commands/retainedCallbackTestSupport";
import { aiPayload, containerCardInput } from "../app/commands/retainedContainerCardTestSupport";
import { geometryIds as ids } from "../app/commands/retainedGeometryTestSupport";
import { captureRetainedViewJsonEdit } from "./retainedViewJsonEdit";

it("applies a captured JSON edit with fresh canonical card and companion identities in one transaction", async () => {
  const setup = await callbackSetup(containerCardInput());
  let sequence = 500;
  const idSource = {
    nextUuid: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
  };
  try {
    const before = setup.store.getState().documentWorkspace;
    const edit = captureRetainedViewJsonEdit(
      setup.actions,
      before.document,
      ids.container,
      idSource,
    )!;
    expect(edit.complete("invalid").ok).toBe(false);
    expect(setup.store.getState().documentWorkspace).toBe(before);
    expect(edit.complete(JSON.stringify(aiPayload(3))).ok).toBe(true);
    const after = setup.store.getState().documentWorkspace;
    const cards = Object.values(after.document!.elements).filter(
      (element) => element.type === "text-card",
    );
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((card) => card.id)).size).toBe(3);
    expect(cards.every((card) => card.geometry.width === 1 && card.geometry.height === 1)).toBe(
      true,
    );
    expect(after.history.past).toHaveLength(1);
    expect(setup.actions.undo().ok).toBe(true);
    expect(setup.store.getState().documentWorkspace.document).toEqual(before.document);
  } finally {
    await setup.dispose();
  }
});

it("rejects a clipboard response arriving after session invalidation", async () => {
  const setup = await callbackSetup(containerCardInput());
  try {
    const edit = captureRetainedViewJsonEdit(
      setup.actions,
      setup.store.getState().documentWorkspace.document,
      ids.container,
      { nextUuid: () => "00000000-0000-4000-8000-000000000500" },
    )!;
    setup.actions.clear();
    const before = setup.store.getState().documentWorkspace;
    expect(edit.complete(JSON.stringify(aiPayload(1))).ok).toBe(false);
    expect(setup.store.getState().documentWorkspace).toBe(before);
  } finally {
    await setup.dispose();
  }
});
