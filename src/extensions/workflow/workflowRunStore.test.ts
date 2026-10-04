// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowRunStatus } from "../../platform/workflow/workflowClient";
import type { WorkflowLine } from "./workflowDefinition";
import { createWorkflowRunStore, type WorkflowRunPort } from "./workflowRunStore";

const lines: WorkflowLine[] = [
  {
    invocations: [{ kind: "run", executable: "npm", arguments: ["run", "dev"] }],
    workingDirectory: null,
    display: "terminal",
  },
];
const status = (phase: WorkflowRunStatus["phase"], failedLine: number | null = null) => ({
  ok: true as const,
  value: { runId: "run-1", phase, lineCount: 1, failedLine },
});

function setup(overrides: Partial<WorkflowRunPort> = {}) {
  const port = {
    getLines: vi.fn(() => lines),
    run: vi.fn(async () => status("running")),
    status: vi.fn(async () => status("running")),
    stop: vi.fn(async () => status("stopped")),
    needsReview: vi.fn(),
    ...overrides,
  } satisfies WorkflowRunPort;
  return { port, store: createWorkflowRunStore(port) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("workflow run store", () => {
  it("starts a card's lines and follows the run until it finishes", async () => {
    const { port, store } = setup();
    const listener = vi.fn();
    store.subscribe(listener);

    await store.run("card");
    expect(port.run).toHaveBeenCalledWith(lines);
    expect(store.get("card")).toMatchObject({ phase: "running", runId: "run-1" });

    vi.mocked(port.status).mockResolvedValueOnce(status("finished"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(port.status).toHaveBeenCalledWith("run-1");
    expect(store.get("card")?.phase).toBe("finished");
    await vi.advanceTimersByTimeAsync(5000);
    expect(port.status).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalled();
  });

  it("asks for a review when the native runner refuses an untrusted definition", async () => {
    const { port, store } = setup({
      run: vi.fn(async () => ({
        ok: false as const,
        error: { code: "workflow_untrusted" as const, message: "Not trusted.", retryable: false },
      })),
    });

    await store.run("card");

    expect(port.needsReview).toHaveBeenCalledWith("card", lines);
    expect(store.get("card")).toBeNull();
  });

  it("shows which line failed and other refusals", async () => {
    const { store } = setup({ run: vi.fn(async () => status("failed", 1)) });
    await store.run("card");
    expect(store.get("card")).toMatchObject({ phase: "failed", failedLine: 1 });

    const refused = setup({
      run: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: "workflow_launch_failure" as const,
          message: "A workflow line could not be started.",
          retryable: true,
        },
      })),
    });
    await refused.store.run("card");
    expect(refused.store.get("card")).toMatchObject({
      phase: "failed",
      message: "A workflow line could not be started.",
    });
  });

  it("stops a running card's run by its id", async () => {
    const { port, store } = setup();
    await store.run("card");

    await store.stop("card");

    expect(port.stop).toHaveBeenCalledWith("run-1");
    expect(store.get("card")?.phase).toBe("stopped");
  });

  it("does nothing for a card without lines or one already running", async () => {
    const empty = setup({ getLines: vi.fn(() => []) });
    await empty.store.run("card");
    expect(empty.port.run).not.toHaveBeenCalled();

    const { port, store } = setup();
    await store.run("card");
    await store.run("card");
    expect(port.run).toHaveBeenCalledTimes(1);
  });

  it("forgets runs on reset and ignores results from before it", async () => {
    let finish: (value: ReturnType<typeof status>) => void = () => undefined;
    const { store } = setup({
      run: vi.fn(() => new Promise<ReturnType<typeof status>>((resolve) => (finish = resolve))),
    });

    const running = store.run("card");
    store.reset();
    finish(status("running"));
    await running;

    expect(store.get("card")).toBeNull();
  });
});
