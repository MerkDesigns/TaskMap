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

export default function AppShell() {
  const [materialPresentation] = useState(createMaterialCompositorPresentationBridge);
  return (
    <MaterialCompositorProvider presentation={materialPresentation}>
      <LegacyApplication
        onBeforeClose={runWindowCloseGuard}
        materialPresentation={materialPresentation}
      />
      <ApplicationErrorBoundary reporter={defaultApplicationErrorReporter}>
        <AppProviders>
          {DevelopmentPhase2Entry ? (
            <Suspense fallback={null}>
              <DevelopmentPhase2Entry enabled />
            </Suspense>
          ) : null}
        </AppProviders>
      </ApplicationErrorBoundary>
    </MaterialCompositorProvider>
  );
}
