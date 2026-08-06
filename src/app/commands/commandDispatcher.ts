import type { CommandResult } from "../../domain/commands/commandResult";
import type {
  ApplicationCommand,
  ApplicationCommandHandler,
  CommandDispatcher,
} from "./commandTypes";

export function createCommandDispatcher<Document>(
  handlers: Readonly<Record<string, ApplicationCommandHandler<Document>>>,
): CommandDispatcher<Document> {
  return {
    dispatch(command: ApplicationCommand, document: Document): CommandResult<Document> {
      const handler = handlers[command.type];
      if (!handler) {
        return {
          ok: false,
          issues: [
            {
              code: "unknown-command",
              path: "command.type",
              message: `No handler is registered for ${command.type}`,
            },
          ],
        };
      }

      return handler(command, document);
    },
  };
}
