import { lazy, Suspense, useState } from "react";
import { LegacyApplication } from "../legacy/LegacyApplication";
import { MaterialCompositorProvider } from "../ui/materials/MaterialCompositorProvider";
import { createMaterialCompositorPresentationBridge } from "../ui/materials/materialCompositorPresentation";
import { AppProviders } from "./AppProviders";
import { ApplicationErrorBoundary } from "./errors/ApplicationErrorBoundary";
import { defaultApplicationErrorReporter } from "./errors/applicationErrorReporter";
import { runWindowCloseGuard } from "./windowCloseCoordinator";

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

export default function AppShell() {
  const [materialPresentation] = useState(createMaterialCompositorPresentationBridge);
  return (
    <MaterialCompositorProvider presentation={materialPresentation}>
      {DevelopmentUiLab ? null : (
        <LegacyApplication
          onBeforeClose={runWindowCloseGuard}
          materialPresentation={materialPresentation}
        />
      )}
      <ApplicationErrorBoundary reporter={defaultApplicationErrorReporter}>
        <AppProviders>
          {DevelopmentPhase2Entry ? (
            <Suspense fallback={null}>
              <DevelopmentPhase2Entry enabled />
            </Suspense>
          ) : null}
          {DevelopmentUiLab ? (
            <Suspense fallback={null}>
              <DevelopmentUiLab presentation={materialPresentation} />
            </Suspense>
          ) : null}
        </AppProviders>
      </ApplicationErrorBoundary>
    </MaterialCompositorProvider>
  );
}
