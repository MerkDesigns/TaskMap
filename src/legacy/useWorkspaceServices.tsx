import { useState } from "react";
import { commandErrorMessage } from "../app/commandError";
import { ToastStack } from "../components/ToastStack";
import { useToastQueue } from "../components/useToastQueue";
import { useAppUpdates } from "../hooks/useAppUpdates";
import { useImageCache } from "../hooks/useImageCache";
import type { RetainedCanvasContextValue } from "./RetainedCanvasContext";
import { RetainedSettingsDialog } from "./RetainedSettingsDialog";
import type { useLegacyCanvasSettings } from "./useLegacyCanvasSettings";

// Retained images resolve media through session leases; the legacy hash cache holds nothing.
const NO_CACHED_IMAGES: { hash: string; format?: string }[] = [];

export interface WorkspaceServicePorts {
  readonly retained: RetainedCanvasContextValue;
  readonly settings: ReturnType<typeof useLegacyCanvasSettings>;
  readonly rememberRecentColor: (color?: string) => void;
}

/**
 * The workspace services around the canvas: notifications, update checks and their prompt, the
 * Settings dialog and the development FPS counter switch. Returns the dialogs and toasts to render
 * once at the end of the workspace.
 */
export function useWorkspaceServices({
  retained,
  settings,
  rememberRecentColor,
}: WorkspaceServicePorts) {
  const { toasts, showToast, dismissToast } = useToastQueue();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fpsCounterVisible, setFpsCounterVisible] = useState(false);
  const { imageUrlVersion } = useImageCache({
    activeImages: NO_CACHED_IMAGES,
    onStoreError: (error) =>
      showToast({
        tone: "error",
        title: "Could not add image",
        message: commandErrorMessage(error),
      }),
  });
  const updates = useAppUpdates({
    // The workspace mounts once the database is open; the storage-free preview never checks.
    checkOnStartup: import.meta.env.MODE !== "storage-preview",
    dismissedUpdateVersion: settings.dismissedUpdateVersion,
    onDismissUpdateVersion: settings.setDismissedUpdateVersion,
    saveCurrentData: async () => {
      const result = await retained.runtime.controller.prepareWindowClose();
      if (!result.ok) throw new Error("The database could not be saved before updating.");
    },
    showToast,
  });

  return {
    showToast,
    openSettings: () => setSettingsOpen(true),
    /** Settings or the update prompt is open, so canvas shortcuts stand down. */
    dialogOpen: settingsOpen || updates.updateModalOpen,
    fpsCounterVisible,
    imageUrlVersion,
    overlays: (
      <>
        <RetainedSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          updates={updates}
          session={retained.runtime.controller}
          onRememberRecentColor={rememberRecentColor}
          fpsCounterVisible={fpsCounterVisible}
          onFpsCounterVisibleChange={setFpsCounterVisible}
        />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    ),
  };
}
