import { IconAlertTriangle, IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";
import type { CardAdornment } from "../cardAdornment";
import "./workflow.css";

/** The run/stop button after a workflow card's text. */
export const workflowCardAdornment: CardAdornment = {
  extension: "workflow",
  Trailing: ({ context, commands }) => {
    const cardId = context.elementId;
    const run = useSyncExternalStore(commands.subscribeWorkflowRuns, () =>
      commands.getWorkflowRun(cardId),
    );
    const lineCount = context.extensions.workflow?.lines.length ?? 0;
    const active = run?.phase === "starting" || run?.phase === "running";
    const failed = run?.phase === "failed";
    const title =
      lineCount === 0
        ? "Add commands with Edit workflow"
        : active
          ? "Stop workflow"
          : failed
            ? run.failedLine !== null
              ? `Command ${run.failedLine + 1} failed. Run again`
              : `${run.message ?? "The workflow failed."} Run again`
            : "Run workflow";
    return (
      <button
        type="button"
        className="taskmap-extension-workflow"
        data-state={active ? "running" : failed ? "failed" : undefined}
        disabled={lineCount === 0 || run?.phase === "starting"}
        aria-label={title}
        title={title}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (active) void commands.stopWorkflow(cardId);
          else void commands.runWorkflow(cardId);
        }}
      >
        {active ? (
          <IconPlayerStop size={16} stroke={2} />
        ) : failed ? (
          <IconAlertTriangle size={16} stroke={2} />
        ) : (
          <IconPlayerPlay size={16} stroke={2} />
        )}
      </button>
    );
  },
};
