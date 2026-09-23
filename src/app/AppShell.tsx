import { lazy, Suspense } from "react";
import { DatabaseApplication, DatabaseApplicationFallback } from "./database/DatabaseApplication";
import { MaterialCompositorProvider } from "../ui/materials/MaterialCompositorProvider";
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

export default function AppShell() {
  return (
    <ApplicationErrorBoundary
      reporter={defaultApplicationErrorReporter}
      fallback={
        DevelopmentUiLab || DevelopmentPhase2Entry ? undefined : <DatabaseApplicationFallback />
      }
    >
      <MaterialCompositorProvider>
        {DevelopmentUiLab || DevelopmentPhase2Entry ? null : <DatabaseApplication />}
        <ApplicationErrorBoundary reporter={defaultApplicationErrorReporter}>
          <AppProviders>
            {DevelopmentPhase2Entry ? (
              <Suspense fallback={null}>
                <DevelopmentPhase2Entry enabled />
              </Suspense>
            ) : null}
            {DevelopmentUiLab ? (
              <Suspense fallback={null}>
                <DevelopmentUiLab />
              </Suspense>
            ) : null}
          </AppProviders>
        </ApplicationErrorBoundary>
      </MaterialCompositorProvider>
    </ApplicationErrorBoundary>
  );
}
