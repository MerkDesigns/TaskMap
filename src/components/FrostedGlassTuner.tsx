import { useEffect, useMemo, useState } from "react";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import {
  GeometryTunerRange,
  MaterialTunerPanel,
  PreviewTunerPanel,
} from "./FrostedGlassTunerPanels";
import {
  applyTunerDraft,
  valuesForTunerTab,
  type GlassMaterialTuningValues,
  type GlassMaterialValues,
  type PreviewTuningValues,
  type TunerTab,
  type WorkspaceGeometryValues,
} from "./FrostedGlassTunerState";
import "./FrostedGlassTuner.css";

export type {
  GlassMaterialTuningValues,
  GlassMaterialValues,
  PreviewTuningValues,
  WorkspaceGeometryValues,
} from "./FrostedGlassTunerState";

type FrostedGlassTunerProps = {
  materialValues: GlassMaterialValues;
  previewValues: PreviewTuningValues;
  geometryValues: WorkspaceGeometryValues;
  onMaterialChange: (values: GlassMaterialValues) => void;
  onPreviewChange: (values: PreviewTuningValues) => void;
  onGeometryChange: (values: WorkspaceGeometryValues) => void;
};

const TAB_LABELS: Record<TunerTab, string> = {
  large: "Large",
  small: "Small",
  preview: "Preview",
  gaps: "Gaps",
};

export function FrostedGlassTuner({
  materialValues,
  previewValues,
  geometryValues,
  onMaterialChange,
  onPreviewChange,
  onGeometryChange,
}: FrostedGlassTunerProps) {
  const [tab, setTab] = useState<TunerTab>("large");
  const activeValues = useMemo(
    () => valuesForTunerTab(tab, materialValues, previewValues, geometryValues),
    [geometryValues, materialValues, previewValues, tab],
  );
  const serializedValues = useMemo(() => JSON.stringify(activeValues, null, 2), [activeValues]);
  const [draft, setDraft] = useState(serializedValues);

  useEffect(() => setDraft(serializedValues), [serializedValues]);

  const updateMaterial = <Key extends keyof GlassMaterialTuningValues>(
    key: Key,
    value: GlassMaterialTuningValues[Key],
  ) => {
    if (tab !== "large" && tab !== "small") return;
    onMaterialChange({
      ...materialValues,
      [tab]: { ...materialValues[tab], [key]: value },
    });
  };

  return (
    <MaterialSurface
      material="acrylic-large"
      radius={geometryValues.canvasBrowserRadius}
      className="taskmap-visual-tuner"
    >
      <div className="taskmap-visual-tuner__content">
        <div className="mb-3 flex rounded-lg border border-white/[0.10] bg-[#111216]/65 p-0.5">
          {(Object.keys(TAB_LABELS) as TunerTab[]).map((tunerTab) => (
            <button
              key={tunerTab}
              className={`h-7 flex-1 rounded-md text-[11px] font-semibold transition-colors ${
                tab === tunerTab
                  ? "bg-white/[0.12] text-white"
                  : "text-white/48 hover:text-white/72"
              }`}
              onClick={() => setTab(tunerTab)}
            >
              {TAB_LABELS[tunerTab]}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {(tab === "large" || tab === "small") && (
            <MaterialTunerPanel
              tab={tab}
              material={materialValues[tab]}
              updateMaterial={updateMaterial}
            />
          )}
          {tab === "large" && (
            <>
              <GeometryTunerRange
                label="Canvas Browser radius"
                field="canvasBrowserRadius"
                geometry={geometryValues}
                max={40}
                onChange={onGeometryChange}
              />
              <GeometryTunerRange
                label="Top bars radius"
                field="topBarRadius"
                geometry={geometryValues}
                max={32}
                onChange={onGeometryChange}
              />
            </>
          )}
          {tab === "small" && (
            <GeometryTunerRange
              label="Canvas card radius"
              field="canvasCardRadius"
              geometry={geometryValues}
              max={24}
              onChange={onGeometryChange}
            />
          )}
          {tab === "preview" && (
            <PreviewTunerPanel values={previewValues} onChange={onPreviewChange} />
          )}
          {tab === "gaps" && (
            <>
              <GeometryTunerRange
                label="Side edge gap"
                field="sideInset"
                geometry={geometryValues}
                max={48}
                step={1}
                onChange={onGeometryChange}
              />
              <GeometryTunerRange
                label="Top edge gap"
                field="topInset"
                geometry={geometryValues}
                max={48}
                step={1}
                onChange={onGeometryChange}
              />
              <GeometryTunerRange
                label="Top bar / side panel gap"
                field="panelGap"
                geometry={geometryValues}
                max={64}
                step={1}
                onChange={onGeometryChange}
              />
            </>
          )}
        </div>

        <textarea
          className="mt-3 h-32 w-full resize-none rounded-lg border border-white/[0.10] bg-[#111216]/65 p-2 font-mono text-[11px] leading-4 text-white/72 outline-none focus:border-white/[0.20]"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setDraft(serializedValues)}
          spellCheck={false}
        />
        <div className="mt-2 flex justify-end">
          <button
            className="rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-1 text-xs font-medium text-white/68 hover:bg-white/[0.10] hover:text-white"
            onClick={() => {
              try {
                applyTunerDraft(
                  JSON.parse(draft) as Record<string, unknown>,
                  tab,
                  materialValues,
                  previewValues,
                  geometryValues,
                  onMaterialChange,
                  onPreviewChange,
                  onGeometryChange,
                );
              } catch {
                setDraft(serializedValues);
              }
            }}
          >
            Apply pasted values
          </button>
        </div>
      </div>
    </MaterialSurface>
  );
}
