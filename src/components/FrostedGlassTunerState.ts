export type GlassMaterialTuningValues = {
  tintColor: string;
  tintOpacity: number;
  blur: number;
  borderBrightness: number;
};

export type GlassMaterialValues = {
  large: GlassMaterialTuningValues;
  small: GlassMaterialTuningValues;
};

export type PreviewTuningValues = {
  tintColor: string;
  tintOpacity: number;
  borderThickness: number;
  borderOpacity: number;
  borderColor: string;
  gap: number;
};

export type WorkspaceGeometryValues = {
  canvasBrowserRadius: number;
  canvasCardRadius: number;
  topBarRadius: number;
  sideInset: number;
  topInset: number;
  panelGap: number;
};

export type TunerTab = "large" | "small" | "preview" | "gaps";

export function valuesForTunerTab(
  tab: TunerTab,
  materials: GlassMaterialValues,
  preview: PreviewTuningValues,
  geometry: WorkspaceGeometryValues,
) {
  if (tab === "preview") return preview;
  if (tab === "gaps") {
    return {
      sideInset: geometry.sideInset,
      topInset: geometry.topInset,
      panelGap: geometry.panelGap,
    };
  }
  return {
    ...materials[tab],
    ...(tab === "large"
      ? {
          canvasBrowserRadius: geometry.canvasBrowserRadius,
          topBarRadius: geometry.topBarRadius,
        }
      : { canvasCardRadius: geometry.canvasCardRadius }),
  };
}

export function applyTunerDraft(
  parsed: Record<string, unknown>,
  tab: TunerTab,
  materials: GlassMaterialValues,
  preview: PreviewTuningValues,
  geometry: WorkspaceGeometryValues,
  changeMaterials: (values: GlassMaterialValues) => void,
  changePreview: (values: PreviewTuningValues) => void,
  changeGeometry: (values: WorkspaceGeometryValues) => void,
) {
  if (tab === "large" || tab === "small") {
    const current = materials[tab];
    changeMaterials({
      ...materials,
      [tab]: {
        tintColor: stringValue(parsed.tintColor, current.tintColor),
        tintOpacity: numberValue(parsed.tintOpacity, current.tintOpacity),
        blur: numberValue(parsed.blur, current.blur),
        borderBrightness: numberValue(parsed.borderBrightness, current.borderBrightness),
      },
    });
  } else if (tab === "preview") {
    changePreview({
      tintColor: stringValue(parsed.tintColor, preview.tintColor),
      tintOpacity: numberValue(parsed.tintOpacity, preview.tintOpacity),
      borderThickness: numberValue(parsed.borderThickness, preview.borderThickness),
      borderOpacity: numberValue(parsed.borderOpacity, preview.borderOpacity),
      borderColor: stringValue(parsed.borderColor, preview.borderColor),
      gap: numberValue(parsed.gap, preview.gap),
    });
  }

  changeGeometry(
    Object.fromEntries(
      Object.entries(geometry).map(([key, value]) => [key, numberValue(parsed[key], value)]),
    ) as WorkspaceGeometryValues,
  );
}

function numberValue(value: unknown, fallback: number): number {
  const result = Number(value ?? fallback);
  return Number.isFinite(result) ? result : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
