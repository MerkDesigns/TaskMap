import { IconCheckbox } from "@tabler/icons-react";
import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

export const checkboxConfigurationSchema = z
  .object({
    checked: z.boolean(),
  })
  .strict();

export const checkboxDefinition = defineRetainedExtension({
  id: asEntityId("extension", "checkbox"),
  label: "Checkbox",
  compatibleElementTypes: ["text-card"],
  conflictsWith: [],
  stateSchema: checkboxConfigurationSchema,
  createDefaultState: () => ({ checked: false }),
  viewKey: "checkbox",
  catalog: { title: "Checkbox", description: "Add checkable text cards", Icon: IconCheckbox },
});
