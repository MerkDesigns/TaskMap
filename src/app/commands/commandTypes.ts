import type { CommandResult } from "../../domain/commands/commandResult";
import type { DomainCommand } from "../../domain/commands/domainCommand";

export type ApplicationCommand = DomainCommand;

export type ApplicationCommandHandler<Document> = (
  command: ApplicationCommand,
  document: Document,
) => CommandResult<Document>;

export interface CommandDispatcher<Document> {
  dispatch(command: ApplicationCommand, document: Document): CommandResult<Document>;
}
