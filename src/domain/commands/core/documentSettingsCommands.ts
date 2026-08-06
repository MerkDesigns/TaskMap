import { z } from "zod";
import { documentSettingsSchema } from "../../document/documentSchema";
import type { DomainCommandHandler } from "../commandHandler";
import { defineCommandHandler } from "../commandHandler";

const gridUpdateSchema = z
  .object({
    style: documentSettingsSchema.shape.grid.shape.style.optional(),
    opacityPercent: documentSettingsSchema.shape.grid.shape.opacityPercent.partial().optional(),
  })
  .strict();

const settingsUpdateSchema = z
  .object({
    grid: gridUpdateSchema.optional(),
    showElementShadows: z.boolean().optional(),
    allowLockedElementDeletion: z.boolean().optional(),
    minimapEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one setting is required");

export const documentSettingsCommandHandlers = [
  defineCommandHandler({
    type: "document.settings.update",
    label: "Update document settings",
    history: "record",
    payloadSchema: z.object({ settings: settingsUpdateSchema }).strict(),
    apply(document, payload) {
      const update = payload.settings;
      if (update.grid?.style !== undefined)
        document.documentSettings.grid.style = update.grid.style;
      if (update.grid?.opacityPercent?.dots !== undefined) {
        document.documentSettings.grid.opacityPercent.dots = update.grid.opacityPercent.dots;
      }
      if (update.grid?.opacityPercent?.lines !== undefined) {
        document.documentSettings.grid.opacityPercent.lines = update.grid.opacityPercent.lines;
      }
      if (update.showElementShadows !== undefined) {
        document.documentSettings.showElementShadows = update.showElementShadows;
      }
      if (update.allowLockedElementDeletion !== undefined) {
        document.documentSettings.allowLockedElementDeletion = update.allowLockedElementDeletion;
      }
      if (update.minimapEnabled !== undefined) {
        document.documentSettings.minimapEnabled = update.minimapEnabled;
      }
    },
  }),
] as const satisfies readonly DomainCommandHandler[];
