import {
  IconDownload,
  IconEye,
  IconEyeOff,
  IconGrid3x3,
  IconGridDots,
  IconKeyboard,
  IconPalette,
  IconRefresh,
  IconSettings,
  IconUpload,
} from "@tabler/icons-react";
import { SettingsInterfaceIsland } from "./SettingsInterfaceIsland";
import type { ChromeRadii } from "../platform/settings/preferenceContracts";
import { ChangeEvent, Fragment, useEffect, useRef, useState } from "react";
import { commandErrorMessage } from "../app/commandError";
import { AppUpdateInfo, CanvasGridStyle, DefaultElementColors } from "../types";
import { Button, Keycap, LiquidTabs, SegmentedControl, Slider } from "../ui/primitives";
import {
  isNestedModalPresenceBlocking,
  ModalDialogHeader,
  ModalPresence,
  useDialogFocus,
} from "../ui/patterns/overlays";
import {
  SettingsIsland,
  SettingsIslandList,
  SettingsShell,
  SettingsToggleRow,
} from "../ui/patterns/settings";
import { ColorPickerMenu } from "./ColorPickerMenu";
import {
  DatabaseSettingsActions,
  type DatabaseSettingsActionsProps,
} from "./DatabaseSettingsActions";
import { SettingsPasswordDialog, UpdateAvailableModal } from "./ProductionDialogs";

export { ClearCanvasModal, UpdateAvailableModal } from "./ProductionDialogs";

type SettingsModalProps = {
  databaseActions?: DatabaseSettingsActionsProps;
  gridOpacityEdit?: { begin(): void; commit(): void; cancel(): void };
  canvasGridStyle: CanvasGridStyle;
  onCanvasGridStyleChange: (style: CanvasGridStyle) => void;
  canvasGridOpacity: number;
  onCanvasGridOpacityChange: (opacity: number) => void;
  defaultElementColors: DefaultElementColors;
  onDefaultElementColorChange: (elementType: keyof DefaultElementColors, color: string) => void;
  recentColors: string[];
  onRememberRecentColor: (color?: string) => void;
  shadowsUnderElements: boolean;
  onShadowsUnderElementsChange: (enabled: boolean) => void;
  allowLockedElementDeletion: boolean;
  onAllowLockedElementDeletionChange: (enabled: boolean) => void;
  onExportData: (password: string) => Promise<boolean>;
  onImportData: (file: File, password: string) => Promise<void>;
  availableUpdate: AppUpdateInfo | null;
  appVersion: string;
  fpsCounterVisible: boolean;
  onFpsCounterVisibleChange: (visible: boolean) => void;
  privacyModeEnabled: boolean;
  onPrivacyModeEnabledChange: (enabled: boolean) => void;
  chromeRadii: ChromeRadii;
  onChromeRadiusChange: (key: keyof ChromeRadii, radius: number) => void;
  sleepDelayMs: number;
  onSleepDelayChange: (delayMs: number) => void;
  temporaryPanelsVisible: boolean;
  onTemporaryPanelsVisibleChange: (visible: boolean) => void;
  onCheckForUpdate: () => Promise<AppUpdateInfo | null>;
  onInstallUpdate: () => Promise<void>;
  onClose: () => void;
};

const GRID_OPTIONS: Array<{
  label: string;
  value: CanvasGridStyle;
  Icon: typeof IconGridDots;
}> = [
  { label: "Dots", value: "dots", Icon: IconGridDots },
  { label: "Lines", value: "lines", Icon: IconGrid3x3 },
];

const DEFAULT_COLOR_OPTIONS: Array<{
  label: string;
  value: keyof DefaultElementColors;
}> = [
  { label: "Containers", value: "container" },
  { label: "Text cards", value: "textCard" },
  { label: "Text blocks", value: "textBlock" },
  { label: "Images", value: "image" },
  { label: "Mindmaps", value: "mindmap" },
];

const SHORTCUTS = [
  { label: "Open quick extensions menu", keys: ["Shift", "E"] },
  { label: "Open or close Canvases", keys: ["Tab"] },
  { label: "Switch Canvases / Extensions", keys: ["Shift", "Tab"] },
  { label: "Cycle canvases", keys: ["Ctrl", "Tab"] },
  { label: "Remove selected elements", keys: ["Delete"] },
  { label: "Undo", keys: ["Ctrl/Cmd", "Z"] },
  { label: "Redo", keys: ["Ctrl/Cmd", "Y"] },
  { label: "Pan canvas", keys: ["Middle drag"] },
  { label: "Zoom around pointer", keys: ["Mouse wheel"] },
  { label: "Enable alignment snapping", keys: ["Shift", "Drag"] },
  { label: "Open context menu", keys: ["Right-click"] },
  { label: "Box select", keys: ["Left-drag empty canvas"] },
  { label: "Connect mindmaps", keys: ["Hold C", "Drag point"] },
] as const;

