import type { DocumentSettings } from "../../domain/document/documentTypes";
import type { createRetainedCompletionOwner } from "./retainedCompletionOwner";
import {
  RETAINED_VIEW_SETTING_FIELDS,
  type RetainedSettingsUpdate,
} from "./retainedSettingsCommand";

export const retainedSettingFields = [
  "grid.style",
  "grid.opacityPercent.dots",
  "grid.opacityPercent.lines",
  "showElementShadows",
  "allowLockedElementDeletion",
  "minimapEnabled",
] as const;
export type RetainedSettingField = (typeof retainedSettingFields)[number];

function pickSettings(
  settings: DocumentSettings,
  fields: Set<RetainedSettingField>,
): RetainedSettingsUpdate {
  const gridStyle = fields.has("grid.style");
  const dots = fields.has("grid.opacityPercent.dots");
  const lines = fields.has("grid.opacityPercent.lines");
  return {
    ...(gridStyle || dots || lines
      ? {
          grid: {
            ...(gridStyle ? { style: settings.grid.style } : {}),
            ...(dots || lines
              ? {
                  opacityPercent: {
                    ...(dots ? { dots: settings.grid.opacityPercent.dots } : {}),
                    ...(lines ? { lines: settings.grid.opacityPercent.lines } : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(fields.has("showElementShadows")
      ? { showElementShadows: settings.showElementShadows }
      : {}),
    ...(fields.has("allowLockedElementDeletion")
      ? { allowLockedElementDeletion: settings.allowLockedElementDeletion }
      : {}),
    ...(fields.has("minimapEnabled") ? { minimapEnabled: settings.minimapEnabled } : {}),
  };
}

export function retainedSettingsCallbacks(owner: ReturnType<typeof createRetainedCompletionOwner>) {
  return {
    // Capture once when a control edit starts; commit only on completed change. Local previews
    // and cancelled sliders never enter the document or persistence/history pipeline.
    captureDocumentSettings(fields: readonly RetainedSettingField[]) {
      const document = owner.readDocument();
      const selected = new Set(fields);
      if (
        !document ||
        !fields.length ||
        selected.size !== fields.length ||
        fields.some((field) => !retainedSettingFields.includes(field))
      )
        return null;
      const viewOnly = fields.every((field) =>
        (RETAINED_VIEW_SETTING_FIELDS as readonly string[]).includes(field),
      );
      return owner.capture(
        "settings",
        pickSettings(document.documentSettings, selected),
        (from, to: RetainedSettingsUpdate | null) =>
          to === null
            ? null
            : {
                type: viewOnly
                  ? "document.settings.edit-view-captured"
                  : "document.settings.edit-captured",
                payload: { from, to },
              },
      );
    },
  };
}
