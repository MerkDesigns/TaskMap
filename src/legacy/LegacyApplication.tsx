import App from "../App";

interface LegacyApplicationProps {
  readonly onBeforeClose?: () => Promise<void>;
}

export function LegacyApplication({ onBeforeClose }: LegacyApplicationProps) {
  return <App onBeforeClose={onBeforeClose} />;
}
