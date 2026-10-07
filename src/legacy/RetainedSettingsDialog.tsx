import { Suspense, useState } from "react";
import { SettingsModal, UpdateAvailableModal } from "../components/Modals";
import type { useAppUpdates } from "../hooks/useAppUpdates";
import { ModalPresence } from "../ui/patterns/overlays";
import { beginWorkspaceOutro, cancelWorkspaceOutro } from "../ui/patterns/workspace/workspaceIntro";
import type { useLegacyCanvasSettings } from "./useLegacyCanvasSettings";

type SessionResult = Promise<{ readonly ok: boolean }>;

export interface RetainedSettingsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly settings: ReturnType<typeof useLegacyCanvasSettings>;
  readonly updates: ReturnType<typeof useAppUpdates>;
  /** The database session the dialog can lock, close or quit. */
  readonly session: {
    lock(): SessionResult;
    close(): SessionResult;
    quit(): SessionResult;
  };
  readonly onRememberRecentColor: (color?: string) => void;
  readonly fpsCounterVisible: boolean;
  readonly onFpsCounterVisibleChange: (visible: boolean) => void;
}

/**
 * The Settings dialog bound to the open database's settings, the update prompt that waits while
 * Settings is open, and the banner for a settings save that failed.
 */
export function RetainedSettingsDialog({
  open,
  onClose,
  settings,
  updates,
  session,
  onRememberRecentColor,
  fpsCounterVisible,
  onFpsCounterVisibleChange,
}: RetainedSettingsDialogProps) {
  const [temporaryPanelsVisible, setTemporaryPanelsVisible] = useState(false);
  const { canvasGridStyle, gridOpacityEdit } = settings;
  const close = () => {
    gridOpacityEdit?.cancel();
    onClose();
  };

  return (
    <>
      <ModalPresence open={open} onDismiss={close}>
        <Suspense fallback={null}>
          <SettingsModal
            databaseActions={{
              lock: async () => {
                // The animation plays before the lock: locking purges the document,
                // so afterwards there would be no canvas left to animate.
                onClose();
                await beginWorkspaceOutro();
                const locked = (await session.lock()).ok;
                if (!locked) cancelWorkspaceOutro();
                return locked;
              },
              close: async () => (await session.close()).ok,
              quit: async () => (await session.quit()).ok,
              closeToTray: settings.closeToTray,
              onCloseToTrayChange: settings.setCloseToTray,
              trayLockMinutes: settings.trayLockMinutes,
              onTrayLockMinutesChange: settings.setTrayLockMinutes,
            }}
            gridOpacityEdit={gridOpacityEdit}
            canvasGridStyle={canvasGridStyle}
            onCanvasGridStyleChange={settings.setCanvasGridStyle}
            canvasGridOpacity={settings.canvasGridOpacity[canvasGridStyle]}
            onCanvasGridOpacityChange={(opacity) =>
              settings.setCanvasGridOpacity((current) => ({
                ...current,
                [canvasGridStyle]: opacity,
              }))
            }
            defaultElementColors={settings.defaultElementColors}
            onDefaultElementColorChange={(elementType, color) =>
              settings.setDefaultElementColors((current) => ({ ...current, [elementType]: color }))
            }
            recentColors={settings.recentColors}
            onRememberRecentColor={onRememberRecentColor}
            shadowsUnderElements={settings.shadowsUnderElements}
            onShadowsUnderElementsChange={settings.setShadowsUnderElements}
            allowLockedElementDeletion={settings.allowLockedElementDeletion}
            onAllowLockedElementDeletionChange={settings.setAllowLockedElementDeletion}
            availableUpdate={updates.availableUpdate}
            appVersion={updates.appVersion}
            fpsCounterVisible={fpsCounterVisible}
            onFpsCounterVisibleChange={onFpsCounterVisibleChange}
            privacyModeEnabled={settings.privacyModeEnabled}
            onPrivacyModeEnabledChange={settings.setPrivacyModeEnabled}
            chromeRadii={settings.chromeRadii}
            onChromeRadiusChange={(key, radius) =>
              settings.setChromeRadii((current) => ({ ...current, [key]: radius }))
            }
            sleepDelayMs={settings.chromeAutoHideDelayMs}
            onSleepDelayChange={settings.setChromeAutoHideDelayMs}
            temporaryPanelsVisible={temporaryPanelsVisible}
            onTemporaryPanelsVisibleChange={setTemporaryPanelsVisible}
            onCheckForUpdate={updates.checkForAppUpdate}
            onInstallUpdate={updates.installAppUpdate}
            onClose={close}
          />
        </Suspense>
      </ModalPresence>

      <ModalPresence open={updates.updateModalOpen && Boolean(updates.availableUpdate) && !open}>
        <Suspense fallback={null}>
          {updates.availableUpdate ? (
            <UpdateAvailableModal
              update={updates.availableUpdate}
              onInstall={updates.installAppUpdate}
              onDismiss={updates.dismissUpdateModal}
            />
          ) : null}
        </Suspense>
      </ModalPresence>

      {settings.settingsError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-[420px] rounded-lg border border-red-300/25 bg-[#281b1d]/95 p-3 text-sm text-red-100"
        >
          {settings.settingsError}
        </div>
      )}
    </>
  );
}
