import { executeDocumentCommand } from "../../domain/commands/executeDocumentCommand";
import type { TransactionDependencies } from "../../domain/commands/executeDocumentCommand";
import { createCommandHandlerRegistry } from "../../domain/commands/commandRegistry";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { ApplicationCommandHandler, CommandDispatcher } from "./commandTypes";

export function createCommandDispatcher(
  handlers: readonly ApplicationCommandHandler[],
  dependencies: TransactionDependencies,
): CommandDispatcher {
  const registry = createCommandHandlerRegistry(handlers);
  return {
    dispatch(command: unknown, document: TaskMapDocument) {
      return executeDocumentCommand(registry, dependencies, command, document);
    },
  };
}
