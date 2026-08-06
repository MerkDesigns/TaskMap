// @vitest-environment node
import { describe, expect, it } from "vitest";
import { coreDocumentCommandHandlers } from "../../domain/commands/core/coreDocumentCommandHandlers";
import {
  COMMAND_TEST_IDS,
  createCommandTestDocument,
} from "../../domain/commands/commandTestSupport";
import { asEntityId } from "../../domain/ids/entityIds";
import { createCommandDispatcher } from "./commandDispatcher";

describe("application command dispatcher", () => {
  it("adapts explicit handlers and deterministic transaction dependencies", () => {
    const dispatcher = createCommandDispatcher(coreDocumentCommandHandlers, {
      nextTransactionId: () => asEntityId("transaction", COMMAND_TEST_IDS.transaction),
      now: () => 77,
    });
    const result = dispatcher.dispatch(
      {
        type: "document.canvas.rename",
        payload: { canvasId: COMMAND_TEST_IDS.canvasA, name: "Via application API" },
      },
      createCommandTestDocument(),
    );
    expect(result.ok).toBe(true);
    expect(result.transaction).toMatchObject({ id: COMMAND_TEST_IDS.transaction, committedAt: 77 });
  });
});
