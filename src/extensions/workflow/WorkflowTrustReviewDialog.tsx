import { IconPlayerPlay, IconShieldCheck, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import {
  ModalDialog,
  ModalDialogActions,
  ModalDialogBody,
  ModalDialogHeader,
  useDialogFocus,
} from "../../ui/patterns/overlays";
import { Button } from "../../ui/primitives";
import type { WorkflowInvocation, WorkflowLine } from "./workflowDefinition";
import "./workflow.css";

export interface WorkflowTrustReviewDialogProps {
  readonly lines: readonly WorkflowLine[];
  /** Records the exact lines shown as trusted and runs them; resolves false if that failed. */
  readonly onTrust: () => Promise<boolean>;
  readonly onClose: () => void;
}

function InvocationFacts({ invocation }: { readonly invocation: WorkflowInvocation }) {
  if (invocation.kind === "open")
    return (
      <>
        <dt>Opens</dt>
        <dd>
          <code>{invocation.target}</code> with its default app
        </dd>
      </>
    );
  return (
    <>
      <dt>Program</dt>
      <dd>
        <code>{invocation.executable}</code>
      </dd>
      <dt>Arguments</dt>
      <dd>
        {invocation.arguments.length > 0 ? (
          invocation.arguments.map((argument, position) => (
            <code key={position} className="taskmap-workflow-review__argument">
              {argument}
            </code>
          ))
        ) : (
          <span>None</span>
        )}
      </dd>
    </>
  );
}

/**
 * Shows every line of a workflow this device has not trusted (pasted, written by AI JSON, or from
 * a database used elsewhere) exactly as it would run, before the user trusts it.
 */
export function WorkflowTrustReviewDialog({
  lines,
  onTrust,
  onClose,
}: WorkflowTrustReviewDialogProps) {
  const dialogRef = useDialogFocus();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [busy, onClose]);

  const trust = async () => {
    setBusy(true);
    setFailed(false);
    const trusted = await onTrust();
    setBusy(false);
    if (!trusted) setFailed(true);
  };

  return (
    <ModalDialog
      ref={dialogRef}
      width={520}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workflow-review-title"
      tabIndex={-1}
      data-production-dialog="workflow-review"
    >
      <ModalDialogHeader
        titleId="workflow-review-title"
        title="Review workflow"
        icon={<IconShieldCheck size={19} stroke={2} className="taskmap-modal-dialog__icon" />}
        onClose={onClose}
        closeDisabled={busy}
      />
      <ModalDialogBody className="taskmap-workflow-editor">
        <p className="taskmap-workflow-review__intro">
          This workflow was not written on this device. Run it only if you trust everything below.
        </p>
        <ol className="taskmap-workflow-editor__steps">
          {lines.map((line, index) => (
            <li key={index} className="taskmap-workflow-editor__step">
              <span className="taskmap-workflow-editor__step-title">Command {index + 1}</span>
              <dl className="taskmap-workflow-review__facts">
                {line.invocations.map((invocation, position) => (
                  <InvocationFacts key={position} invocation={invocation} />
                ))}
                <dt>Working directory</dt>
                <dd>{line.workingDirectory ? <code>{line.workingDirectory}</code> : "Default"}</dd>
                <dt>Runs</dt>
                <dd>
                  {line.display === "terminal" ? "In a terminal window" : "In the background"}
                  {line.invocations.length > 1 ? ", each after the previous one succeeds" : ""}
                </dd>
              </dl>
            </li>
          ))}
        </ol>
        {failed ? (
          <div role="alert" className="taskmap-modal-dialog__error">
            The workflow could not be trusted or started. Try again.
          </div>
        ) : null}
      </ModalDialogBody>
      <ModalDialogActions>
        <Button
          variant="ghost"
          leadingIcon={<IconX size={17} stroke={2} />}
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          leadingIcon={<IconPlayerPlay size={17} stroke={2} />}
          onClick={() => void trust()}
          disabled={busy}
        >
          Trust and run
        </Button>
      </ModalDialogActions>
    </ModalDialog>
  );
}
