import { TunerColor, TunerRange } from "./FrostedGlassTunerControls";
import type {
  GlassMaterialTuningValues,
  PreviewTuningValues,
  WorkspaceGeometryValues,
} from "./FrostedGlassTunerState";

export function MaterialTunerPanel({
  tab,
  material,
  updateMaterial,
}: {
  tab: "large" | "small";
  material: GlassMaterialTuningValues;
  updateMaterial: <Key extends keyof GlassMaterialTuningValues>(
    key: Key,
    value: GlassMaterialTuningValues[Key],
  ) => void;
}) {
  return (
    <>
      <TunerColor
        defaultValue={tab === "large" ? "#babec4" : "#b6b7c3"}
        label="Tint color"
        name={`${tab} tint color`}
        value={material.tintColor}
        onChange={(value) => updateMaterial("tintColor", value)}
      />
      <TunerRange
        defaultValue={tab === "large" ? 0.075 : 0}
        label="Tint opacity"
        min={0}
        max={1}
        step={0.005}
        value={material.tintOpacity}
        onChange={(value) => updateMaterial("tintOpacity", value)}
      />
      <TunerRange
        defaultValue={tab === "large" ? 60 : 23.5}
        label="Blur"
        min={0}
        max={tab === "large" ? 80 : 60}
        step={0.5}
        suffix="px"
        value={material.blur}
        onChange={(value) => updateMaterial("blur", value)}
      />
      <TunerRange
        defaultValue={tab === "large" ? 0.98 : 1.15}
        label="Border brightness"
        min={0}
        max={2}
        step={0.01}
        value={material.borderBrightness}
        onChange={(value) => updateMaterial("borderBrightness", value)}
      />
    </>
  );
}

export function PreviewTunerPanel({
  values,
  onChange,
}: {
  values: PreviewTuningValues;
  onChange: (values: PreviewTuningValues) => void;
}) {
  const update = <Key extends keyof PreviewTuningValues>(
    key: Key,
    value: PreviewTuningValues[Key],
  ) => onChange({ ...values, [key]: value });
  return (
    <>
      <TunerColor
        defaultValue="#0c0c0d"
        label="Tint color"
        name="preview tint color"
        value={values.tintColor}
        onChange={(value) => update("tintColor", value)}
      />
      <TunerRange
        defaultValue={0.665}
        label="Tint opacity"
        min={0}
        max={1}
        step={0.005}
        value={values.tintOpacity}
        onChange={(value) => update("tintOpacity", value)}
      />
      <TunerRange
        defaultValue={1}
        label="Border thickness"
        min={0}
        max={6}
        step={0.25}
        suffix="px"
        value={values.borderThickness}
        onChange={(value) => update("borderThickness", value)}
      />
      <TunerRange
        defaultValue={0.29}
        label="Border opacity"
        min={0}
        max={1}
        step={0.01}
        value={values.borderOpacity}
        onChange={(value) => update("borderOpacity", value)}
      />
      <TunerColor
        defaultValue="#736f7b"
        label="Border color"
        name="preview border color"
        value={values.borderColor}
        onChange={(value) => update("borderColor", value)}
      />
      <TunerRange
        defaultValue={9}
        label="Preview gap"
        min={0}
        max={20}
        step={0.5}
        suffix="px"
        value={values.gap}
        onChange={(value) => update("gap", value)}
      />
    </>
  );
}

export function GeometryTunerRange({
  field,
  geometry,
  label,
  max,
  onChange,
  step = 0.5,
}: {
  field: keyof WorkspaceGeometryValues;
  geometry: WorkspaceGeometryValues;
  label: string;
  max: number;
  onChange: (values: WorkspaceGeometryValues) => void;
  step?: number;
}) {
  return (
    <TunerRange
      defaultValue={GEOMETRY_DEFAULTS[field]}
      label={label}
      min={0}
      max={max}
      step={step}
      suffix="px"
      value={geometry[field]}
      onChange={(value) => onChange({ ...geometry, [field]: value })}
    />
  );
}

const GEOMETRY_DEFAULTS: WorkspaceGeometryValues = {
  canvasBrowserRadius: 19,
  canvasCardRadius: 13,
  topBarRadius: 14,
  sideInset: 16,
  topInset: 16,
  panelGap: 15,
};
