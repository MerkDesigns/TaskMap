import { parseTaskMapDocument } from "../document/documentSchema";
import { createValidDocumentInput, TEST_IDS } from "../document/documentTestFixtures";
import type { TaskMapDocument } from "../document/documentTypes";
import { asEntityId, type TransactionId } from "../ids/entityIds";
import { createCommandHandlerRegistry } from "./commandRegistry";
import { coreDocumentCommandHandlers } from "./core/coreDocumentCommandHandlers";
import { executeDocumentCommand } from "./executeDocumentCommand";

export const COMMAND_TEST_IDS = Object.freeze({
  ...TEST_IDS,
  canvasC: asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000010"),
  elementC: asEntityId("element", "element-00000000-0000-4000-8000-000000000011"),
  connectionB: asEntityId("connection", "connection-00000000-0000-4000-8000-000000000012"),
  extensionC: asEntityId(
    "extension-instance",
    "extension-instance-00000000-0000-4000-8000-000000000013",
  ),
  mediaB: asEntityId("media", "zyxwvutsrqponmlkjihgfedc"),
  transaction: asEntityId("transaction", "transaction-00000000-0000-4000-8000-000000000014"),
});

export function createCommandTestDocument(): TaskMapDocument {
  return parseTaskMapDocument(createValidDocumentInput());
}

export function executeTestCommand(document: TaskMapDocument, command: unknown) {
  return executeDocumentCommand(
    createCommandHandlerRegistry(coreDocumentCommandHandlers),
    {
      nextTransactionId: () =>
        asEntityId("transaction", COMMAND_TEST_IDS.transaction) as TransactionId,
      now: () => 1_725_000_000_000,
    },
    command,
    document,
  );
}
