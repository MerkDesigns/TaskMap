import type { z } from "zod";
import { calendarModuleSchema, CALENDAR_MODULE_ID } from "../calendar/calendarSchema";
import type { ExtensionInstallation, TaskMapDocument } from "../document/documentTypes";
import type { ExtensionId } from "../ids/entityIds";
import { inboxModuleSchema, INBOX_MODULE_ID } from "../notifications/inboxSchema";

/**
 * A built-in module that stores data for the whole document as one `extensionInstallations`
 * record targeting the document (ADR 011). Unlike element extensions they are never offered in
 * the Extensions panel; acceptance parses each record with its module's schema.
 */
export interface DocumentModuleDefinition<Value> {
  readonly id: ExtensionId;
  readonly schema: z.ZodType<Value>;
}

export const calendarDocumentModule: DocumentModuleDefinition<
  z.infer<typeof calendarModuleSchema>
> = Object.freeze({ id: CALENDAR_MODULE_ID, schema: calendarModuleSchema });

export const inboxDocumentModule: DocumentModuleDefinition<z.infer<typeof inboxModuleSchema>> =
  Object.freeze({ id: INBOX_MODULE_ID, schema: inboxModuleSchema });

const DOCUMENT_MODULES: readonly DocumentModuleDefinition<unknown>[] = Object.freeze([
  calendarDocumentModule,
  inboxDocumentModule,
]);

export function findDocumentModule(id: string): DocumentModuleDefinition<unknown> | undefined {
  return DOCUMENT_MODULES.find((module) => module.id === id);
}

/** The module's record in a document (or command draft), if it has been created. */
export function findDocumentModuleInstallation<Installation extends ExtensionInstallation>(
  installations: Readonly<Record<string, Installation>>,
  id: ExtensionId,
): Installation | undefined {
  return Object.values(installations).find(
    (installation) => installation.target.kind === "document" && installation.extensionId === id,
  );
}

// Parsed values per configuration object: documents are immutable, so an unchanged module keeps
// its parsed value across commands that touch other parts of the document.
const parsedConfigurations = new WeakMap<object, unknown>();

/** The module's parsed data, or null when the document has no (valid) record for it. */
export function readDocumentModule<Value>(
  document: TaskMapDocument,
  module: DocumentModuleDefinition<Value>,
): Value | null {
  const installation = findDocumentModuleInstallation(document.extensionInstallations, module.id);
  if (!installation) return null;
  const configuration = installation.configuration;
  if (parsedConfigurations.has(configuration)) {
    return parsedConfigurations.get(configuration) as Value | null;
  }
  const parsed = module.schema.safeParse(configuration);
  const value = parsed.success ? parsed.data : null;
  parsedConfigurations.set(configuration, value);
  return value;
}
