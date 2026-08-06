import type { WorkflowExecutionId } from "../../domain/ids/entityIds";
import type { PlatformResult } from "../platformErrors";
import type { LaunchWorkflowRequest, WorkflowExecution } from "./workflowTypes";

export interface WorkflowClient {
  launch(request: LaunchWorkflowRequest): Promise<PlatformResult<WorkflowExecution>>;
  status(id: WorkflowExecutionId): Promise<PlatformResult<WorkflowExecution>>;
  stop(id: WorkflowExecutionId): Promise<PlatformResult<WorkflowExecution>>;
}
