import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

export const inheritCardColorConfigurationSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const inheritCardColorDefinition = defineRetainedExtension({
  id: asEntityId("extension", "inherit-card-color"),
  label: "Inherit color",
  compatibleElementTypes: ["container"],
  conflictsWith: [],
  stateSchema: inheritCardColorConfigurationSchema,
  createDefaultState: () => ({ enabled: true }),
  viewKey: "inheritCardColor",
});
