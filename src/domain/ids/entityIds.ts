declare const entityIdBrand: unique symbol;

export type EntityId<Kind extends string> = string & {
  readonly [entityIdBrand]: Kind;
};

export type DocumentId = EntityId<"document">;
export type DatabaseId = EntityId<"database">;
export type CanvasId = EntityId<"canvas">;
export type ElementId = EntityId<"element">;
export type ConnectionId = EntityId<"connection">;
export type MediaId = EntityId<"media">;
export type ExtensionId = EntityId<"extension">;
export type ExtensionInstanceId = EntityId<"extension-instance">;
export type TransactionId = EntityId<"transaction">;
export type DatabaseSessionId = EntityId<"database-session">;
export type WorkflowExecutionId = EntityId<"workflow-execution">;

export type EntityIdKind =
  | "document"
  | "database"
  | "canvas"
  | "element"
  | "connection"
  | "media"
  | "extension"
  | "extension-instance"
  | "transaction"
  | "database-session"
  | "workflow-execution";

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PREFIXED_UUID_KINDS = new Set<EntityIdKind>([
  "document",
  "database",
  "canvas",
  "element",
  "connection",
  "extension-instance",
  "transaction",
  "database-session",
  "workflow-execution",
]);
const MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{24}$/;
const EXTENSION_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

export function isEntityId<Kind extends EntityIdKind>(
  kind: Kind,
  value: string,
): value is EntityId<Kind> {
  if (kind === "media") return MEDIA_ID_PATTERN.test(value);
  if (kind === "extension") return value.length <= 128 && EXTENSION_ID_PATTERN.test(value);
  if (!PREFIXED_UUID_KINDS.has(kind)) return false;
  return new RegExp(`^${kind}-${UUID_PATTERN}$`).test(value);
}

export function asEntityId<Kind extends EntityIdKind>(kind: Kind, value: string): EntityId<Kind> {
  if (!isEntityId(kind, value)) {
    throw new Error(`${kind} ID has an invalid format`);
  }
  return value;
}

export interface UuidSource {
  readonly nextUuid: () => string;
}

export function createEntityId<Kind extends Exclude<EntityIdKind, "media" | "extension">>(
  kind: Kind,
  source: UuidSource,
): EntityId<Kind> {
  return asEntityId(kind, `${kind}-${source.nextUuid()}`);
}
