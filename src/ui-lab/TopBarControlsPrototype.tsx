import { useState } from "react";
import { FloatingToolbar } from "../components/FloatingToolbar";
import "./topBarControlsPrototype.css";

export function TopBarControlsPrototype() {
  const [canvasesOpen, setCanvasesOpen] = useState(false);
  const [extensionsOpen, setExtensionsOpen] = useState(true);
  const [minimapEnabled, setMinimapEnabled] = useState(true);
  const [privacyModeEnabled, setPrivacyModeEnabled] = useState(false);
  const [toolbarButtonsVisible, setToolbarButtonsVisible] = useState(true);

  return (
    <section
      className="taskmap-ui-lab-top-bar-controls"
      aria-labelledby="top-bar-controls-prototype-title"
    >
      <div className="taskmap-ui-lab-prototype__heading">
        <span className="taskmap-ui-lab__eyebrow">Production top-bar controls</span>
        <h2 id="top-bar-controls-prototype-title">Top-bar glass buttons</h2>
        <p>Normal, active, and disabled states from the real production toolbar.</p>
      </div>

      <div className="taskmap-ui-lab-top-bar-controls__sample">
        <FloatingToolbar
          canRedo
          canUndo={false}
          canvasesOpen={canvasesOpen}
          extensionsOpen={extensionsOpen}
          minimapEnabled={minimapEnabled}
          privacyModeEnabled={privacyModeEnabled}
          toolbarButtonsVisible={toolbarButtonsVisible}
          onMinimapEnabledChange={setMinimapEnabled}
          onPrivacyModeEnabledChange={setPrivacyModeEnabled}
          onRedo={() => undefined}
          onToolbarButtonsVisibleChange={setToolbarButtonsVisible}
          onToggleExtensions={() => setExtensionsOpen((open) => !open)}
          onToggleCanvases={() => setCanvasesOpen((open) => !open)}
          onUndo={() => undefined}
          onOpenSettings={() => undefined}
        />
      </div>
    </section>
  );
}
