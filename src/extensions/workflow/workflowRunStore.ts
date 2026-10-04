import type { PlatformResult } from "../../platform/platformErrors";
import type { WorkflowRunStatus } from "../../platform/workflow/workflowClient";
import type { WorkflowStep } from "./workflowDefinition";

/** A card's latest run, as its run button shows it. */
export interface CardWorkflowRun {
  readonly phase: "starting" | WorkflowRunStatus["phase"];
  readonly runId: string | null;
  /** Zero-based index of the step that could not start or failed while the next waited for it. */
  readonly failedStep: number | null;
  /** A native refusal other than trust, already safe to show. */
  readonly message: string | null;
}

export interface WorkflowRunPort {
  readonly getSteps: (cardId: string) => readonly WorkflowStep[] | null;
  readonly run: (steps: readonly WorkflowStep[]) => Promise<PlatformResult<WorkflowRunStatus>>;
  readonly status: (runId: string) => Promise<PlatformResult<WorkflowRunStatus>>;
  readonly stop: (runId: string) => Promise<PlatformResult<WorkflowRunStatus>>;
  /** The native runner refused the definition as untrusted; show it for review. */
  readonly needsReview: (cardId: string, steps: readonly WorkflowStep[]) => void;
}

const POLL_MS = 1000;

const fromStatus = (status: WorkflowRunStatus): CardWorkflowRun => ({
  phase: status.phase,
  runId: status.runId,
  failedStep: status.failedStep,
  message: null,
});

/**
 * Card runs for the open session: starts a card's workflow, polls its status while it runs and
 * stops it. Runs are tracked by the native runner; this store only mirrors their status.
 */
export function createWorkflowRunStore(port: WorkflowRunPort) {
  let runs: ReadonlyMap<string, CardWorkflowRun> = new Map();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Results from before a reset belong to a previous session and are dropped.
  let generation = 0;

  const set = (cardId: string, run: CardWorkflowRun | null) => {
    const next = new Map(runs);
    if (run) next.set(cardId, run);
    else next.delete(cardId);
    runs = next;
    listeners.forEach((listener) => listener());
    schedulePoll();
  };

  function schedulePoll() {
    const active = [...runs.values()].some((run) => run.phase === "running" && run.runId);
    if (!active || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void poll();
    }, POLL_MS);
  }

  async function poll() {
    const current = generation;
    for (const [cardId, run] of runs) {
      if (run.phase !== "running" || !run.runId) continue;
      const result = await port.status(run.runId);
      if (current !== generation) return;
      // An unknown run (for example after the session changed) stops being shown.
      set(cardId, result.ok ? fromStatus(result.value) : null);
    }
    schedulePoll();
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    get: (cardId: string): CardWorkflowRun | null => runs.get(cardId) ?? null,

    async run(cardId: string) {
      const steps = port.getSteps(cardId);
      const current = runs.get(cardId);
      if (!steps?.length || current?.phase === "starting" || current?.phase === "running") return;
      const started = generation;
      set(cardId, { phase: "starting", runId: null, failedStep: null, message: null });
      const result = await port.run(steps);
      if (started !== generation) return;
      if (result.ok) {
        set(cardId, fromStatus(result.value));
      } else if (result.error.code === "workflow_untrusted") {
        set(cardId, null);
        port.needsReview(cardId, steps);
      } else {
        set(cardId, {
          phase: "failed",
          runId: null,
          failedStep: null,
          message: result.error.message,
        });
      }
    },

    async stop(cardId: string) {
      const run = runs.get(cardId);
      if (!run?.runId || run.phase !== "running") return;
      const started = generation;
      const result = await port.stop(run.runId);
      if (started === generation && result.ok) set(cardId, fromStatus(result.value));
    },

    /** Forgets every run, as when the session locks or closes; launched processes keep running. */
    reset() {
      generation += 1;
      if (timer) clearTimeout(timer);
      timer = null;
      runs = new Map();
      listeners.forEach((listener) => listener());
    },
  };
}

export type WorkflowRunStore = ReturnType<typeof createWorkflowRunStore>;
