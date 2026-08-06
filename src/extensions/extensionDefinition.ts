import type { ComponentType } from "react";
import type { ZodType } from "zod";
import type { DocumentElement } from "../domain/document/documentTypes";
import type { ExtensionId } from "../domain/ids/entityIds";

export interface ExtensionControlProps<State = unknown> {
  readonly element: DocumentElement;
  readonly state: State;
}

export interface ExtensionDefinition<State = unknown> {
  readonly id: ExtensionId;
  readonly label: string;
  readonly compatibleElementTypes: readonly string[];
  readonly conflictsWith: readonly ExtensionId[];
  readonly stateSchema: ZodType<State>;
  readonly createDefaultState: () => State;
  readonly Control?: ComponentType<ExtensionControlProps<State>>;
}
