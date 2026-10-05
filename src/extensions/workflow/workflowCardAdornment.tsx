import { IconPlayerPlayFilled, IconPlayerStopFilled, IconSettings } from "@tabler/icons-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useReducedMotion } from "../../ui/motion/reducedMotionPreference";
import type { CardAdornment } from "../cardAdornment";
import "./workflow.css";

/** The press animation plays for a moment before the run starts, so the launch reads as a reply. */
const LAUNCH_DELAY_MS = 170;
const PRESS_CLASS = "taskmap-extension-workflow--pressed";

/** The run/stop button before a workflow card's text. */
export const workflowCardAdornment: CardAdornment = {
  extension: "workflow",
  Leading: ({ context, commands }) => {
    const cardId = context.elementId;
    const run = useSyncExternalStore(commands.subscribeWorkflowRuns, () =>
      commands.getWorkflowRun(cardId),
    );
    const reducedMotion = useReducedMotion();
    const launch = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
      () => () => {
        if (launch.current) clearTimeout(launch.current);
      },
      [],
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
        disabled={lineCount === 0 && !active}
        aria-label={title}
        title={title}
        onPointerDown={(event) => event.stopPropagation()}
        onAnimationEnd={(event) => event.currentTarget.classList.remove(PRESS_CLASS)}
        onClick={(event) => {
          event.stopPropagation();
          if (active) {
            void commands.stopWorkflow(cardId);
            return;
          }
          if (launch.current) clearTimeout(launch.current);
          if (reducedMotion) {
            void commands.runWorkflow(cardId);
            return;
          }
          // Restart the press animation even when a press is still playing.
          const button = event.currentTarget;
          button.classList.remove(PRESS_CLASS);
          void button.offsetWidth;
          button.classList.add(PRESS_CLASS);
          launch.current = setTimeout(() => {
            launch.current = null;
            void commands.runWorkflow(cardId);
          }, LAUNCH_DELAY_MS);
        }}
      >
        {active ? (
          <>
            <IconSettings
              size={20.7}
              stroke={2}
              className="taskmap-extension-workflow__running"
              aria-hidden
            />
            <IconPlayerStopFilled
              size={17}
              stroke={2}
              className="taskmap-extension-workflow__stop"
              aria-hidden
            />
          </>
        ) : (
          <IconPlayerPlayFilled
            size={18.4}
            stroke={2}
            className="taskmap-extension-workflow__play"
            aria-hidden
          />
        )}
      </button>
    );
  },
};
