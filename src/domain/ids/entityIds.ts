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
export type TransactionId = EntityId<"transaction">;
export type DatabaseSessionId = EntityId<"database-session">;
export type WorkflowExecutionId = EntityId<"workflow-execution">;

export function asEntityId<Kind extends string>(kind: Kind, value: string): EntityId<Kind> {
  if (value.trim().length === 0) {
    throw new Error(`${kind} ID must not be empty`);
  }

  return value as EntityId<Kind>;
}
