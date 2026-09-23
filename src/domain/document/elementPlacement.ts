import { z } from "zod";
import { DOCUMENT_LIMITS } from "./documentLimits";
import { entityIdSchema } from "./documentSchema";

// Shared child-owned placement for cards and images; null denotes a root element.
export const containerPlacementSchema = z
  .object({
    containerId: entityIdSchema("element"),
    order: z
      .number()
      .int()
      .min(0)
      .max(DOCUMENT_LIMITS.elementCount - 1),
  })
  .strict()
  .nullable();

export type ContainerPlacement = z.infer<typeof containerPlacementSchema>;
