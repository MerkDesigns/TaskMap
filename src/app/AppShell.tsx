import { RendererV2Prototype } from "../ui/renderer-v2-prototype/RendererV2Prototype";
import { ApplicationErrorBoundary } from "./errors/ApplicationErrorBoundary";
import { defaultApplicationErrorReporter } from "./errors/applicationErrorReporter";

export default function AppShell() {
  return (
    <ApplicationErrorBoundary reporter={defaultApplicationErrorReporter}>
      <RendererV2Prototype />
    </ApplicationErrorBoundary>
  );
}
