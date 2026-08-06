import type { WorkflowExecutionId } from "../../domain/ids/entityIds";

export type WorkflowDisplayMode = "visible" | "background";

export interface LaunchWorkflowRequest {
  readonly workflowId: string;
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly workingDirectory: string | null;
  readonly displayMode: WorkflowDisplayMode;
}

export type WorkflowExecutionState = "starting" | "running" | "completed" | "failed" | "stopped";

export interface WorkflowExecution {
  readonly id: WorkflowExecutionId;
  readonly state: WorkflowExecutionState;
  readonly exitCode: number | null;
}
