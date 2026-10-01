import { useState } from "react";
import { GlassRenderingProof } from "./glass-proof/GlassRenderingProof";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import { Button } from "../ui/primitives/Button";
import { TextField } from "../ui/primitives/FormControls";
import { CanvasFrame } from "../ui/patterns/workspace/CanvasFrame";
import { WorkspaceRoot } from "../ui/patterns/workspace/WorkspaceRoot";
import { DraggableTextBlockFixture } from "./DraggableTextBlockFixture";
import { ContextMenuPlayground } from "./ContextMenuPlayground";
import { InteractiveControlsPrototype } from "./InteractiveControlsPrototype";
import { MaterialAwarePresencePrototype } from "./MaterialAwarePresencePrototype";
import { QuickExtensionsMenuPlayground } from "./QuickExtensionsMenuPlayground";
import { SurfaceMaterialPrototype } from "./SurfaceMaterialPrototype";
import { TopBarControlsPrototype } from "./TopBarControlsPrototype";

/** The development workbench's UI Lab view; the database application owns the window chrome. */
export function UiLabApp() {
  const [proof, setProof] = useState(false);
  return (
    <WorkspaceRoot data-taskmap-ui-lab="workbench-baseline">
      <CanvasFrame
        aria-hidden="true"
        className="taskmap-ui-lab__background"
        data-grid-style="dots"
      />

      <div className="taskmap-ui-lab__viewport" data-ui-lab-scroll-viewport>
        <div className="taskmap-ui-lab__stage">
          <nav aria-label="Lab scene">
            <Button aria-pressed={!proof} onClick={() => setProof(false)}>
              Existing fixtures
            </Button>
            <Button aria-pressed={proof} onClick={() => setProof(true)}>
              Rendering proof
            </Button>
          </nav>
          {proof ? (
            <GlassRenderingProof />
          ) : (
            <>
              <p className="taskmap-ui-lab__status">
                Current material baseline — architecture not migrated
              </p>

              <MaterialSurface
                as="section"
                className="taskmap-ui-lab__major"
                material="acrylic-large"
              >
                <header className="taskmap-ui-lab__heading">
                  <span className="taskmap-ui-lab__eyebrow">TaskMap UI Lab</span>
                  <h1>Current Major baseline</h1>
                  <p>Production materials and synthetic interaction fixtures.</p>
                </header>

                <div className="taskmap-ui-lab__samples">
                  <MaterialSurface
                    as="section"
                    className="taskmap-ui-lab__sample"
                    material="acrylic-small"
                  >
                    <h2>Current Minor baseline</h2>
                    <p>Ordinary text remains normal HTML content.</p>
                    <Button size="compact">Sample action</Button>
                  </MaterialSurface>

                  <MaterialSurface
                    as="section"
                    className="taskmap-ui-lab__sample"
                    material="opaque"
                  >
                    <h2>Current Opaque baseline</h2>
                    <p>A non-transparent production material.</p>
                  </MaterialSurface>

                  <MaterialSurface
                    as="section"
                    className="taskmap-ui-lab__sample"
                    material="cutout"
                    radius={8}
                  >
                    <h2>Current Cutout baseline</h2>
                    <TextField aria-label="Baseline text field" defaultValue="Visual context" />
                  </MaterialSurface>
                </div>
              </MaterialSurface>

              <SurfaceMaterialPrototype />
              <DraggableTextBlockFixture />
              <MaterialAwarePresencePrototype />
              <TopBarControlsPrototype />
              <ContextMenuPlayground />
              <QuickExtensionsMenuPlayground />
              <InteractiveControlsPrototype />
            </>
          )}
        </div>
      </div>
    </WorkspaceRoot>
  );
}
