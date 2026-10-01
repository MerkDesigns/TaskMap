import type {
  InstallFailure,
  InstallStage,
  InstallerDetails,
} from "../platform/installer/installerClient";

export interface InstallOptions {
  readonly location: string;
  readonly startMenuShortcut: boolean;
  readonly desktopShortcut: boolean;
}

export type InstallerScreen =
  | { readonly name: "loading" }
  | { readonly name: "welcome" }
  | { readonly name: "legacyInstalled" }
  | { readonly name: "update" }
  | { readonly name: "options" }
  | { readonly name: "installing"; readonly stage: InstallStage | null }
  | { readonly name: "finished" }
  | { readonly name: "failed"; readonly failure: InstallFailure };

export interface InstallerState {
  readonly screen: InstallerScreen;
  readonly details: InstallerDetails | null;
  readonly options: InstallOptions;
}

export type InstallerAction =
  | { readonly type: "loaded"; readonly details: InstallerDetails }
  | { readonly type: "showOptions" }
  | { readonly type: "back" }
  | { readonly type: "setLocation"; readonly location: string }
  | {
      readonly type: "setShortcut";
      readonly shortcut: "startMenu" | "desktop";
      readonly on: boolean;
    }
  | { readonly type: "start" }
  | { readonly type: "stage"; readonly stage: InstallStage }
  | { readonly type: "succeeded" }
  | { readonly type: "failed"; readonly failure: InstallFailure };

export const initialInstallerState: InstallerState = {
  screen: { name: "loading" },
  details: null,
  options: { location: "", startMenuShortcut: true, desktopShortcut: true },
};

/** Compares dotted numeric versions ("0.3.10" > "0.3.9"); missing parts count as 0. */
export function compareVersions(left: string, right: string): number {
  const parts = (version: string) =>
    version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

/** Updating keeps the existing installation's folder; a fresh install starts on the welcome screen. */
const homeScreen = (details: InstallerDetails | null): InstallerScreen =>
  details?.legacyInstalled
    ? { name: "legacyInstalled" }
    : details?.existing
      ? { name: "update" }
      : { name: "welcome" };

export function installerReducer(state: InstallerState, action: InstallerAction): InstallerState {
  switch (action.type) {
    case "loaded":
      return {
        ...state,
        details: action.details,
        options: {
          ...state.options,
          location: action.details.existing?.location ?? action.details.defaultLocation,
        },
        screen: homeScreen(action.details),
      };
    case "showOptions":
      return { ...state, screen: { name: "options" } };
    case "back":
      return { ...state, screen: homeScreen(state.details) };
    case "setLocation":
      return { ...state, options: { ...state.options, location: action.location } };
    case "setShortcut":
      return {
        ...state,
        options: {
          ...state.options,
          [action.shortcut === "startMenu" ? "startMenuShortcut" : "desktopShortcut"]: action.on,
        },
      };
    case "start":
      return { ...state, screen: { name: "installing", stage: null } };
    case "stage":
      return state.screen.name === "installing"
        ? { ...state, screen: { name: "installing", stage: action.stage } }
        : state;
    case "succeeded":
      return { ...state, screen: { name: "finished" } };
    case "failed":
      return { ...state, screen: { name: "failed", failure: action.failure } };
  }
}
