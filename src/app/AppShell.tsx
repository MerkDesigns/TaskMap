import { lazy, Suspense } from "react";
import { LegacyApplication } from "../legacy/LegacyApplication";
import { AppProviders } from "./AppProviders";
import { runWindowCloseGuard } from "./windowCloseCoordinator";

const DevelopmentPhase2Entry =
  import.meta.env.MODE === "phase2"
    ? lazy(async () => {
        const module = await import("../features/phase2-database/DevelopmentPhase2Entry");
        return { default: module.DevelopmentPhase2Entry };
      })
    : null;

export default function AppShell() {
  return (
    <AppProviders>
      <LegacyApplication onBeforeClose={runWindowCloseGuard} />
      {DevelopmentPhase2Entry ? (
        <Suspense fallback={null}>
          <DevelopmentPhase2Entry enabled />
        </Suspense>
      ) : null}
    </AppProviders>
  );
}
