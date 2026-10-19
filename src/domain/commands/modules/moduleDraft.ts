import type { Draft } from "immer";
import { entityIdSchema } from "../../document/documentSchema";
import type {
  ExtensionInstallation,
  JsonObject,
  TaskMapDocument,
} from "../../document/documentTypes";
import {
  findDocumentModuleInstallation,
  type DocumentModuleDefinition,
} from "../../document-modules/documentModules";
import type { ExtensionInstanceId } from "../../ids/entityIds";
import type { CommandIssue } from "../commandResult";
import { commandRejected } from "../commandHandler";

/** The id a document module's record gets if this command is the first to need it. */
export const moduleInstanceIdSchema = entityIdSchema("extension-instance");

/**
 * The module's data inside a command draft (the draft objects themselves, typed as the module's
 * plain data). Acceptance has already parsed the record with the module's schema, so its shape can
 * be relied on here.
 */
export function moduleDraft<Value>(
  document: Draft<TaskMapDocument>,
  module: DocumentModuleDefinition<Value>,
): Value | undefined {
  // Widened for lookup only: the configuration found is the draft itself, so edits still record.
  const installations = document.extensionInstallations as unknown as Readonly<
    Record<string, ExtensionInstallation>
  >;
  const installation = findDocumentModuleInstallation(installations, module.id);
  return installation?.configuration as unknown as Value | undefined;
}

/** The module's data, creating its record (with the payload's id) on first use. */
export function ensureModuleDraft<Value>(
  document: Draft<TaskMapDocument>,
  module: DocumentModuleDefinition<Value>,
  instanceId: ExtensionInstanceId,
  create: () => Value,
): Value | CommandIssue {
  const existing = moduleDraft(document, module);
  if (existing) return existing;
  // The draft record, typed plainly: JSON configuration drafts are too deep for the checker.
  const installations = document.extensionInstallations as unknown as Record<
    string,
    ExtensionInstallation
  >;
  if (installations[instanceId]) {
    return commandRejected("payload.instanceId", "The module record id is already used");
  }
  installations[instanceId] = {
    id: instanceId,
    extensionId: module.id,
    target: { kind: "document", documentId: document.id },
    enabled: true,
    configuration: create() as JsonObject,
  };
  return installations[instanceId].configuration as unknown as Value;
}

export function isCommandIssue(value: unknown): value is CommandIssue {
  return typeof value === "object" && value !== null && "code" in value && "message" in value;
}
