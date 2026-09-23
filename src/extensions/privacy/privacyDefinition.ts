import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

export const privacyConfigurationSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const privacyDefinition = defineRetainedExtension({
  id: asEntityId("extension", "privacy"),
  label: "Privacy",
  compatibleElementTypes: ["container", "text-block"],
  conflictsWith: [],
  stateSchema: privacyConfigurationSchema,
  createDefaultState: () => ({ enabled: true }),
  viewKey: "privacy",
});
