import { IconChecklist } from "@tabler/icons-react";
import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

export const autoCheckboxConfigurationSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const autoCheckboxDefinition = defineRetainedExtension({
  id: asEntityId("extension", "auto-checkbox"),
  label: "Auto checkboxes",
  compatibleElementTypes: ["container"],
  conflictsWith: [],
  stateSchema: autoCheckboxConfigurationSchema,
  createDefaultState: () => ({ enabled: true }),
  viewKey: "autoCheckbox",
  catalog: {
    title: "Auto checkboxes",
    description: "Checkboxes on new cards",
    Icon: IconChecklist,
  },
});
