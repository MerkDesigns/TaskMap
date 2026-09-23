import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

export const lockConfigurationSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const lockDefinition = defineRetainedExtension({
  id: asEntityId("extension", "lock"),
  label: "Lock",
  compatibleElementTypes: ["container", "text-block", "text-card", "mind-map-node", "image"],
  conflictsWith: [],
  stateSchema: lockConfigurationSchema,
  createDefaultState: () => ({ enabled: true }),
  viewKey: "lock",
});
