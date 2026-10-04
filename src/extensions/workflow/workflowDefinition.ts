import { IconTerminal2 } from "@tabler/icons-react";
import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

// The same limits the native runner validates (src-tauri workflow_definition.rs).
export const MAX_WORKFLOW_STEPS = 32;
export const MAX_STEP_ARGUMENTS = 64;
const MAX_TEXT_BYTES = 4096;

const encoder = new TextEncoder();
const stepText = z
  .string()
  .refine((value) => encoder.encode(value).length <= MAX_TEXT_BYTES && !value.includes("\0"));

const workflowStepSchema = z
  .object({
    executable: stepText.refine((value) => value.trim().length > 0),
    arguments: z.array(stepText).max(MAX_STEP_ARGUMENTS),
    workingDirectory: stepText.refine((value) => value.trim().length > 0).nullable(),
    display: z.enum(["terminal", "background"]),
    waitForExit: z.boolean(),
  })
  .strict();

/** A freshly installed workflow has no steps; it cannot run until the editor adds one. */
export const workflowConfigurationSchema = z
  .object({
    steps: z.array(workflowStepSchema).max(MAX_WORKFLOW_STEPS),
  })
  .strict();

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type WorkflowConfiguration = z.infer<typeof workflowConfigurationSchema>;

export const workflowDefinition = defineRetainedExtension({
  id: asEntityId("extension", "workflow"),
  label: "Workflow",
  compatibleElementTypes: ["text-card"],
  conflictsWith: [],
  stateSchema: workflowConfigurationSchema,
  createDefaultState: () => ({ steps: [] }),
  viewKey: "workflow",
  catalog: {
    title: "Workflow",
    description: "Start tools from a card",
    Icon: IconTerminal2,
  },
});
