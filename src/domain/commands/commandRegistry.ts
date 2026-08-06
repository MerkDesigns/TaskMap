import type { DomainCommandHandler } from "./commandHandler";

export interface CommandHandlerRegistry {
  readonly get: (type: string) => DomainCommandHandler | undefined;
  readonly list: () => readonly DomainCommandHandler[];
}

export class DuplicateCommandRegistrationError extends Error {
  constructor(readonly commandType: string) {
    super(`Command type ${commandType} is registered more than once`);
    this.name = "DuplicateCommandRegistrationError";
  }
}

export function createCommandHandlerRegistry(
  handlers: readonly DomainCommandHandler[],
): CommandHandlerRegistry {
  const entries = new Map<string, DomainCommandHandler>();
  for (const handler of handlers) {
    if (entries.has(handler.type)) throw new DuplicateCommandRegistrationError(handler.type);
    entries.set(handler.type, handler);
  }
  const snapshot = Object.freeze([...entries.values()]);
  return {
    get: (type) => entries.get(type),
    list: () => snapshot,
  };
}
