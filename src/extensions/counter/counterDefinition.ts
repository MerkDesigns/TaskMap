import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

export const counterConfigurationSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const counterDefinition = defineRetainedExtension({
  id: asEntityId("extension", "counter"),
  label: "Counter",
  compatibleElementTypes: ["container"],
  conflictsWith: [],
  stateSchema: counterConfigurationSchema,
  createDefaultState: () => ({ enabled: true }),
  viewKey: "counter",
});
