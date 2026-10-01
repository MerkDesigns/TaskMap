import {
  InstallError,
  type InstallFailure,
  type InstallStage,
  type InstallerClient,
} from "../platform/installer/installerClient";

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * Development stand-in for working on the installer UI without installing anything. URL flags:
 * `?existing=0.3.2` previews the update screen, `?legacy` the legacy-app guard, `?fail=failed` makes
 * installing fail.
 */
export function createPreviewInstallerClient(): InstallerClient {
  const search = new URLSearchParams(window.location.search);
  const existingVersion = search.get("existing");
  const failure = search.get("fail") as InstallFailure | null;
  return {
    details: async () => ({
      productName: "TaskMap",
      version: "0.3.4",
      defaultLocation: String.raw`C:\Users\you\AppData\Local\TaskMap`,
      existing: existingVersion
        ? {
            version: existingVersion,
            location: String.raw`C:\Users\you\AppData\Local\TaskMap`,
            executable: String.raw`C:\Users\you\AppData\Local\TaskMap\TaskMap.exe`,
          }
        : null,
      legacyInstalled: search.has("legacy"),
      simulated: true,
    }),
    chooseLocation: async () => String.raw`D:\Apps\TaskMap`,
    async install(request, onStage) {
      const stages: InstallStage[] = ["preparing", "installing"];
      if (!request.update && (request.startMenuShortcut || request.desktopShortcut)) {
        stages.push("shortcuts");
      }
      stages.push("finishing");
      for (const stage of stages) {
        onStage(stage);
        await wait(stage === "installing" ? 1400 : 700);
        if (failure && stage === "installing") throw new InstallError(failure);
      }
    },
    launch: async () => undefined,
    minimize: async () => undefined,
    close: async () => undefined,
  };
}
