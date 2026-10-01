import { DatabaseApplication, DatabaseApplicationFallback } from "./database/DatabaseApplication";
import { ApplicationErrorBoundary } from "./errors/ApplicationErrorBoundary";
import { defaultApplicationErrorReporter } from "./errors/applicationErrorReporter";

export default function AppShell() {
  return (
    <ApplicationErrorBoundary
      reporter={defaultApplicationErrorReporter}
      fallback={<DatabaseApplicationFallback />}
    >
      <DatabaseApplication />
    </ApplicationErrorBoundary>
  );
}
