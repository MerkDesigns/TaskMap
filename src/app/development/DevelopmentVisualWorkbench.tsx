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

/** View ownership only. The admitted database/session/resources outlive both views. */
export default function DevelopmentVisualWorkbench({
  runtime,
}: {
  readonly runtime: DatabaseApplicationRuntime;
}) {
  const [view, setView] = useState<"app" | "lab">("app");
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [quickExtensionsPreset, setQuickExtensionsPreset] =
    useState<PresencePresetName>("materialFadeSlideUp");
  const [sidePanelPreset, setSidePanelPreset] =
    useState<SurfacePresenceName>("fadeScaleOffscreenSlide");
  const [minimapPreset, setMinimapPreset] = useState<PresencePresetName>("materialFade");
  const [dialogPreset, setDialogPreset] = useState<PresencePresetName>("materialFade");
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
        <PresencePresetOverrides.Provider value={presenceOverrides}>
          {view === "app" ? <RetainedCanvasApplication runtime={runtime} /> : <UiLabApp />}
        </PresencePresetOverrides.Provider>
        <aside
          className="taskmap-workbench"
          data-collapsed={collapsed || undefined}
          data-native-tab-navigation="true"
          aria-label="Development workbench"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <nav aria-label="Development view">
            <button
              type="button"
              className="taskmap-workbench__toggle"
              aria-expanded={!collapsed}
              aria-label={
                collapsed ? "Expand development workbench" : "Collapse development workbench"
              }
              title={collapsed ? "Expand" : "Collapse"}
              onClick={() => {
                setCollapsed(!collapsed);
                writeCollapsed(!collapsed);
              }}
            >
              DEV
            </button>
            {collapsed ? null : (
              <>
                <button type="button" aria-pressed={view === "app"} onClick={() => setView("app")}>
                  App
                </button>
                <button type="button" aria-pressed={view === "lab"} onClick={() => setView("lab")}>
                  UI Lab
                </button>
              </>
            )}
          </nav>
          {/* Hidden, not unmounted: the tuning controls keep their state while collapsed. */}
          <div className="taskmap-workbench__body" hidden={collapsed}>
            <WorkbenchTools />
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
          </div>
        </aside>
      </MotionProvider>
    </ReducedMotionProvider>
  );
}

const COLLAPSED_KEY = "taskmap.dev.workbenchCollapsed";

/** Per-developer convenience only; storage may be unavailable, so failures fall back to expanded. */
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    /* Remembering the collapsed state is optional. */
  }
}

function presetOptions() {
  return Object.entries(PRESENCE_PRESET_LABELS).map(([name, label]) => (
    <option key={name} value={name}>
      {label}
    </option>
  ));
}
