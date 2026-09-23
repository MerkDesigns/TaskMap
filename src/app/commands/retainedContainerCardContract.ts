import { z } from "zod";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import {
  entityIdSchema,
  elementGeometrySchema,
  extensionInstallationSchema,
} from "../../domain/document/documentSchema";
import { textCardElementSchema, textCardDataSchema } from "../../elements/text-card/textCardModel";
import { copyPasteJsonPayloadSchema } from "../../extensions/copyPasteJson";
import { retainedContainerSnapshotSchema } from "./retainedContainerSnapshot";

export const checkboxInstallationIdSchema = entityIdSchema("extension-instance").nullable();
export const newContainerCardSchema = z
  .object({
    id: entityIdSchema("element"),
    geometry: elementGeometrySchema,
    data: textCardDataSchema.omit({ placement: true }),
    checkboxInstallationId: checkboxInstallationIdSchema,
  })
  .strict();
export type NewContainerCard = z.infer<typeof newContainerCardSchema>;

export const insertContainerCardSchema = z
  .object({
    expected: retainedContainerSnapshotSchema,
    origin: z.enum(["create", "paste"]),
    card: textCardElementSchema,
    index: z.number().int().min(0).max(DOCUMENT_LIMITS.elementCount),
    installations: z.array(extensionInstallationSchema).max(DOCUMENT_LIMITS.extensionInstanceCount),
    checkboxInstallationId: checkboxInstallationIdSchema,
  })
  .strict();
export const aiCardIdentitySchema = z
  .object({
    id: entityIdSchema("element"),
    geometry: elementGeometrySchema,
    checkboxInstallationId: checkboxInstallationIdSchema,
  })
  .strict();
export type AiCardIdentity = z.infer<typeof aiCardIdentitySchema>;
export const replaceContainerCardsSchema = z
  .object({
    expected: retainedContainerSnapshotSchema,
    payload: copyPasteJsonPayloadSchema,
    cards: z.array(aiCardIdentitySchema).max(DOCUMENT_LIMITS.elementCount),
  })
  .strict();
