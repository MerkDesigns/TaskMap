import { z } from "zod";
import type { PlatformResult } from "../platformErrors";
import type { SessionAuthority } from "../settings/preferenceContracts";
import { invokePlatformRaw } from "../tauriInvoke";
import type { WorkflowStep } from "../../extensions/workflow/workflowDefinition";

const runStatusSchema = z
  .object({
    runId: z.string().min(1).max(64),
    phase: z.enum(["running", "finished", "failed", "stopped"]),
    stepCount: z.number().int().nonnegative(),
    startedSteps: z.number().int().nonnegative(),
    failedStep: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type WorkflowRunStatus = z.infer<typeof runStatusSchema>;

const notOpen = (): PlatformResult<never> => ({
  ok: false,
  error: { code: "session_not_open", message: "No database session is open.", retryable: false },
});
const malformed = (): PlatformResult<never> => ({
  ok: false,
  error: { code: "unexpected", message: "The workflow reply was malformed.", retryable: false },
});

function parsed<Value>(result: PlatformResult<unknown>, schema: z.ZodType<Value>) {
  if (!result.ok) return result;
  const value = schema.safeParse(result.value);
  return value.success ? ({ ok: true, value: value.data } as const) : malformed();
}

/**
 * The Workflow Runner's native commands for the open database session. Trust and launching are
 * decided in Rust; this client only carries definitions and run ids.
 */
export function createWorkflowClient(authority: () => SessionAuthority | null) {
  const call = async <Value>(
    command: string,
    input: Record<string, unknown>,
    schema: z.ZodType<Value>,
  ): Promise<PlatformResult<Value>> => {
    const session = authority();
    if (!session) return notOpen();
    return parsed(await invokePlatformRaw<unknown>(command, { ...session, ...input }), schema);
  };
  return {
    isTrusted: (steps: readonly WorkflowStep[]) =>
      call("app_workflow_trust_state", { steps }, z.boolean()),
    trust: (steps: readonly WorkflowStep[]) =>
      call(
        "app_workflow_trust",
        { steps },
        z.null().transform(() => undefined),
      ),
    run: (steps: readonly WorkflowStep[]) => call("app_workflow_run", { steps }, runStatusSchema),
    status: (runId: string) => call("app_workflow_status", { runId }, runStatusSchema),
    stop: (runId: string) => call("app_workflow_stop", { runId }, runStatusSchema),
  };
}

export type WorkflowClient = ReturnType<typeof createWorkflowClient>;
