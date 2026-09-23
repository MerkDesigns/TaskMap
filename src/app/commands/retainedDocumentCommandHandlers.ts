import { coreDocumentCommandHandlers } from "../../domain/commands/core/coreDocumentCommandHandlers";
import type { DomainCommandHandler } from "../../domain/commands/commandHandler";
import { editRetainedExtensionsCommand } from "./retainedExtensionCommand";
import { pasteRetainedElementsCommand } from "./retainedPasteCommand";
import { editRetainedSettingsCommand } from "./retainedSettingsCommand";
import { importRetainedImageCommand } from "./retainedImageImportCommand";
import { replaceRetainedImageCommand } from "./retainedImageReplaceCommand";
import { retainedCanvasCommandHandlers } from "./retainedCanvasCommands";
import {
  insertRetainedContainerCardCommand,
  replaceRetainedContainerCardsCommand,
} from "./retainedContainerCardCommands";
import {
  deleteRetainedElementCommand,
  deleteRetainedSelectionCommand,
} from "./retainedSelectionDeletion";
import {
  updateRetainedGeometriesCommand,
  updateRetainedGeometryCommand,
} from "./retainedGeometryCommands";
import { placeRetainedElementsCommand } from "./retainedPlacementCommand";
import { replaceRetainedDataCommand } from "./retainedDataReplacementCommand";
import { editRetainedContentCommand } from "./retainedContentCommand";
import {
  completeRetainedConnectionCommand,
  deleteCapturedConnectionCommand,
} from "./retainedConnectionCommands";
import {
  reorderRetainedElementCommand,
  reorderRetainedLayersCommand,
} from "./retainedLayerCommands";

const retainedHandlers = [
  ...retainedCanvasCommandHandlers,
  importRetainedImageCommand,
  replaceRetainedImageCommand,
  editRetainedSettingsCommand,
  insertRetainedContainerCardCommand,
  replaceRetainedContainerCardsCommand,
  pasteRetainedElementsCommand,
  editRetainedExtensionsCommand,
  completeRetainedConnectionCommand,
  deleteCapturedConnectionCommand,
  deleteRetainedElementCommand,
  deleteRetainedSelectionCommand,
  updateRetainedGeometriesCommand,
  updateRetainedGeometryCommand,
  placeRetainedElementsCommand,
  replaceRetainedDataCommand,
  editRetainedContentCommand,
  reorderRetainedElementCommand,
  reorderRetainedLayersCommand,
];
const replacedTypes = new Set(retainedHandlers.map(({ type }) => type));

// One explicit handler list for the existing dispatcher, not a second registry or command engine.
// Remaining retained action semantics are staged; this list does not yet establish full edit parity.
export const retainedDocumentCommandHandlers: readonly DomainCommandHandler[] = Object.freeze([
  ...coreDocumentCommandHandlers.filter(({ type }) => !replacedTypes.has(type)),
  ...retainedHandlers,
]);
