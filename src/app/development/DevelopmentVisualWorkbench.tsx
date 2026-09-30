import { useMemo, useState } from "react";
import type { DatabaseApplicationRuntime } from "../../features/database-entry/databaseEntryTypes";
import { RetainedCanvasApplication } from "../../legacy/RetainedCanvasApplication";
import { UiLabApp } from "../../ui-lab/UiLabApp";
import { MotionProvider } from "../../ui/motion/MotionProvider";
import { ReducedMotionProvider } from "../../ui/motion/reducedMotionPreference";
import { PRESENCE_PRESET_LABELS, type PresencePresetName } from "../../ui/motion/presencePresets";
import {
  PresencePresetOverrides,
  type SurfacePresenceName,
} from "../../ui/motion/usePresenceMotion";
import { BlurPresenceTuning } from "./BlurPresenceTuning";
import { WorkbenchTools } from "./WorkbenchTools";
import "../../ui-lab/uiLab.css";
import "./visualWorkbench.css";
import { WorkspaceMajorGlassEnabled } from "../../ui/materials/MajorGlassLayer";
import { SmallGlassOutputMaskEnabled } from "../../ui/materials/sharedSmallOutputMask";

/** View ownership only. The admitted database/session/resources outlive both views. */
export default function DevelopmentVisualWorkbench({
  runtime,
}: {
  readonly runtime: DatabaseApplicationRuntime;
}) {
  const [view, setView] = useState<"app" | "lab">("app");
  const [sharedMajor, setSharedMajor] = useState(true);
  const [outputMaskedMinor, setOutputMaskedMinor] = useState(true);
  const [quickExtensionsPreset, setQuickExtensionsPreset] =
    useState<PresencePresetName>("materialFadeSlideUp");
  const [sidePanelPreset, setSidePanelPreset] =
    useState<SurfacePresenceName>("fadeScaleOffscreenSlide");
  const [minimapPreset, setMinimapPreset] = useState<PresencePresetName>("materialFade");
  const [dialogPreset, setDialogPreset] = useState<PresencePresetName>("materialFadeSettle");
  const presenceOverrides = useMemo(
    () => ({
      quickExtensions: quickExtensionsPreset,
      sidePanel: sidePanelPreset,
      minimap: minimapPreset,
      dialogs: dialogPreset,
    }),
    [dialogPreset, minimapPreset, quickExtensionsPreset, sidePanelPreset],
  );
  return (
    <ReducedMotionProvider override={null}>
      <MotionProvider>
        <WorkspaceMajorGlassEnabled.Provider value={sharedMajor}>
          <SmallGlassOutputMaskEnabled.Provider value={outputMaskedMinor}>
            <PresencePresetOverrides.Provider value={presenceOverrides}>
              {view === "app" ? (
                <RetainedCanvasApplication runtime={runtime} />
              ) : (
                <UiLabApp embedded />
              )}
            </PresencePresetOverrides.Provider>
          </SmallGlassOutputMaskEnabled.Provider>
        </WorkspaceMajorGlassEnabled.Provider>
        <aside
          className="taskmap-workbench"
          data-native-tab-navigation="true"
          aria-label="Development workbench"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <nav aria-label="Development view">
            <span>DEV</span>
            <button type="button" aria-pressed={view === "app"} onClick={() => setView("app")}>
              App
            </button>
            <button type="button" aria-pressed={view === "lab"} onClick={() => setView("lab")}>
              UI Lab
            </button>
          </nav>
          <WorkbenchTools />
          <label>
            <input
              type="checkbox"
              checked={sharedMajor}
              onChange={(e) => setSharedMajor(e.target.checked)}
            />
            Shared workspace Major glass
          </label>
          <label>
            <input
              type="checkbox"
              checked={outputMaskedMinor}
              onChange={(e) => setOutputMaskedMinor(e.target.checked)}
            />
            Output-masked Minor glass
          </label>
          <label>
            Quick Extensions motion
            <select
              value={quickExtensionsPreset}
              onChange={(e) => setQuickExtensionsPreset(e.target.value as PresencePresetName)}
            >
              {presetOptions()}
            </select>
          </label>
          <label>
            Side panel motion
            <select
              value={sidePanelPreset}
              onChange={(e) => setSidePanelPreset(e.target.value as SurfacePresenceName)}
            >
              <option value="fadeScaleOffscreenSlide">
                Material fade + Off-screen slide + Scale
              </option>
              <option value="fadeOffscreenSlide">Material fade + Off-screen slide</option>
              <option value="offscreenSlide">Off-screen slide</option>
              {presetOptions()}
            </select>
          </label>
          <label>
            Minimap motion
            <select
              value={minimapPreset}
              onChange={(e) => setMinimapPreset(e.target.value as PresencePresetName)}
            >
              {presetOptions()}
            </select>
          </label>
          <label>
            Dialog motion
            <select
              value={dialogPreset}
              onChange={(e) => setDialogPreset(e.target.value as PresencePresetName)}
            >
              {presetOptions()}
            </select>
          </label>
          <BlurPresenceTuning />
        </aside>
      </MotionProvider>
    </ReducedMotionProvider>
  );
}

function presetOptions() {
  return Object.entries(PRESENCE_PRESET_LABELS).map(([name, label]) => (
    <option key={name} value={name}>
      {label}
    </option>
  ));
}
