// @vitest-environment node
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { createValidDocumentInput } from "../document/documentTestFixtures";
import type { TaskMapDocument } from "../document/documentTypes";
import { asEntityId } from "../ids/entityIds";
import { defineCommandHandler } from "./commandHandler";
import { createCommandHandlerRegistry } from "./commandRegistry";
import {
  COMMAND_TEST_IDS,
  createCommandTestDocument,
  executeTestCommand,
} from "./commandTestSupport";
import { coreDocumentCommandHandlers } from "./core/coreDocumentCommandHandlers";
import { executeDocumentCommand } from "./executeDocumentCommand";

describe("current document validation gate", () => {
  it("does not repair a missing active canvas through set-active", () => {
    const document = malformedDocument((input) => {
      input.activeCanvasId = null;
    });
    const result = executeTestCommand(document, {
      type: "document.canvas.set-active",
      payload: { canvasId: COMMAND_TEST_IDS.canvasA },
    });

    expectFailure(result, document, "active-canvas-required");
  });

  it("does not repair incomplete or duplicate canvas orders through reorder", () => {
    const incomplete = malformedDocument((input) => {
      input.canvasOrder = [];
    });
    const duplicate = malformedDocument((input) => {
      input.canvasOrder = [COMMAND_TEST_IDS.canvasA, COMMAND_TEST_IDS.canvasA];
    });
    const command = {
      type: "document.canvas.reorder",
      payload: { order: [COMMAND_TEST_IDS.canvasA] },
    };

    expectFailure(executeTestCommand(incomplete, command), incomplete, "canvas-order-missing");
    expectFailure(executeTestCommand(duplicate, command), duplicate, "canvas-order-duplicate");
  });

  it("does not run an element reorder against incomplete or duplicate layer orders", () => {
    const incomplete = malformedDocument((input) => {
      input.canvases[COMMAND_TEST_IDS.canvasA].elementOrder = [COMMAND_TEST_IDS.elementA];
    });
    const duplicate = malformedDocument((input) => {
      input.canvases[COMMAND_TEST_IDS.canvasA].elementOrder = [
        COMMAND_TEST_IDS.elementA,
        COMMAND_TEST_IDS.elementB,
        COMMAND_TEST_IDS.elementA,
      ];
    });
    const command = {
      type: "document.element.reorder",
      payload: { elementId: COMMAND_TEST_IDS.elementA, toIndex: 0 },
    };

    expectFailure(executeTestCommand(incomplete, command), incomplete, "element-order-missing");
    expectFailure(executeTestCommand(duplicate, command), duplicate, "element-order-duplicate");
  });

  it("does not repair a structurally malformed document through a valid command", () => {
    const document = malformedDocument((input) => {
      input.canvases[COMMAND_TEST_IDS.canvasA].name = "";
    });
    const result = executeTestCommand(document, {
      type: "document.canvas.rename",
      payload: { canvasId: COMMAND_TEST_IDS.canvasA, name: "Would repair the name" },
    });

    expectFailure(result, document, "invalid-structure");
  });

  it("does not invoke a handler or consume transaction dependencies", () => {
    const apply = vi.fn();
    const handler = defineCommandHandler({
      type: "test.never-run",
      label: "Never run",
      history: "record",
      payloadSchema: z.object({}).strict(),
      apply,
    });
    const nextTransactionId = vi.fn(() => asEntityId("transaction", COMMAND_TEST_IDS.transaction));
    const now = vi.fn(() => 123);
    const document = malformedDocument((input) => {
      input.activeCanvasId = null;
    });

    const result = executeDocumentCommand(
      createCommandHandlerRegistry([handler]),
      { nextTransactionId, now },
      { type: handler.type, payload: {} },
      document,
    );

    expectFailure(result, document, "active-canvas-required");
    expect(apply).not.toHaveBeenCalled();
    expect(nextTransactionId).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it("keeps normal commands against valid supplied documents working", () => {
    const document = createCommandTestDocument();
    const result = executeDocumentCommand(
      createCommandHandlerRegistry(coreDocumentCommandHandlers),
      {
        nextTransactionId: () => asEntityId("transaction", COMMAND_TEST_IDS.transaction),
        now: () => 456,
      },
      {
        type: "document.canvas.rename",
        payload: { canvasId: COMMAND_TEST_IDS.canvasA, name: "Still valid" },
      },
      document,
    );

    expect(result.ok).toBe(true);
    expect(result.document).not.toBe(document);
    expect(result.document.canvases[COMMAND_TEST_IDS.canvasA].name).toBe("Still valid");
    expect(result.transaction).toMatchObject({ committedAt: 456 });
  });
});

function malformedDocument(change: (input: ReturnType<typeof createValidDocumentInput>) => void) {
  const input = createValidDocumentInput();
  change(input);
  return input as unknown as TaskMapDocument;
}

function expectFailure(
  result: ReturnType<typeof executeTestCommand>,
  document: TaskMapDocument,
  issueCode: string,
) {
  expect(result.ok).toBe(false);
  expect(result.document).toBe(document);
  expect(result.transaction).toBeNull();
  expect(result.ok ? [] : result.issues).toContainEqual(
    expect.objectContaining({ code: issueCode }),
  );
}
