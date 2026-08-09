import App from "../App";
import type { MaterialCompositorPresentationPublisher } from "../ui/materials/materialCompositorPresentation";

interface LegacyApplicationProps {
  readonly onBeforeClose?: () => Promise<void>;
  readonly materialPresentation?: MaterialCompositorPresentationPublisher;
}

export function LegacyApplication({ onBeforeClose, materialPresentation }: LegacyApplicationProps) {
  return <App onBeforeClose={onBeforeClose} materialPresentation={materialPresentation} />;
}
