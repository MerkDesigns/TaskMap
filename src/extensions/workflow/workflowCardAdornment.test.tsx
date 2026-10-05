import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockExtensionCommands } from "../extensionCommandsTestSupport";
import { ReducedMotionProvider } from "../../ui/motion/reducedMotionPreference";
import { useWorkflowRuns } from "./useWorkflowRuns";
import { workflowCardAdornment } from "./workflowCardAdornment";
import type { CardWorkflowRun } from "./workflowRunStore";
import type { WorkflowLine } from "./workflowDefinition";

afterEach(cleanup);

const line: WorkflowLine = {
  invocations: [
    { kind: "run", executable: "cmd.exe", arguments: ["/C", "echo hello world"] },
    { kind: "open", target: "http://localhost:8081" },
  ],
  workingDirectory: null,
  display: "background",
};

function renderButton(
  run: CardWorkflowRun | null,
  lines: WorkflowLine[] = [line],
  reducedMotion = true,
) {
  const commands = { ...mockExtensionCommands(), getWorkflowRun: vi.fn(() => run) };
  const Leading = workflowCardAdornment.Leading!;
  render(
    <ReducedMotionProvider override={reducedMotion}>
      <Leading
        context={{ elementId: "card", accent: "#fff", extensions: { workflow: { lines } } }}
        commands={commands}
      />
    </ReducedMotionProvider>,
  );
  return commands;
}

describe("workflow run button", () => {
  it("runs an idle card's workflow", async () => {
    const commands = renderButton(null);

    await userEvent.setup().click(screen.getByRole("button", { name: "Run workflow" }));

    expect(commands.runWorkflow).toHaveBeenCalledWith("card");
  });

  it("plays the press before starting the run", async () => {
    const commands = renderButton(null, [line], false);

    await userEvent.setup().click(screen.getByRole("button", { name: "Run workflow" }));

    expect(commands.runWorkflow).not.toHaveBeenCalled();
    await waitFor(() => expect(commands.runWorkflow).toHaveBeenCalledWith("card"));
  });

  it("stops a running workflow", async () => {
    const commands = renderButton({
      phase: "running",
      runId: "run-1",
      failedLine: null,
      message: null,
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "Stop workflow" }));

    expect(commands.stopWorkflow).toHaveBeenCalledWith("card");
  });

  it("names the failed line and offers to run again", () => {
    renderButton({ phase: "failed", runId: "run-1", failedLine: 1, message: null });

    expect(screen.getByRole("button", { name: "Command 2 failed. Run again" })).toBeEnabled();
  });

  it("is disabled until the workflow has lines", () => {
    renderButton(null, []);

    expect(screen.getByRole("button", { name: "Add commands with Edit workflow" })).toBeDisabled();
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
      runs.current = useWorkflowRuns({ getLines: () => [line], client });
      return runs.current.reviewDialog;
    }
    render(
      <ReducedMotionProvider override>
        <Host />
      </ReducedMotionProvider>,
    );
    return { client, runs: () => runs.current! };
  }

  it("shows every line exactly as it would run before anything starts", async () => {
    const { client, runs } = setup();

    await act(() => runs().runWorkflow("card"));

    const dialog = screen.getByRole("dialog", { name: "Review workflow" });
    expect(dialog).toHaveTextContent("cmd.exe");
    expect(screen.getByText("echo hello world").tagName).toBe("CODE");
    expect(dialog).toHaveTextContent("http://localhost:8081 with its default app");
    expect(dialog).toHaveTextContent("In the background, each after the previous one succeeds");
    expect(client.trust).not.toHaveBeenCalled();
  });

  it("trusts the reviewed lines and runs them again", async () => {
    const { client, runs } = setup();
    await act(() => runs().runWorkflow("card"));
    client.run.mockResolvedValueOnce({
      ok: true,
      value: { runId: "run-1", phase: "running", lineCount: 1, failedLine: null },
    } as never);

    await userEvent.setup().click(screen.getByRole("button", { name: "Trust and run" }));

    expect(client.trust).toHaveBeenCalledWith([line]);
    expect(client.run).toHaveBeenCalledTimes(2);
    expect(runs().getWorkflowRun("card")?.phase).toBe("running");
  });
});
