import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockExtensionCommands } from "../extensionCommandsTestSupport";
import { ReducedMotionProvider } from "../../ui/motion/reducedMotionPreference";
import { useWorkflowRuns } from "./useWorkflowRuns";
import { workflowCardAdornment } from "./workflowCardAdornment";
import type { CardWorkflowRun } from "./workflowRunStore";
import type { WorkflowStep } from "./workflowDefinition";

afterEach(cleanup);

const step: WorkflowStep = {
  executable: "cmd.exe",
  arguments: ["/C", "echo hello world"],
  workingDirectory: null,
  display: "background",
  waitForExit: true,
};

function renderButton(run: CardWorkflowRun | null, steps: WorkflowStep[] = [step]) {
  const commands = { ...mockExtensionCommands(), getWorkflowRun: vi.fn(() => run) };
  const Trailing = workflowCardAdornment.Trailing!;
  render(
    <Trailing
      context={{ elementId: "card", accent: "#fff", extensions: { workflow: { steps } } }}
      commands={commands}
    />,
  );
  return commands;
}

describe("workflow run button", () => {
  it("runs an idle card's workflow", async () => {
    const commands = renderButton(null);

    await userEvent.setup().click(screen.getByRole("button", { name: "Run workflow" }));

    expect(commands.runWorkflow).toHaveBeenCalledWith("card");
  });

  it("stops a running workflow", async () => {
    const commands = renderButton({
      phase: "running",
      runId: "run-1",
      failedStep: null,
      message: null,
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "Stop workflow" }));

    expect(commands.stopWorkflow).toHaveBeenCalledWith("card");
  });

  it("names the failed step and offers to run again", () => {
    renderButton({ phase: "failed", runId: "run-1", failedStep: 1, message: null });

    expect(screen.getByRole("button", { name: "Step 2 failed. Run again" })).toBeEnabled();
  });

  it("is disabled until the workflow has steps", () => {
    renderButton(null, []);

    expect(screen.getByRole("button", { name: "Add steps with Edit workflow" })).toBeDisabled();
  });
});

describe("workflow trust review", () => {
  function setup() {
    const client = {
      run: vi.fn(async () => ({
        ok: false as const,
        error: { code: "workflow_untrusted" as const, message: "Not trusted.", retryable: false },
      })),
      status: vi.fn(),
      stop: vi.fn(),
      trust: vi.fn(async () => ({ ok: true as const, value: undefined })),
    };
    const runs: { current: ReturnType<typeof useWorkflowRuns> | null } = { current: null };
    function Host() {
      runs.current = useWorkflowRuns({ getSteps: () => [step], client });
      return runs.current.reviewDialog;
    }
    render(
      <ReducedMotionProvider override>
        <Host />
      </ReducedMotionProvider>,
    );
    return { client, runs: () => runs.current! };
  }

  it("shows every step exactly as it would run before anything starts", async () => {
    const { client, runs } = setup();

    await act(() => runs().runWorkflow("card"));

    const dialog = screen.getByRole("dialog", { name: "Review workflow" });
    expect(dialog).toHaveTextContent("cmd.exe");
    expect(screen.getByText("echo hello world").tagName).toBe("CODE");
    expect(dialog).toHaveTextContent("In the background, the next step waits for it");
    expect(client.trust).not.toHaveBeenCalled();
  });

  it("trusts the reviewed steps and runs them again", async () => {
    const { client, runs } = setup();
    await act(() => runs().runWorkflow("card"));
    client.run.mockResolvedValueOnce({
      ok: true,
      value: { runId: "run-1", phase: "running", stepCount: 1, startedSteps: 0, failedStep: null },
    } as never);

    await userEvent.setup().click(screen.getByRole("button", { name: "Trust and run" }));

    expect(client.trust).toHaveBeenCalledWith([step]);
    expect(client.run).toHaveBeenCalledTimes(2);
    expect(runs().getWorkflowRun("card")?.phase).toBe("running");
  });
});
