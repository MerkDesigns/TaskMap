// @vitest-environment node
import type { RetainedExtensionKey } from "../extensions/retainedExtensionDefinition";
import { expect, it } from "vitest";
import { callbackSetup } from "../app/commands/retainedCallbackTestSupport";
import { geometryIds as ids } from "../app/commands/retainedGeometryTestSupport";
import { installRetainedViewExtension } from "./retainedViewExtensions";

it("installs aliases with registry compatibility in one transaction and skips existing installations", async () => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace.document!;
  const idSource = { nextUuid: () => "00000000-0000-4000-8000-000000000999" };
  try {
    expect(
      installRetainedViewExtension(
        setup.actions,
        before,
        "checkbox",
        [ids.card, ids.container],
        idSource,
      ),
    ).toBe(true);
    const after = setup.store.getState().documentWorkspace;
    const installed = Object.values(after.document!.extensionInstallations).filter(
      (entry) => entry.extensionId === "checkbox",
    );
    expect(installed).toHaveLength(1);
    expect(installed[0].target).toEqual({ kind: "element", elementId: ids.card });
    expect(after.history.past).toHaveLength(1);
    expect(
      installRetainedViewExtension(setup.actions, after.document, "checkbox", [ids.card], idSource),
    ).toBe(true);
    expect(setup.store.getState().documentWorkspace.document).toBe(after.document);
    expect(setup.actions.undo().ok).toBe(true);
    expect(setup.store.getState().documentWorkspace.document).toEqual(before);
  } finally {
    await setup.dispose();
  }
});

it("cannot install removed extensions", async () => {
  const setup = await callbackSetup();
  const before = setup.store.getState().documentWorkspace.document!;
  try {
    for (const key of [
      "commandRunner",
      "dailyReset",
      "pickCard",
    ] as unknown as RetainedExtensionKey[])
      expect(
        installRetainedViewExtension(setup.actions, before, key, [ids.card], {
          nextUuid: () => {
            throw new Error("No IDs for removed extensions");
          },
        }),
      ).toBe(false);
    expect(setup.store.getState().documentWorkspace.document).toBe(before);
  } finally {
    await setup.dispose();
  }
});
