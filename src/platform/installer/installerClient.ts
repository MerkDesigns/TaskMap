import { Channel, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface ExistingInstall {
  readonly version: string;
  readonly location: string;
  readonly executable: string;
}

export interface InstallerDetails {
  readonly productName: string;
  readonly version: string;
  readonly defaultLocation: string;
  readonly existing: ExistingInstall | null;
  /** The legacy TaskMap is installed under the same name; this installer must not replace it. */
  readonly legacyInstalled: boolean;
  /** Development builds carry no NSIS payload and only simulate installation. */
  readonly simulated: boolean;
}

export interface InstallRequest {
  readonly location: string;
  readonly startMenuShortcut: boolean;
  readonly desktopShortcut: boolean;
  readonly update: boolean;
}

export type InstallStage = "preparing" | "installing" | "shortcuts" | "finishing";

/** Content-free failure kinds reported by the native installer. */
export type InstallFailure =
  | "invalidLocation"
  | "prepare"
  | "start"
  | "failed"
  | "notFound"
  | "shortcut"
  | "legacyInstalled"
  | "unknown";

const FAILURES: ReadonlySet<string> = new Set<InstallFailure>([
  "invalidLocation",
  "prepare",
  "start",
  "failed",
  "notFound",
  "shortcut",
  "legacyInstalled",
]);

export class InstallError extends Error {
  constructor(readonly failure: InstallFailure) {
    super(`Installation failed: ${failure}`);
  }
}

const toInstallError = (error: unknown) =>
  new InstallError(
    typeof error === "string" && FAILURES.has(error) ? (error as InstallFailure) : "unknown",
  );

export interface InstallerClient {
  details(): Promise<InstallerDetails>;
  /** Opens a folder picker; resolves to the chosen install folder, or null when cancelled. */
  chooseLocation(current: string): Promise<string | null>;
  install(request: InstallRequest, onStage: (stage: InstallStage) => void): Promise<void>;
  launch(): Promise<void>;
  minimize(): Promise<void>;
  close(): Promise<void>;
}

export function createTauriInstallerClient(): InstallerClient {
  return {
    details: () => invoke<InstallerDetails>("installer_details"),
    chooseLocation: (current) => invoke<string | null>("installer_choose_location", { current }),
    async install(request, onStage) {
      const channel = new Channel<InstallStage>();
      channel.onmessage = onStage;
      try {
        await invoke("installer_run", { request, onStage: channel });
      } catch (error) {
        throw toInstallError(error);
      }
    },
    async launch() {
      try {
        await invoke("installer_launch");
      } catch (error) {
        throw toInstallError(error);
      }
    },
    minimize: () => getCurrentWindow().minimize(),
    close: () => getCurrentWindow().close(),
  };
}
