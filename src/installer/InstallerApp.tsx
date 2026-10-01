import { useEffect, useReducer, useState } from "react";
import { IconMinus, IconX } from "@tabler/icons-react";
import { IconButton } from "../ui/primitives/Button";
import { HalftoneBackdrop } from "../ui/patterns/halftone/HalftoneBackdrop";
import {
  DEFAULT_HALFTONE_SETTINGS,
  type HalftoneSettings,
} from "../ui/patterns/halftone/halftoneSettings";
import { InstallError, type InstallerClient } from "../platform/installer/installerClient";
import { compareVersions, initialInstallerState, installerReducer } from "./installerFlow";
import {
  type InstallerAction,
  FailedScreen,
  FinishedScreen,
  InstallingScreen,
  LegacyInstalledScreen,
  OptionsScreen,
  UpdateScreen,
  WelcomeScreen,
} from "./InstallerScreens";
import taskmapMark from "../../src-tauri/icons/32x32.png";
import "../ui/theme/theme.css";
import "./installer.css";

/** The unlock-screen field, quieter: the installer's copy sits directly on it. */
const INSTALLER_HALFTONE: HalftoneSettings = {
  ...DEFAULT_HALFTONE_SETTINGS,
  opacity: 0.4,
  speed: 0.09,
  waveSpeed: 0.12,
  pointerEnabled: false,
};

export function InstallerApp({ client }: { client: InstallerClient }) {
  const [state, dispatch] = useReducer(installerReducer, initialInstallerState);
  const [launch, setLaunch] = useState(true);
  const { details, options, screen } = state;
  const updating = Boolean(details?.existing);
  const actionLabel: InstallerAction = !details?.existing
    ? "Install"
    : compareVersions(details.version, details.existing.version) > 0
      ? "Update"
      : "Reinstall";

  useEffect(() => {
    let current = true;
    client.details().then(
      (loaded) => current && dispatch({ type: "loaded", details: loaded }),
      () => current && dispatch({ type: "failed", failure: "unknown" }),
    );
    return () => {
      current = false;
    };
  }, [client]);

  const install = () => {
    dispatch({ type: "start" });
    client
      .install({ ...options, update: updating }, (stage) => dispatch({ type: "stage", stage }))
      .then(
        () => dispatch({ type: "succeeded" }),
        (error: unknown) =>
          dispatch({
            type: "failed",
            failure: error instanceof InstallError ? error.failure : "unknown",
          }),
      );
  };
  const browse = () => {
    void client.chooseLocation(options.location).then((location) => {
      if (location) dispatch({ type: "setLocation", location });
    });
  };
  const finish = async () => {
    if (launch) await client.launch().catch(() => undefined);
    await client.close();
  };
  const installing = screen.name === "installing";

  return (
    <div className="taskmap-target-theme taskmap-installer" data-screen={screen.name}>
      <div className="taskmap-installer__backdrop" aria-hidden="true">
        <HalftoneBackdrop settings={INSTALLER_HALFTONE} />
      </div>
      <header className="taskmap-installer__titlebar" data-tauri-drag-region>
        <img src={taskmapMark} alt="" width={16} height={16} data-tauri-drag-region />
        <span data-tauri-drag-region>{details?.productName ?? "TaskMap"} Setup</span>
        <span className="taskmap-installer__window-controls">
          <IconButton
            variant="ghost"
            size="compact"
            aria-label="Minimize"
            icon={<IconMinus size={16} stroke={2} />}
            onClick={() => void client.minimize()}
          />
          <IconButton
            variant="ghost"
            size="compact"
            aria-label="Close"
            icon={<IconX size={16} stroke={2} />}
            // Closing mid-install would abandon NSIS halfway.
            disabled={installing}
            onClick={() => void client.close()}
          />
        </span>
      </header>
      <main className="taskmap-installer__content">
        {details && screen.name === "welcome" ? (
          <WelcomeScreen
            details={details}
            onInstall={install}
            onOptions={() => dispatch({ type: "showOptions" })}
          />
        ) : null}
        {screen.name === "legacyInstalled" ? (
          <LegacyInstalledScreen onClose={() => void client.close()} />
        ) : null}
        {details && screen.name === "update" ? (
          <UpdateScreen
            details={details}
            actionLabel={actionLabel}
            onUpdate={install}
            onOptions={() => dispatch({ type: "showOptions" })}
          />
        ) : null}
        {screen.name === "options" ? (
          <OptionsScreen
            options={options}
            updating={updating}
            actionLabel={actionLabel}
            onBrowse={browse}
            onShortcut={(shortcut, on) => dispatch({ type: "setShortcut", shortcut, on })}
            onBack={() => dispatch({ type: "back" })}
            onInstall={install}
          />
        ) : null}
        {screen.name === "installing" ? (
          <InstallingScreen
            stage={screen.stage}
            actionLabel={actionLabel}
            withShortcuts={!updating && (options.startMenuShortcut || options.desktopShortcut)}
          />
        ) : null}
        {details && screen.name === "finished" ? (
          <FinishedScreen
            details={details}
            actionLabel={actionLabel}
            launch={launch}
            onLaunchChange={setLaunch}
            onFinish={() => void finish()}
          />
        ) : null}
        {screen.name === "failed" ? (
          <FailedScreen
            failure={screen.failure}
            onRetry={() => dispatch({ type: "back" })}
            onClose={() => void client.close()}
          />
        ) : null}
      </main>
    </div>
  );
}
