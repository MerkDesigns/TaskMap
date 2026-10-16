import { IconPalette } from "@tabler/icons-react";
import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

export const colorPickerConfigurationSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

/**
 * Retired: the full color picker is built into every element menu. Existing installations still
 * parse so their documents open; nothing offers, installs or reads them.
 */
export const colorPickerDefinition = defineRetainedExtension({
  id: asEntityId("extension", "color-picker"),
  label: "Extra colors",
  compatibleElementTypes: ["container", "text-block", "text-card", "mind-map-node"],
  conflictsWith: [],
  stateSchema: colorPickerConfigurationSchema,
  createDefaultState: () => ({ enabled: true }),
  viewKey: "colorPicker",
  catalog: {
    title: "Extra colors",
    description: "Fine-tune and reuse accent colors",
    Icon: IconPalette,
  },
});
