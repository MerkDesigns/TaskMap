import { useState } from "react";
import type { DatabaseApplicationRuntime } from "../../features/database-entry/databaseEntryTypes";
import { RetainedCanvasApplication } from "../../legacy/RetainedCanvasApplication";
import { UiLabApp } from "../../ui-lab/UiLabApp";
import { MotionProvider } from "../../ui/motion/MotionProvider";
import { ReducedMotionProvider } from "../../ui/motion/reducedMotionPreference";
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
  return (
    <ReducedMotionProvider override={null}>
      <MotionProvider>
        {view === "app" ? <RetainedCanvasApplication runtime={runtime} /> : <UiLabApp embedded />}
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
        </aside>
      </MotionProvider>
    </ReducedMotionProvider>
  );
}
