import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DatabaseSessionGate } from "../DatabaseSessionGate";
import { MaterialCompositorProvider } from "../../../ui/materials/MaterialCompositorProvider";
import { RetainedCanvasApplication } from "../../../legacy/RetainedCanvasApplication";
import { DatabaseWindowChrome } from "../DatabaseWindowChrome";
import { Button } from "../../../ui/primitives/Button";
import { createDatabaseEntryPreview } from "./createDatabaseEntryPreview";
import { tauriWindowPrivacyClient } from "../../../platform/window/windowPrivacyClient";
import { blockTabKeyNavigation } from "../../../ui/keyboard/blockTabKeyNavigation";
import "../../../index.css";

if (!import.meta.env.DEV || import.meta.env.MODE !== "storage-preview")
  throw new Error(
    "Database entry preview is available only in the isolated storage-free development mode.",
  );
const runtime = createDatabaseEntryPreview(tauriWindowPrivacyClient);
window.addEventListener("keydown", blockTabKeyNavigation, true);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MaterialCompositorProvider>
      <div className="taskmap-target-theme" style={{ height: "100%" }}>
        <DatabaseSessionGate runtime={runtime}>
          <RetainedCanvasApplication runtime={runtime} />
          <section style={{ position: "fixed", bottom: 56, right: 12, zIndex: 100000 }}>
            <Button onClick={() => void runtime.controller.lock()}>Lock preview</Button>
            <Button onClick={() => void runtime.forceLockPreview()}>Force lock preview</Button>
            <Button onClick={() => void runtime.controller.close()}>Close preview database</Button>
          </section>
        </DatabaseSessionGate>
        <DatabaseWindowChrome prepareClose={runtime.controller.close} />
      </div>
    </MaterialCompositorProvider>
  </StrictMode>,
);

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    window.removeEventListener("keydown", blockTabKeyNavigation, true);
    void runtime.controller.dispose();
  });
