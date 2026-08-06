import { useEffect, useState } from "react";
import { tauriDatabaseClient } from "../../platform/database/tauriDatabaseClient";
import { tauriSettingsClient } from "../../platform/settings/tauriSettingsClient";
import { Phase2DatabaseHarness } from "./Phase2DatabaseHarness";

export interface DevelopmentPhase2EntryProps {
  readonly enabled: boolean;
}

export function DevelopmentPhase2Entry({ enabled }: DevelopmentPhase2EntryProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.code === "F2") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  if (!enabled || !open) return null;

  return (
    <Phase2DatabaseHarness
      databaseClient={tauriDatabaseClient}
      settingsClient={tauriSettingsClient}
      onDismiss={() => setOpen(false)}
    />
  );
}
