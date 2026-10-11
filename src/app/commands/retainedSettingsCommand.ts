import { z } from "zod";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import {
  settingsUpdateSchema,
  documentSettingsCommandHandlers,
} from "../../domain/commands/core/documentSettingsCommands";

export type RetainedSettingsUpdate = z.infer<typeof settingsUpdateSchema>;
export function settingsEntries(settings: RetainedSettingsUpdate) {
  return Object.entries({
    "grid.style": settings.grid?.style,
    "grid.opacityPercent.dots": settings.grid?.opacityPercent?.dots,
    "grid.opacityPercent.lines": settings.grid?.opacityPercent?.lines,
    showElementShadows: settings.showElementShadows,
    allowLockedElementDeletion: settings.allowLockedElementDeletion,
    minimapEnabled: settings.minimapEnabled,
  }).filter(([, value]) => value !== undefined);
}
const updateSettings = documentSettingsCommandHandlers.find(
  (handler) => handler.type === "document.settings.update",
)!;

// Reuse the existing field-local command inside one transaction. Device/view preferences are
// deliberately absent from this payload; neither slider previews nor camera samples dispatch it.
function capturedSettingsCommand(type: string, history: "record" | "ignore") {
  return defineCommandHandler({
    type,
    label: "Update document settings",
    history,
    payloadSchema: z.object({ from: settingsUpdateSchema, to: settingsUpdateSchema }).strict(),
    apply(document, { from, to }) {
      const expected = settingsEntries(from);
      const proposed = new Map(settingsEntries(to));
      const current = new Map(settingsEntries(document.documentSettings));
      if (
        !expected.length ||
        expected.length !== proposed.size ||
        expected.some(([field, value]) => !proposed.has(field) || current.get(field) !== value)
      )
        return [
          commandRejected(
            "command.payload",
            "Settings fields are invalid or changed before completion.",
          ),
        ];
      return updateSettings.apply(document, { settings: to });
    },
  });
}

export const editRetainedSettingsCommand = capturedSettingsCommand(
  "document.settings.edit-captured",
  "record",
);

/** Settings a toolbar button toggles: switching a view on or off is not a step to undo. */
export const RETAINED_VIEW_SETTING_FIELDS = ["minimapEnabled"] as const;

export const editRetainedViewSettingsCommand = capturedSettingsCommand(
  "document.settings.edit-view-captured",
  "ignore",
);
