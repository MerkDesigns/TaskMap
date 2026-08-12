import { lazy, Suspense, useState } from "react";
import { RendererV2ApplicationWorkspace } from "../features/workspace-chrome/RendererV2ApplicationWorkspace";
import { MaterialCompositorProvider } from "../ui/materials/MaterialCompositorProvider";
import { createMaterialCompositorPresentationBridge } from "../ui/materials/materialCompositorPresentation";
import { AppProviders } from "./AppProviders";
import { ApplicationErrorBoundary } from "./errors/ApplicationErrorBoundary";
import { defaultApplicationErrorReporter } from "./errors/applicationErrorReporter";

const DevelopmentPhase2Entry =
  import.meta.env.MODE === "phase2"
    ? lazy(async () => {
        const module = await import("../features/phase2-database/DevelopmentPhase2Entry");
        return { default: module.DevelopmentPhase2Entry };
      })
    : null;

const DevelopmentUiLab =
  import.meta.env.DEV && import.meta.env.VITE_TASKMAP_UI_LAB === "1"
    ? lazy(async () => {
        const module = await import("../ui/dev/DevelopmentUiLab");
        return { default: module.DevelopmentUiLab };
      })
    : null;

function DevelopmentUiLabShell() {
  const [materialPresentation] = useState(createMaterialCompositorPresentationBridge);
  return (
    <MaterialCompositorProvider presentation={materialPresentation}>
      <ApplicationErrorBoundary reporter={defaultApplicationErrorReporter}>
        <AppProviders>
          <Suspense fallback={null}>
            {DevelopmentUiLab ? <DevelopmentUiLab presentation={materialPresentation} /> : null}
          </Suspense>
        </AppProviders>
      </ApplicationErrorBoundary>
    </MaterialCompositorProvider>
  );
}

export default function AppShell() {
  if (DevelopmentUiLab) return <DevelopmentUiLabShell />;

  return (
    <ApplicationErrorBoundary reporter={defaultApplicationErrorReporter}>
      <AppProviders>
        <RendererV2ApplicationWorkspace />
        {DevelopmentPhase2Entry ? (
          <Suspense fallback={null}>
            <DevelopmentPhase2Entry enabled />
          </Suspense>
        ) : null}
      </AppProviders>
    </ApplicationErrorBoundary>
  );
}
