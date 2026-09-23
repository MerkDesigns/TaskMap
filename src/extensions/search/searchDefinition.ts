import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

export const searchConfigurationSchema = z
  .object({
    query: z.string().max(DOCUMENT_LIMITS.jsonStringLength),
  })
  .strict();

export const searchDefinition = defineRetainedExtension({
  id: asEntityId("extension", "search"),
  label: "Search",
  compatibleElementTypes: ["container"],
  conflictsWith: [],
  stateSchema: searchConfigurationSchema,
  createDefaultState: () => ({ query: "" }),
  viewKey: "search",
});
