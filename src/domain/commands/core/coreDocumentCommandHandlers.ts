import type { DomainCommandHandler } from "../commandHandler";
import { canvasCommandHandlers } from "./canvasCommands";
import { connectionCommandHandlers } from "./connectionCommands";
import { documentSettingsCommandHandlers } from "./documentSettingsCommands";
import { elementCommandHandlers } from "./elementCommands";
import { updateElementGeometriesCommand } from "./elementGeometryCommands";
import { extensionCommandHandlers } from "./extensionCommands";
import { mediaCommandHandlers } from "./mediaCommands";
import { calendarCommandHandlers } from "../modules/calendarCommands";
import { inboxCommandHandlers } from "../modules/inboxCommands";

export const coreDocumentCommandHandlers: readonly DomainCommandHandler[] = Object.freeze([
  ...canvasCommandHandlers,
  ...elementCommandHandlers,
  updateElementGeometriesCommand,
  ...connectionCommandHandlers,
  ...mediaCommandHandlers,
  ...extensionCommandHandlers,
  ...documentSettingsCommandHandlers,
  ...calendarCommandHandlers,
  ...inboxCommandHandlers,
]);
