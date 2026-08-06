import type { Draft } from "immer";
import type { z } from "zod";
import type { TaskMapDocument } from "../document/documentTypes";
import type { CommandIssue } from "./commandResult";

export type CommandHistoryPolicy = "record" | "ignore";

export interface DomainCommandHandler {
  readonly type: string;
  readonly label: string;
  readonly history: CommandHistoryPolicy;
  readonly payloadSchema: z.ZodType<unknown>;
  readonly apply: (
    document: Draft<TaskMapDocument>,
    payload: unknown,
  ) => void | readonly CommandIssue[];
}

type TypedHandler<Schema extends z.ZodTypeAny> = Omit<
  DomainCommandHandler,
  "payloadSchema" | "apply"
> & {
  readonly payloadSchema: Schema;
  readonly apply: (
    document: Draft<TaskMapDocument>,
    payload: z.output<Schema>,
  ) => void | readonly CommandIssue[];
};

export function defineCommandHandler<Schema extends z.ZodTypeAny>(
  definition: TypedHandler<Schema>,
): DomainCommandHandler {
  return {
    ...definition,
    payloadSchema: definition.payloadSchema,
    apply: (document, payload) => definition.apply(document, payload as z.output<Schema>),
  };
}

export function commandRejected(path: string, message: string): CommandIssue {
  return { code: "command-rejected", path, message };
}