const SETTINGS_TABS = import.meta.env.DEV
  ? (["visual", "data", "misc", "shortcuts", "dev"] as const)
  : (["visual", "data", "misc", "shortcuts"] as const);

const SETTINGS_TAB_ITEMS = SETTINGS_TABS.map((tab) => ({
  value: tab,
  label: tab,
}));

const GRID_SEGMENTS = GRID_OPTIONS.map(({ Icon, label, value }) => ({
  value,
  label: (
    <>
      <Icon size={15} stroke={2} />
      <span>{label}</span>
    </>
  ),
}));

export function SettingsModal({
  databaseActions,
  gridOpacityEdit,
  canvasGridStyle,
  onCanvasGridStyleChange,
  canvasGridOpacity,
  onCanvasGridOpacityChange,
  defaultElementColors,
  onDefaultElementColorChange,
  recentColors,
  onRememberRecentColor,
  shadowsUnderElements,
  onShadowsUnderElementsChange,
  allowLockedElementDeletion,
  onAllowLockedElementDeletionChange,
  onExportData,
  onImportData,
  availableUpdate,
  appVersion,
  fpsCounterVisible,
  onFpsCounterVisibleChange,
  privacyModeEnabled,
  onPrivacyModeEnabledChange,
  chromeRadii,
  onChromeRadiusChange,
  sleepDelayMs,
  onSleepDelayChange,
  temporaryPanelsVisible,
  onTemporaryPanelsVisibleChange,
  onCheckForUpdate,
  onInstallUpdate,
  onClose,
}: SettingsModalProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const opacityCancelled = useRef(false);
  const [passwordModal, setPasswordModal] = useState<"export" | "import" | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [dataStatus, setDataStatus] = useState("");
  const [, setUpdateStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"visual" | "data" | "misc" | "shortcuts" | "dev">(
    "visual",
  );
  const [defaultColorPicker, setDefaultColorPicker] = useState<{
    elementType: keyof DefaultElementColors;
    left: number;
    top: number;
  } | null>(null);
  const dialogRef = useDialogFocus();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isNestedModalPresenceBlocking()) return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (activeTab !== "visual") {
      setDefaultColorPicker(null);
    }
  }, [activeTab]);

  const runDataAction = async (
    password: string,
    action: (password: string) => Promise<boolean | void>,
    successMessage: string,
  ) => {
    setDataStatus("");

    if (!password) {
      setDataStatus("Password required.");
      return;
    }

    setBusy(true);
    try {
      const completed = await action(password);
      if (completed === false) {
        return;
      }
      setDataStatus(successMessage);
      setPasswordModal(null);
      setPasswordDraft("");
      setPendingImportFile(null);
    } catch (error) {
      setDataStatus(commandErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    setDataStatus("");
    setPasswordDraft("");
    setPasswordModal("export");
  };

  const handleImportClick = () => {
    setDataStatus("");
    importInputRef.current?.click();
  };

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setPendingImportFile(file);
    setPasswordDraft("");
    setPasswordModal("import");
  };

  const submitPassword = () => {
    if (passwordModal === "export") {
      runDataAction(passwordDraft, onExportData, "Exported.");
      return;
    }

    if (passwordModal === "import" && pendingImportFile) {
      runDataAction(
        passwordDraft,
        (password) => onImportData(pendingImportFile, password),
        "Imported.",
      );
    }
  };

  const closePasswordModal = () => {
    setPasswordModal(null);
    setPasswordDraft("");
    setPendingImportFile(null);
  };

  const handleCheckForUpdate = async () => {
    setUpdateStatus("");
    setUpdateBusy(true);

    try {
      const update = await onCheckForUpdate();
      if (update) {
        setUpdateStatus("");
        setUpdateModalOpen(true);
      } else {
        setUpdateStatus("");
      }
    } catch (error) {
      setUpdateStatus(commandErrorMessage(error));
    } finally {
      setUpdateBusy(false);
    }
  };

  return (
    <Fragment>
      <SettingsShell
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        data-settings-primary-shell
      >
        <ModalDialogHeader
          titleId="settings-title"
          title="Settings"
          icon={<IconSettings size={19} stroke={2} className="taskmap-modal-dialog__icon" />}
          onClose={onClose}
          closeLabel="Close settings"
        />
        <div className="taskmap-settings-body">
          <LiquidTabs
            className="taskmap-settings-navigation"
            label="Settings categories"
            items={
              databaseActions
                ? SETTINGS_TAB_ITEMS.map((item) =>
                    item.value === "data" ? { ...item, label: "database" } : item,
                  )
                : SETTINGS_TAB_ITEMS
            }
            value={activeTab}
            onValueChange={(tab) => {
              gridOpacityEdit?.cancel();
              setActiveTab(tab);
            }}
          />
          <SettingsIslandList key={activeTab}>
            <div className="taskmap-settings-content-stack">
              {activeTab === "visual" && (
                <>
                  <SettingsIsland>
                    <div className="taskmap-settings-section-heading">Canvas grid</div>
                    <div className="taskmap-settings-grid-controls">
                      <SegmentedControl
                        className="taskmap-settings-grid-segments"
                        label="Canvas grid style"
                        items={GRID_SEGMENTS}
                        value={canvasGridStyle}
                        onValueChange={onCanvasGridStyleChange}
                      />
                      <div>
                        <div className="taskmap-settings-slider-heading">
                          <span>Opacity</span>
                          <span className="taskmap-settings-slider-value">
                            {Math.round(canvasGridOpacity)}%
                          </span>
                        </div>
                        <Slider
                          onPointerDown={(event) => {
                            opacityCancelled.current = false;
                            if (gridOpacityEdit) {
                              event.currentTarget.setPointerCapture(event.pointerId);
                              gridOpacityEdit.begin();
                            }
                          }}
                          onPointerUp={() => {
                            gridOpacityEdit?.commit();
                            opacityCancelled.current = false;
                          }}
                          onPointerCancel={() => {
                            gridOpacityEdit?.cancel();
                            opacityCancelled.current = true;
                          }}
                          onLostPointerCapture={() => gridOpacityEdit?.cancel()}
                          onBlur={() => gridOpacityEdit?.commit()}
                          onKeyDown={(event) => {
                            opacityCancelled.current = false;
                            if (event.key === "Escape" && gridOpacityEdit) {
                              opacityCancelled.current = true;
                              event.stopPropagation();
                              gridOpacityEdit.cancel();
                            }
                          }}
                          className="taskmap-settings-slider"
                          min={0}
                          max={100}
                          value={canvasGridOpacity}
                          spellCheck={false}
                          onChange={(event) => {
                            if (!opacityCancelled.current)
                              onCanvasGridOpacityChange(Number(event.currentTarget.value));
                          }}
                          title="Grid opacity"
                        />
                      </div>
                    </div>
                  </SettingsIsland>
                  <SettingsInterfaceIsland
                    radii={chromeRadii}
                    onRadiusChange={onChromeRadiusChange}
                    sleepDelayMs={sleepDelayMs}
                    onSleepDelayChange={onSleepDelayChange}
                  />
                  <SettingsIsland>
                    <div className="taskmap-settings-section-heading">
                      <IconPalette size={16} stroke={2} />
                      <span>Default element colors</span>
                    </div>
                    <div className="taskmap-settings-section-description">
                      Applied to newly created elements.
                    </div>
                    <div className="taskmap-settings-color-grid">
                      {DEFAULT_COLOR_OPTIONS.map(({ label, value }) => (
                        <Button
                          key={value}
                          variant="ghost"
                          className="taskmap-settings-color-trigger"
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setDefaultColorPicker({
                              elementType: value,
                              left: rect.right + 8,
                              top: rect.top,
                            });
                          }}
                          title={`Choose default ${label.toLowerCase()} color`}
                        >
                          <span
                            className="taskmap-settings-color-swatch"
                            style={{ backgroundColor: defaultElementColors[value] }}
                          />
                          <span className="taskmap-settings-color-copy">
                            <span className="taskmap-settings-color-label">{label}</span>
                            <span className="taskmap-settings-color-value">
                              {defaultElementColors[value]}
                            </span>
                          </span>
                        </Button>
                      ))}
                    </div>
                  </SettingsIsland>
                  <SettingsToggleRow
                    label="Canvas-only shadows"
                    description="Shadows fall on the canvas, never onto overlapping elements."
                    checked={shadowsUnderElements}
                    onCheckedChange={onShadowsUnderElementsChange}
                  />
                  <SettingsToggleRow
                    label="Privacy mode"
                    description="Hide TaskMap from screenshots and screen capture."
                    leading={
                      privacyModeEnabled ? (
                        <IconEyeOff size={18} stroke={2} />
                      ) : (
                        <IconEye size={18} stroke={2} />
                      )
                    }
                    checked={privacyModeEnabled}
                    onCheckedChange={onPrivacyModeEnabledChange}
                  />
                </>
              )}
              {activeTab === "data" && databaseActions && (
                <DatabaseSettingsActions {...databaseActions} />
              )}
              {activeTab === "data" && !databaseActions && (
                <div className="taskmap-settings-data-grid">
                  <input
                    ref={importInputRef}
                    className="hidden"
                    type="file"
                    accept=".tmap,.json,application/json"
                    spellCheck={false}
                    onChange={handleImportFile}
                  />
                  <SettingsIsland className="taskmap-settings-data-action">
                    <Button
                      leadingIcon={<IconDownload size={18} stroke={2} />}
                      onClick={handleExport}
                      disabled={busy}
                    >
                      Export data
                    </Button>
                  </SettingsIsland>
                  <SettingsIsland className="taskmap-settings-data-action">
                    <Button
                      leadingIcon={<IconUpload size={18} stroke={2} />}
                      onClick={handleImportClick}
                      disabled={busy}
                    >
                      Import data
                    </Button>
                  </SettingsIsland>
                  {dataStatus && <div className="taskmap-settings-data-status">{dataStatus}</div>}
                </div>
              )}
              {activeTab === "misc" && (
                <div className="taskmap-settings-misc">
                  <SettingsToggleRow
                    label="Allow removing locked elements"
                    description="Lock canvas interactions without preventing removal."
                    checked={allowLockedElementDeletion}
                    onCheckedChange={onAllowLockedElementDeletionChange}
                  />
                  <Button
                    className="taskmap-settings-update-button"
                    leadingIcon={<IconRefresh size={17} stroke={2} />}
                    onClick={handleCheckForUpdate}
                    disabled={updateBusy}
                  >
                    {updateBusy ? "Checking..." : "Check for updates"}
                  </Button>
                </div>
              )}
              {activeTab === "shortcuts" && (
                <div>
                  <div className="taskmap-settings-section-heading">
                    <IconKeyboard size={16} stroke={2} />
                    <span>Shortcuts</span>
                  </div>
                  <SettingsIsland className="taskmap-settings-shortcuts">
                    {SHORTCUTS.map((shortcut) => (
                      <div key={shortcut.label} className="taskmap-settings-shortcut-row">
                        <span className="taskmap-settings-shortcut-label">{shortcut.label}</span>
                        <span className="taskmap-settings-key-group">
                          {shortcut.keys.map((key) => (
                            <Keycap key={key}>{key}</Keycap>
                          ))}
                        </span>
                      </div>
                    ))}
                  </SettingsIsland>
                </div>
              )}
              {import.meta.env.DEV && activeTab === "dev" && (
                <div className="taskmap-settings-content-stack">
                  <SettingsToggleRow
                    label="FPS counter"
                    description="Show frame timing overlay."
                    checked={fpsCounterVisible}
                    onCheckedChange={onFpsCounterVisibleChange}
                  />
                  <SettingsToggleRow
                    label="Visual tuner"
                    description="Show temporary glass and workspace geometry controls."
                    checked={temporaryPanelsVisible}
                    onCheckedChange={onTemporaryPanelsVisibleChange}
                  />
                </div>
              )}
            </div>
          </SettingsIslandList>
        </div>
        <div className="taskmap-settings-footer">MADE BY MERK - v{appVersion}</div>
      </SettingsShell>
      {defaultColorPicker && (
        <ColorPickerMenu
          aboveModals
          key={defaultColorPicker.elementType}
          color={defaultElementColors[defaultColorPicker.elementType]}
          left={defaultColorPicker.left}
          top={defaultColorPicker.top}
          recentColors={recentColors}
          onChange={(color) => onDefaultElementColorChange(defaultColorPicker.elementType, color)}
          onClose={(recentColor) => {
            onRememberRecentColor(recentColor);
            setDefaultColorPicker(null);
          }}
        />
      )}
      <ModalPresence open={updateModalOpen && Boolean(availableUpdate)} placement="nested">
        {availableUpdate ? (
          <UpdateAvailableModal
            update={availableUpdate}
            onInstall={onInstallUpdate}
            onDismiss={() => setUpdateModalOpen(false)}
          />
        ) : null}
      </ModalPresence>
      <ModalPresence open={Boolean(passwordModal)} placement="nested">
        {passwordModal ? (
          <SettingsPasswordDialog
            busy={busy}
            mode={passwordModal}
            password={passwordDraft}
            onPasswordChange={setPasswordDraft}
            onClose={closePasswordModal}
            onSubmit={submitPassword}
          />
        ) : null}
      </ModalPresence>
    </Fragment>
  );
}
