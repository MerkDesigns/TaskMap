import { IconTerminal2 } from "@tabler/icons-react";
import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

// The same limits the native runner validates (src-tauri workflow_definition.rs).
export const MAX_WORKFLOW_LINES = 32;
export const MAX_LINE_INVOCATIONS = 8;
export const MAX_INVOCATION_ARGUMENTS = 64;
const MAX_TEXT_BYTES = 4096;

const encoder = new TextEncoder();
const text = z
  .string()
  .refine((value) => encoder.encode(value).length <= MAX_TEXT_BYTES && !value.includes("\0"));
const name = text.refine((value) => value.trim().length > 0);

const invocationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("run"),
      executable: name,
      arguments: z.array(text).max(MAX_INVOCATION_ARGUMENTS),
    })
    .strict(),
  z.object({ kind: z.literal("open"), target: name }).strict(),
]);

const workflowLineSchema = z
  .object({
    invocations: z.array(invocationSchema).min(1).max(MAX_LINE_INVOCATIONS),
    workingDirectory: name.nullable(),
    display: z.enum(["terminal", "background"]),
  })
  .strict();

/** A freshly installed workflow has no lines; it cannot run until the editor adds one. */
export const workflowConfigurationSchema = z
  .object({
    lines: z.array(workflowLineSchema).max(MAX_WORKFLOW_LINES),
  })
  .strict();

export type WorkflowInvocation = z.infer<typeof invocationSchema>;
export type WorkflowLine = z.infer<typeof workflowLineSchema>;
export type WorkflowConfiguration = z.infer<typeof workflowConfigurationSchema>;

export const workflowDefinition = defineRetainedExtension({
  id: asEntityId("extension", "workflow"),
  label: "Workflow",
  compatibleElementTypes: ["text-card"],
  conflictsWith: [],
  stateSchema: workflowConfigurationSchema,
  createDefaultState: () => ({ lines: [] }),
  viewKey: "workflow",
  catalog: {
    title: "Workflow",
    description: "Start tools from a card",
    Icon: IconTerminal2,
  },
});
