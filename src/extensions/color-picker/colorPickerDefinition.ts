import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

export const colorPickerConfigurationSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const colorPickerDefinition = defineRetainedExtension({
  id: asEntityId("extension", "color-picker"),
  label: "Extra colors",
  compatibleElementTypes: ["container", "text-block", "text-card", "mind-map-node"],
  conflictsWith: [],
  stateSchema: colorPickerConfigurationSchema,
  createDefaultState: () => ({ enabled: true }),
  viewKey: "colorPicker",
});
