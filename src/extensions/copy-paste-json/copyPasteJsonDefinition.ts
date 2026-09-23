import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

export const copyPasteJsonConfigurationSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const copyPasteJsonDefinition = defineRetainedExtension({
  id: asEntityId("extension", "copy-paste-json"),
  label: "Copy/Paste JSON",
  compatibleElementTypes: ["container"],
  conflictsWith: [],
  stateSchema: copyPasteJsonConfigurationSchema,
  createDefaultState: () => ({ enabled: true }),
  viewKey: "copyPasteJson",
});
