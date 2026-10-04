// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowLine } from "../../extensions/workflow/workflowDefinition";
import { invokePlatformRaw } from "../tauriInvoke";
import { createWorkflowClient } from "./workflowClient";

vi.mock("../tauriInvoke", () => ({ invokePlatformRaw: vi.fn() }));
const invoke = vi.mocked(invokePlatformRaw);
const authority = { databaseId: "database-test", sessionId: "session-test" };
const lines: WorkflowLine[] = [
  {
    invocations: [{ kind: "run", executable: "npm", arguments: ["run", "dev"] }],
    workingDirectory: null,
    display: "terminal",
  },
];
const running = {
  runId: "workflow-run-1",
  phase: "running",
  lineCount: 1,
  failedLine: null,
};

beforeEach(() => invoke.mockReset());

describe("workflow client", () => {
  it("sends the definition with the open session's authority", async () => {
    invoke.mockResolvedValue({ ok: true, value: running });
    const client = createWorkflowClient(() => authority);

    expect(await client.run(lines)).toEqual({ ok: true, value: running });
    expect(invoke).toHaveBeenCalledWith("app_workflow_run", { ...authority, lines });

    invoke.mockResolvedValue({ ok: true, value: true });
    expect(await client.isTrusted(lines)).toEqual({ ok: true, value: true });
    expect(invoke).toHaveBeenLastCalledWith("app_workflow_trust_state", { ...authority, lines });
  });

  it("addresses runs by id only", async () => {
    invoke.mockResolvedValue({ ok: true, value: { ...running, phase: "stopped" } });
    const client = createWorkflowClient(() => authority);

    expect((await client.stop("workflow-run-1")).ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith("app_workflow_stop", {
      ...authority,
      runId: "workflow-run-1",
    });
  });

  it("refuses without an open session and never reaches native code", async () => {
    const client = createWorkflowClient(() => null);

    expect(await client.run(lines)).toMatchObject({
      ok: false,
      error: { code: "session_not_open" },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a malformed reply and passes native refusals through", async () => {
    const client = createWorkflowClient(() => authority);
    invoke.mockResolvedValue({ ok: true, value: { ...running, output: "secret" } });
    expect(await client.status("workflow-run-1")).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });

    const untrusted = {
      ok: false as const,
      error: { code: "workflow_untrusted" as const, message: "Not trusted.", retryable: false },
    };
    invoke.mockResolvedValue(untrusted);
    expect(await client.run(lines)).toEqual(untrusted);
  });
});
