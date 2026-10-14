import { IconFolder } from "@tabler/icons-react";
import { z } from "zod";
import { asEntityId } from "../../domain/ids/entityIds";
import { defineRetainedExtension } from "../retainedExtensionDefinition";

/** Long enough for Windows long paths; the native command validates the folder itself. */
export const MAX_FOLDER_PATH_LENGTH = 4096;

export const folderConfigurationSchema = z
  .object({
    path: z
      .string()
      .max(MAX_FOLDER_PATH_LENGTH)
      .refine((value) => !value.includes("\0")),
  })
  .strict();

export type FolderConfiguration = z.infer<typeof folderConfigurationSchema>;

/** A pasted path as it is stored: trimmed, without the quotes Explorer's "Copy as path" adds. */
export function normalizeFolderPath(input: string): string {
  const trimmed = input.trim();
  return (
    trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1)
      : trimmed
  ).trim();
}

export const folderDefinition = defineRetainedExtension({
  id: asEntityId("extension", "folder"),
  label: "Folder",
  compatibleElementTypes: ["text-card"],
  conflictsWith: [],
  stateSchema: folderConfigurationSchema,
  createDefaultState: () => ({ path: "" }),
  viewKey: "folder",
  catalog: { title: "Folder", description: "Open a folder from a card", Icon: IconFolder },
});
