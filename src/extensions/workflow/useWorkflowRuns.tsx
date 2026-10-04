import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkflowClient } from "../../platform/workflow/workflowClient";
import { ModalPresence } from "../../ui/patterns/overlays";
import type { WorkflowStep } from "./workflowDefinition";
import { createWorkflowRunStore, type WorkflowRunStore } from "./workflowRunStore";
import { WorkflowTrustReviewDialog } from "./WorkflowTrustReviewDialog";

export interface WorkflowRunsPort {
  /** The card's saved steps while the Workflow extension is installed on it, otherwise null. */
  readonly getSteps: (cardId: string) => readonly WorkflowStep[] | null;
  readonly client: Pick<WorkflowClient, "run" | "status" | "stop" | "trust">;
}

/**
 * Running card workflows: the run store behind the cards' run buttons, and the review shown when
 * the native runner refuses a definition this device has not trusted.
 */
export function useWorkflowRuns(port: WorkflowRunsPort) {
  const portRef = useRef(port);
  portRef.current = port;
  const [review, setReview] = useState<{
    readonly cardId: string;
    readonly steps: readonly WorkflowStep[];
    readonly open: boolean;
  } | null>(null);
  const storeRef = useRef<WorkflowRunStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createWorkflowRunStore({
      getSteps: (cardId) => portRef.current.getSteps(cardId),
      run: (steps) => portRef.current.client.run(steps),
      status: (runId) => portRef.current.client.status(runId),
      stop: (runId) => portRef.current.client.stop(runId),
      needsReview: (cardId, steps) => setReview({ cardId, steps, open: true }),
    });
  }
  const store = storeRef.current;
  useEffect(() => () => store.reset(), [store]);

  const closeReview = useCallback(
    () => setReview((current) => (current ? { ...current, open: false } : null)),
    [],
  );
  const reset = useCallback(() => {
    store.reset();
    closeReview();
  }, [store, closeReview]);

  const trustAndRun = async (cardId: string, steps: readonly WorkflowStep[]) => {
    // Trusts exactly the reviewed steps; if the card changed meanwhile, the run is refused again.
    const trusted = await portRef.current.client.trust(steps);
    if (!trusted.ok) return false;
    closeReview();
    await store.run(cardId);
    return true;
  };

  const reviewDialog = (
    <ModalPresence
      open={Boolean(review?.open)}
      onExitComplete={() => setReview((current) => (current?.open ? current : null))}
    >
      {review ? (
        <WorkflowTrustReviewDialog
          key={review.cardId}
          steps={review.steps}
          onTrust={() => trustAndRun(review.cardId, review.steps)}
          onClose={closeReview}
        />
      ) : null}
    </ModalPresence>
  );

  return {
    runWorkflow: store.run,
    stopWorkflow: store.stop,
    subscribeWorkflowRuns: store.subscribe,
    getWorkflowRun: store.get,
    reset,
    reviewDialog,
  };
}
