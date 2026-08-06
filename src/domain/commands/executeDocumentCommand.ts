import { produceWithPatches, type Patch } from "immer";
import { z } from "zod";
import { inspectJsonSafety } from "../document/jsonSafety";
import type { TaskMapDocument } from "../document/documentTypes";
import { validateTaskMapDocument } from "../document/validateDocument";
import { ensureImmerPatchSupport } from "../history/immerPatchSupport";
import type { TransactionId } from "../ids/entityIds";
import type { CommandHandlerRegistry } from "./commandRegistry";
import type { CommandIssue, CommandResult } from "./commandResult";

const commandEnvelopeSchema = z
  .object({ type: z.string().min(1).max(128), payload: z.unknown() })
  .strict();

export interface TransactionDependencies {
  readonly nextTransactionId: () => TransactionId;
  readonly now: () => number;
}

export function executeDocumentCommand(
  registry: CommandHandlerRegistry,
  dependencies: TransactionDependencies,
  commandInput: unknown,
  document: TaskMapDocument,
): CommandResult<TaskMapDocument> {
  const commandIssues = validateCommandEnvelope(commandInput);
  if (commandIssues.length > 0) return failure(document, commandIssues);
  const command = commandEnvelopeSchema.parse(commandInput);
  const handler = registry.get(command.type);
  if (handler === undefined) {
    return failure(document, [
      {
        code: "unknown-command",
        path: "command.type",
        message: `No handler is registered for ${command.type}`,
      },
    ]);
  }

  const payloadResult = handler.payloadSchema.safeParse(command.payload);
  if (!payloadResult.success) {
    return failure(
      document,
      payloadResult.error.issues.map((issue) => ({
        code: "command-payload",
        path: commandPayloadPath(issue.path),
        message: issue.message,
      })),
    );
  }

  const currentValidation = validateTaskMapDocument(document);
  if (!currentValidation.ok) return failure(document, currentValidation.issues);

  ensureImmerPatchSupport();
  let handlerIssues: readonly CommandIssue[] = [];
  let produced: readonly [TaskMapDocument, Patch[], Patch[]];
  try {
    produced = produceWithPatches(document, (draft) => {
      handlerIssues = handler.apply(draft, payloadResult.data) ?? [];
    });
  } catch {
    return failure(document, [
      {
        code: "command-handler-failed",
        path: "command",
        message: "The command handler failed without changing the document",
      },
    ]);
  }
  if (handlerIssues.length > 0) return failure(document, handlerIssues);

  const [candidate, patches, inversePatches] = produced;
  const validation = validateTaskMapDocument(candidate);
  if (!validation.ok) return failure(document, validation.issues);
  if (patches.length === 0) return { ok: true, document, transaction: null };
  if (handler.history === "ignore") {
    return { ok: true, document: candidate, transaction: null };
  }
  return {
    ok: true,
    document: candidate,
    transaction: {
      id: dependencies.nextTransactionId(),
      label: handler.label,
      committedAt: dependencies.now(),
      patches,
      inversePatches,
    },
  };
}

function validateCommandEnvelope(input: unknown): readonly CommandIssue[] {
  const safetyIssues = inspectJsonSafety(input);
  if (safetyIssues.length > 0) {
    return safetyIssues.map((issue) => ({
      code: issue.path.startsWith("$.payload") ? "command-payload" : "invalid-command",
      path: issue.path.replace(/^\$\.?/, "command."),
      message: issue.message,
    }));
  }
  const result = commandEnvelopeSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    code: issue.path[0] === "payload" ? "command-payload" : "invalid-command",
    path: issue.path.length === 0 ? "command" : `command.${issue.path.join(".")}`,
    message: issue.message,
  }));
}

function commandPayloadPath(path: readonly PropertyKey[]): string {
  return path.length === 0 ? "command.payload" : `command.payload.${path.join(".")}`;
}

function failure(
  document: TaskMapDocument,
  issues: readonly CommandIssue[],
): CommandResult<TaskMapDocument> {
  return { ok: false, document, transaction: null, issues };
}
