import { MaterialCompositorProvider } from "../ui/materials/MaterialCompositorProvider";
import { createMaterialCompositorPresentationBridge } from "../ui/materials/materialCompositorPresentation";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import { MotionProvider } from "../ui/motion/MotionProvider";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { Button } from "../ui/primitives/Button";
import { TextField } from "../ui/primitives/FormControls";
import { CanvasFrame } from "../ui/patterns/workspace/CanvasFrame";
import { WorkspaceChromeLayer, WorkspaceRoot } from "../ui/patterns/workspace/WorkspaceRoot";
import { WindowChrome } from "../components/WindowChrome";
import { DraggableTextBlockFixture } from "./DraggableTextBlockFixture";
import { ContextMenuPlayground } from "./ContextMenuPlayground";
import { InteractiveControlsPrototype } from "./InteractiveControlsPrototype";
import { MaterialAwarePresencePrototype } from "./MaterialAwarePresencePrototype";
import { SurfaceMaterialPrototype } from "./SurfaceMaterialPrototype";
import { TopBarControlsPrototype } from "./TopBarControlsPrototype";

const presentation = createMaterialCompositorPresentationBridge();

export function UiLabApp() {
  return (
    <ReducedMotionProvider override={null}>
        <MotionProvider>
          <MaterialCompositorProvider presentation={presentation}>
            <WorkspaceRoot data-taskmap-ui-lab="isolated-baseline">
              <CanvasFrame
                aria-hidden="true"
                className="taskmap-ui-lab__background"
                data-grid-style="dots"
              />

              <div className="taskmap-ui-lab__viewport" data-ui-lab-scroll-viewport>
                <div className="taskmap-ui-lab__stage">
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
                      <p>Production materials rendered in an isolated Tauri WebView2.</p>
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
                  <InteractiveControlsPrototype />
                </div>
              </div>

              <WorkspaceChromeLayer>
                <WindowChrome radius={14} />
              </WorkspaceChromeLayer>
            </WorkspaceRoot>
          </MaterialCompositorProvider>
        </MotionProvider>
    </ReducedMotionProvider>
  );
}
