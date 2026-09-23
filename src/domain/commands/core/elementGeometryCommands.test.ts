// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  COMMAND_TEST_IDS as ids,
  createCommandTestDocument,
  executeTestCommand,
} from "../commandTestSupport";

function fixture() {
  const document = createCommandTestDocument();
  const updates = [ids.elementA, ids.elementB].map((elementId) => ({
    elementId,
    from: document.elements[elementId].geometry,
    to: { ...document.elements[elementId].geometry, x: 99, y: 101 },
  }));
  const command = {
    type: "document.elements.update-geometry",
    payload: { canvasId: ids.canvasA, updates },
  };
  return { document, command };
}

describe("completed group geometry command", () => {
  it("updates a group in one transaction without touching order, data or document settings", () => {
    const { document, command } = fixture();
    const before = structuredClone(command);
    const stringify = vi.spyOn(JSON, "stringify");
    const result = executeTestCommand(document, command);
    expect(stringify).not.toHaveBeenCalled();
    stringify.mockRestore();
    expect(result.ok).toBe(true);
    expect(result.transaction?.patches).toHaveLength(2);
    expect(
      result.transaction?.patches.every(
        ({ path }) => path[0] === "elements" && path[2] === "geometry",
      ),
    ).toBe(true);
    for (const update of command.payload.updates) {
      expect(result.document.elements[update.elementId].geometry).toEqual(update.to);
      expect(document.elements[update.elementId].geometry).toEqual(update.from);
      expect(result.document.elements[update.elementId].data).toBe(
        document.elements[update.elementId].data,
      );
    }
    expect(result.document.canvases).toBe(document.canvases);
    expect(result.document.documentSettings).toBe(document.documentSettings);
    expect(command).toEqual(before);
  });
  it("does not create a transaction for equal geometry", () => {
    const { document, command } = fixture();
    command.payload.updates = command.payload.updates.map((update) => ({
      ...update,
      to: { ...update.from },
    }));
    const result = executeTestCommand(document, command);
    expect(result).toMatchObject({ ok: true, transaction: null });
    expect(result.document).toBe(document);
  });
  it.each(["duplicate", "missing", "other-canvas", "stale", "invalid", "unknown-field", "empty"])(
    "rejects %s atomically",
    (kind) => {
      const { document, command } = fixture();
      if (kind === "duplicate") command.payload.updates[1] = command.payload.updates[0];
      if (kind === "missing") command.payload.updates[1].elementId = ids.elementC;
      if (kind === "other-canvas") command.payload.canvasId = ids.canvasB;
      if (kind === "stale")
        command.payload.updates[1].from = { ...command.payload.updates[1].from, x: 123456 };
      if (kind === "invalid") command.payload.updates[1].to.width = -1;
      if (kind === "unknown-field")
        Object.assign(command.payload.updates[1], { data: { text: "not a geometry edit" } });
      if (kind === "empty") command.payload.updates = [];
      const result = executeTestCommand(document, command);
      expect(result.ok).toBe(false);
      expect(result.document).toBe(document);
      expect(result.transaction).toBeNull();
    },
  );
});
