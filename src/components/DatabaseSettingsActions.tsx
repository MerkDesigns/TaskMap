import { useEffect, useRef, useState } from "react";
import { IconLock, IconLogout, IconPower } from "@tabler/icons-react";
import { Button, SegmentedControl } from "../ui/primitives";
import { SettingsIsland, SettingsToggleRow } from "../ui/patterns/settings";

export interface DatabaseSettingsActionsProps {
  lock(): Promise<boolean>;
  close(): Promise<boolean>;
  quit(): Promise<boolean>;
  readonly closeToTray: boolean;
  onCloseToTrayChange(closeToTray: boolean): void;
  readonly trayLockMinutes: number;
  onTrayLockMinutesChange(minutes: number): void;
}

const TRAY_LOCK_CHOICES = [
  { value: "0", label: "Never" },
  { value: "15", label: "15 min" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
] as const;

/** Session actions save through the lifecycle owner before leaving the canvas. */
export function DatabaseSettingsActions(actions: DatabaseSettingsActionsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    setError(false);
    let ok = false;
    try {
      ok = await action();
    } catch {
      /* Show a content-free failure. */
    }
    if (mounted.current) {
      setError(!ok);
      setBusy(false);
    }
  };
  const trayLockValue =
    TRAY_LOCK_CHOICES.find(({ value }) => Number(value) === actions.trayLockMinutes)?.value ?? "0";
  return (
    <div className="taskmap-settings-content-stack">
      <SettingsIsland className="taskmap-settings-data-action">
        <div className="taskmap-settings-data-grid taskmap-settings-session-actions">
          <Button
            leadingIcon={<IconLock size={18} stroke={2} />}
            disabled={busy}
            onClick={() => void run(actions.lock)}
          >
            Lock database
          </Button>
          <Button
            leadingIcon={<IconLogout size={18} stroke={2} />}
            disabled={busy}
            onClick={() => void run(actions.close)}
          >
            Close database
          </Button>
          <Button
            leadingIcon={<IconPower size={18} stroke={2} />}
            disabled={busy}
            onClick={() => void run(actions.quit)}
          >
            Quit TaskMap
          </Button>
        </div>
      </SettingsIsland>
      {error && (
        <p role="alert" className="taskmap-settings-data-status">
          The database action could not be completed. Please retry.
        </p>
      )}
      <SettingsToggleRow
        label="Keep running in the tray"
        description={
          actions.closeToTray
            ? "Closing the window keeps the database unlocked in the tray, so it reopens without the password."
            : "Closing the window locks the database and quits TaskMap."
        }
        checked={actions.closeToTray}
        onCheckedChange={actions.onCloseToTrayChange}
      />
      {actions.closeToTray ? (
        <SettingsIsland>
          <div className="taskmap-settings-section-heading">Lock in the tray after</div>
          <div className="taskmap-settings-section-description">
            Locks the database and quits TaskMap after this long in the tray.
          </div>
          <SegmentedControl
            className="taskmap-settings-grid-segments"
            label="Lock in the tray after"
            items={TRAY_LOCK_CHOICES}
            value={trayLockValue}
            onValueChange={(value) => actions.onTrayLockMinutesChange(Number(value))}
          />
        </SettingsIsland>
      ) : null}
    </div>
  );
}
