import type { CommandResult } from "../../domain/commands/commandResult";
import type { DomainCommand } from "../../domain/commands/domainCommand";
import type { DomainCommandHandler } from "../../domain/commands/commandHandler";
import type { TaskMapDocument } from "../../domain/document/documentTypes";

export type ApplicationCommand = DomainCommand;
export type ApplicationCommandHandler = DomainCommandHandler;

export interface CommandDispatcher {
  dispatch(command: unknown, document: TaskMapDocument): CommandResult<TaskMapDocument>;
}
