import { LegacyApplication } from "../legacy/LegacyApplication";
import { AppProviders } from "./AppProviders";

export default function AppShell() {
  return (
    <AppProviders>
      <LegacyApplication />
    </AppProviders>
  );
}
