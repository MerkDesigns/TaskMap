// @vitest-environment node
import { applyPatches } from "immer";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { asEntityId } from "../ids/entityIds";
import { commandRejected, defineCommandHandler } from "./commandHandler";
import { createCommandHandlerRegistry, DuplicateCommandRegistrationError } from "./commandRegistry";
import { createCommandTestDocument, COMMAND_TEST_IDS } from "./commandTestSupport";
import { coreDocumentCommandHandlers } from "./core/coreDocumentCommandHandlers";
import { executeDocumentCommand } from "./executeDocumentCommand";

const dependencies = {
  nextTransactionId: () => asEntityId("transaction", COMMAND_TEST_IDS.transaction),
  now: () => 123_456,
};

describe("document command execution", () => {
  it("dispatches a known handler and injects transaction metadata", () => {
    const document = createCommandTestDocument();
    const result = executeDocumentCommand(
      createCommandHandlerRegistry(coreDocumentCommandHandlers),
      dependencies,
      {
        type: "document.canvas.rename",
        payload: { canvasId: COMMAND_TEST_IDS.canvasA, name: "Private user title" },
      },
      document,
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.transaction === null) throw new Error("Expected transaction");
    expect(result.document.canvases[COMMAND_TEST_IDS.canvasA].name).toBe("Private user title");
    expect(result.transaction).toMatchObject({
      id: COMMAND_TEST_IDS.transaction,
      committedAt: 123_456,
      label: "Rename canvas",
    });
    expect(result.transaction.label).not.toContain("Private user title");
    expect(applyPatches(document, result.transaction.patches)).toEqual(result.document);
    expect(applyPatches(result.document, result.transaction.inversePatches)).toEqual(document);
  });

  it("returns typed issues for unknown commands and malformed payloads", () => {
    const document = createCommandTestDocument();
    const registry = createCommandHandlerRegistry(coreDocumentCommandHandlers);
    const unknown = executeDocumentCommand(
      registry,
      dependencies,
      { type: "document.unknown", payload: {} },
      document,
    );
    const malformed = executeDocumentCommand(
      registry,
      dependencies,
      { type: "document.canvas.rename", payload: { canvasId: "bad", name: "Okay" } },
      document,
    );

    expect(unknown.ok).toBe(false);
    expect(unknown.ok ? [] : unknown.issues).toContainEqual(
      expect.objectContaining({ code: "unknown-command", path: "command.type" }),
    );
    expect(malformed.ok).toBe(false);
    expect(malformed.ok ? [] : malformed.issues).toContainEqual(
      expect.objectContaining({
        code: "command-payload",
        path: "command.payload.canvasId",
      }),
    );
  });

  it("rejects duplicate registrations deterministically", () => {
    const handler = coreDocumentCommandHandlers[0];
    expect(() => createCommandHandlerRegistry([handler, handler])).toThrowError(
      DuplicateCommandRegistrationError,
    );
    expect(() => createCommandHandlerRegistry([handler, handler])).toThrow(
      "document.canvas.create",
    );
  });

  it("does not mutate the input document or command payload", () => {
    const document = createCommandTestDocument();
    const payload = { elementId: COMMAND_TEST_IDS.elementA, data: { nested: { count: 2 } } };
    const beforeDocument = structuredClone(document);
    const beforePayload = structuredClone(payload);
    const result = executeDocumentCommand(
      createCommandHandlerRegistry(coreDocumentCommandHandlers),
      dependencies,
      { type: "document.element.replace-data", payload },
      document,
    );

    expect(result.ok).toBe(true);
    expect(document).toEqual(beforeDocument);
    expect(payload).toEqual(beforePayload);
    expect(result.document).not.toBe(document);
  });

  it("fails atomically when a handler rejects or throws", () => {
    const rejecting = defineCommandHandler({
      type: "test.reject",
      label: "Reject",
      history: "record",
      payloadSchema: z.object({}).strict(),
      apply(document) {
        document.activeCanvasId = null;
        return [commandRejected("command", "Rejected")];
      },
    });
    const throwing = defineCommandHandler({
      type: "test.throw",
      label: "Throw",
      history: "record",
      payloadSchema: z.object({}).strict(),
      apply(document) {
        document.activeCanvasId = null;
        throw new Error("private detail");
      },
    });
    const document = createCommandTestDocument();

    for (const handler of [rejecting, throwing]) {
      const result = executeDocumentCommand(
        createCommandHandlerRegistry([handler]),
        dependencies,
        { type: handler.type, payload: {} },
        document,
      );
      expect(result.ok).toBe(false);
      expect(result.document).toBe(document);
      expect(result.transaction).toBeNull();
    }
  });

  it("rejects an invalid candidate and treats zero patches as a no-op", () => {
    const invalid = defineCommandHandler({
      type: "test.invalid",
      label: "Invalid",
      history: "record",
      payloadSchema: z.object({}).strict(),
      apply(document) {
        document.activeCanvasId = null;
      },
    });
    const document = createCommandTestDocument();
    const invalidResult = executeDocumentCommand(
      createCommandHandlerRegistry([invalid]),
      dependencies,
      { type: invalid.type, payload: {} },
      document,
    );
    const noOpResult = executeDocumentCommand(
      createCommandHandlerRegistry(coreDocumentCommandHandlers),
      dependencies,
      {
        type: "document.canvas.rename",
        payload: {
          canvasId: COMMAND_TEST_IDS.canvasA,
          name: document.canvases[COMMAND_TEST_IDS.canvasA].name,
        },
      },
      document,
    );

    expect(invalidResult.ok).toBe(false);
    expect(invalidResult.document).toBe(document);
    expect(noOpResult).toEqual({ ok: true, document, transaction: null });
  });

  it("allows an ignored command to change the document without a transaction", () => {
    const document = createCommandTestDocument();
    const withCanvas = executeDocumentCommand(
      createCommandHandlerRegistry(coreDocumentCommandHandlers),
      dependencies,
      {
        type: "document.canvas.create",
        payload: {
          canvas: {
            id: COMMAND_TEST_IDS.canvasB,
            name: "Second",
            settings: { width: 1000, height: 1000 },
          },
        },
      },
      document,
    );
    if (!withCanvas.ok) throw new Error("Expected canvas creation");
    const result = executeDocumentCommand(
      createCommandHandlerRegistry(coreDocumentCommandHandlers),
      dependencies,
      {
        type: "document.canvas.set-active",
        payload: { canvasId: COMMAND_TEST_IDS.canvasB },
      },
      withCanvas.document,
    );

    expect(result.ok).toBe(true);
    expect(result.document.activeCanvasId).toBe(COMMAND_TEST_IDS.canvasB);
    expect(result.transaction).toBeNull();
  });
});
