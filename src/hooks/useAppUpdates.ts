import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check as checkForUpdate, Update } from "@tauri-apps/plugin-updater";
import { commandErrorMessage } from "../app/commandError";
import { AppUpdateInfo, ToastMessage } from "../types";

type UpdateCheckSource = "startup" | "manual";

type ShowToast = (toast: Omit<ToastMessage, "id"> & { duration?: number }) => void;

type UseAppUpdatesOptions = {
  appDataLoaded: boolean;
  dismissedUpdateVersion?: string;
  onDismissUpdateVersion: (version: string) => void;
  cancelAutosave: () => void;
  saveCurrentData: () => Promise<void>;
  showToast: ShowToast;
};

export function useAppUpdates({
  appDataLoaded,
  dismissedUpdateVersion,
  onDismissUpdateVersion,
  cancelAutosave,
  saveCurrentData,
  showToast,
}: UseAppUpdatesOptions) {
  const pendingUpdateRef = useRef<Update | null>(null);
  const autoUpdateCheckRef = useRef(false);
  const dismissedUpdateVersionRef = useRef(dismissedUpdateVersion);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateInfo | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("0.0.0");

  useEffect(() => {
    dismissedUpdateVersionRef.current = dismissedUpdateVersion;
  }, [dismissedUpdateVersion]);

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch((error) => {
        console.error("Failed to read app version", error);
      });
  }, []);

  const checkForAppUpdate = useCallback(
    async (source: UpdateCheckSource = "manual") => {
      try {
        const update = await checkForUpdate();
        pendingUpdateRef.current = update;

        if (!update) {
          setAvailableUpdate(null);

          if (source === "manual") {
            showToast({
              tone: "success",
              title: "TaskMap is up to date",
              message: "You are already running the newest version.",
            });
          }

          return null;
        }

        const info = {
          version: update.version,
          currentVersion: update.currentVersion,
          date: update.date,
          body: update.body,
        };

        setAvailableUpdate(info);

        if (source === "startup") {
          if (dismissedUpdateVersionRef.current !== info.version) {
            setUpdateModalOpen(true);
          }
        } else {
          showToast({
            tone: "info",
            title: "Update available",
            message: `TaskMap ${info.version} is ready to download.`,
            duration: 5200,
          });
        }

        return info;
      } catch (error) {
        if (source === "manual") {
          showToast({
            tone: "error",
            title: "Update check failed",
            message: commandErrorMessage(error),
            duration: 7000,
          });
        }

        throw error;
      }
    },
    [showToast],
  );

  const installAppUpdate = useCallback(async () => {
    let update = pendingUpdateRef.current;

    if (!update) {
      update = await checkForUpdate();
      pendingUpdateRef.current = update;
    }

    if (!update) {
      setAvailableUpdate(null);
      showToast({
        tone: "warning",
        title: "No update to install",
        message: "Check for updates again before installing.",
      });
      return;
    }

    cancelAutosave();

    try {
      showToast({
        tone: "info",
        title: "Installing update",
        message: "Saving your data before downloading the update.",
        duration: 3600,
      });

      await saveCurrentData();
      await update.downloadAndInstall();
      showToast({
        tone: "success",
        title: "Update installed",
        message: "Restarting TaskMap to finish applying it.",
        duration: 2400,
      });
      await relaunch();
    } catch (error) {
      showToast({
        tone: "error",
        title: "Update failed",
        message: commandErrorMessage(error),
        duration: 7000,
      });
      throw error;
    }
  }, [cancelAutosave, saveCurrentData, showToast]);

  useEffect(() => {
    if (!appDataLoaded || autoUpdateCheckRef.current) {
      return;
    }

    autoUpdateCheckRef.current = true;

    checkForAppUpdate("startup").catch((error) => {
      console.error("Automatic update check failed", error);
    });
  }, [appDataLoaded, checkForAppUpdate]);

  const dismissUpdateModal = useCallback(() => {
    setUpdateModalOpen(false);
    if (availableUpdate) {
      onDismissUpdateVersion(availableUpdate.version);
    }
  }, [availableUpdate, onDismissUpdateVersion]);

  return {
    appVersion,
    availableUpdate,
    updateModalOpen,
    checkForAppUpdate,
    installAppUpdate,
    dismissUpdateModal,
  };
}
