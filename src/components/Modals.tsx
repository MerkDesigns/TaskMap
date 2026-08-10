import {
  IconDownload,
  IconEye,
  IconEyeOff,
  IconGrid3x3,
  IconGridDots,
  IconKeyboard,
  IconPalette,
  IconRefresh,
  IconRotateClockwise,
  IconSettings,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { commandErrorMessage } from "../app/commandError";
import { AppUpdateInfo, CanvasGridStyle, DefaultElementColors } from "../types";
import {
  Button,
  IconButton,
  Keycap,
  LiquidTabs,
  ScrollArea,
  SegmentedControl,
  Slider,
} from "../ui/primitives";
import { ModalLayer } from "../ui/patterns/overlays";
import { SettingsIsland, SettingsShell, SettingsToggleRow } from "../ui/patterns/settings";
import { ColorPickerMenu } from "./ColorPickerMenu";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const useDialogFocus = (open = true) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !dialogRef.current) {
      return;
    }

    const dialog = dialogRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableElements = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    (focusableElements()[0] ?? dialog).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }
      const openDialogs = Array.from(
        document.querySelectorAll<HTMLElement>("[role='dialog'][aria-modal='true']"),
      );
      if (openDialogs[openDialogs.length - 1] !== dialog) {
        return;
      }

      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      previousFocus?.focus();
    };
  }, [open]);

  return dialogRef;
};

type UpdateAvailableModalProps = {
  update: AppUpdateInfo;
  onInstall: () => Promise<void>;
  onDismiss: () => void;
};

export function UpdateAvailableModal({ update, onInstall, onDismiss }: UpdateAvailableModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useDialogFocus();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [busy, onDismiss]);

  const handleInstall = async () => {
    setError("");
    setBusy(true);
    try {
      await onInstall();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/48">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-available-title"
        tabIndex={-1}
        className="w-[380px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconDownload size={19} stroke={2} className="text-white/70" />
            <h2 id="update-available-title" className="text-[16px] font-semibold">
              Update available
            </h2>
          </div>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/[0.10] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onDismiss}
            disabled={busy}
            title="Close"
          >
            <IconX size={17} stroke={2} />
          </button>
        </div>
        <div className="mb-5 space-y-2 text-sm text-white/68">
          <div>TaskMap {update.version} is ready to download.</div>
          <div className="text-xs text-white/48">Current version: {update.currentVersion}</div>
          {error && <div className="text-xs text-red-300">{error}</div>}
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onDismiss}
            disabled={busy}
          >
            <IconX size={17} stroke={2} />
            <span>Not now</span>
          </button>
          <button
            className="flex h-9 items-center gap-2 rounded-md bg-white/[0.12] px-3 text-sm text-white transition-colors hover:bg-white/[0.18] disabled:cursor-not-allowed disabled:opacity-45"
            onClick={handleInstall}
            disabled={busy}
          >
            <IconDownload size={17} stroke={2} />
            <span>{busy ? "Installing..." : "Update"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

type ClearCanvasModalProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function ClearCanvasModal({ onCancel, onConfirm }: ClearCanvasModalProps) {
  const dialogRef = useDialogFocus();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-canvas-title"
        tabIndex={-1}
        className="w-[360px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-3 flex items-center gap-2">
          <IconTrash size={20} stroke={2} className="text-red-300" />
          <h2 id="clear-canvas-title" className="text-[16px] font-semibold">
            Clear canvas?
          </h2>
        </div>
        <p className="mb-5 text-sm leading-5 text-white/65">
          This will remove all content from the canvas, including locked items.
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-white/75 hover:bg-white/[0.10] hover:text-white"
            onClick={onCancel}
          >
            <IconX size={17} stroke={2} />
            <span>Cancel</span>
          </button>
          <button
            className="flex h-9 items-center gap-2 rounded-md bg-red-500/18 px-3 text-sm text-red-200 hover:bg-red-500/25"
            onClick={onConfirm}
          >
            <IconRotateClockwise size={17} stroke={2} />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
}

type SettingsModalProps = {
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
  discordRpcEnabled: boolean;
  onDiscordRpcEnabledChange: (enabled: boolean) => void;
  discordRpcShowCanvas: boolean;
  onDiscordRpcShowCanvasChange: (enabled: boolean) => void;
  availableUpdate: AppUpdateInfo | null;
  appVersion: string;
  fpsCounterVisible: boolean;
  onFpsCounterVisibleChange: (visible: boolean) => void;
  privacyModeEnabled: boolean;
  onPrivacyModeEnabledChange: (enabled: boolean) => void;
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
  discordRpcEnabled,
  onDiscordRpcEnabledChange,
  discordRpcShowCanvas,
  onDiscordRpcShowCanvasChange,
  availableUpdate,
  appVersion,
  fpsCounterVisible,
  onFpsCounterVisibleChange,
  privacyModeEnabled,
  onPrivacyModeEnabledChange,
  temporaryPanelsVisible,
  onTemporaryPanelsVisibleChange,
  onCheckForUpdate,
  onInstallUpdate,
  onClose,
}: SettingsModalProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
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
  const passwordDialogRef = useDialogFocus(Boolean(passwordModal));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();

      if (updateModalOpen) {
        setUpdateModalOpen(false);
      } else if (passwordModal) {
        setPasswordModal(null);
        setPasswordDraft("");
        setPendingImportFile(null);
      } else {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [updateModalOpen, passwordModal, onClose]);

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
    <ModalLayer>
      <SettingsShell
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        data-settings-primary-shell
      >
        <div className="taskmap-settings-header">
          <div className="taskmap-settings-header__identity">
            <IconSettings size={20} stroke={2} className="taskmap-settings-header__icon" />
            <h2 id="settings-title" className="taskmap-settings-title">
              Settings
            </h2>
          </div>
          <IconButton
            className="taskmap-settings-close"
            variant="ghost"
            size="compact"
            aria-label="Close settings"
            onClick={onClose}
            title="Close settings"
            icon={<IconX size={17} stroke={2} />}
          />
        </div>
        <div className="taskmap-settings-body">
          <LiquidTabs
            className="taskmap-settings-navigation"
            label="Settings categories"
            items={SETTINGS_TAB_ITEMS}
            value={activeTab}
            onValueChange={setActiveTab}
          />
          <ScrollArea key={activeTab} className="taskmap-settings-scroll">
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
                            {canvasGridOpacity}%
                          </span>
                        </div>
                        <Slider
                          className="taskmap-settings-slider"
                          min={0}
                          max={100}
                          step={5}
                          value={canvasGridOpacity}
                          spellCheck={false}
                          onChange={(event) =>
                            onCanvasGridOpacityChange(Number(event.target.value))
                          }
                          title="Grid opacity"
                        />
                      </div>
                    </div>
                  </SettingsIsland>
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
                    label="Shadows below elements"
                    description="Keep shadows on the canvas instead of over other elements."
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
              {activeTab === "data" && (
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
                  <SettingsToggleRow
                    label="Discord status"
                    description="Show time spent in TaskMap on your Discord profile."
                    checked={discordRpcEnabled}
                    onCheckedChange={onDiscordRpcEnabledChange}
                  />
                  <SettingsToggleRow
                    label="Show active canvas"
                    description="Include the current canvas name in your Discord status."
                    checked={discordRpcShowCanvas}
                    disabled={!discordRpcEnabled}
                    onCheckedChange={onDiscordRpcShowCanvasChange}
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
                    label="Temporary panels"
                    description="Show frosted glass tuning overlays."
                    checked={temporaryPanelsVisible}
                    onCheckedChange={onTemporaryPanelsVisibleChange}
                  />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="taskmap-settings-footer">MADE BY MERK - v{appVersion}</div>
      </SettingsShell>
      {defaultColorPicker && (
        <ColorPickerMenu
          className="taskmap-modal-portal-layer"
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
      {updateModalOpen && availableUpdate && (
        <UpdateAvailableModal
          update={availableUpdate}
          onInstall={onInstallUpdate}
          onDismiss={() => setUpdateModalOpen(false)}
        />
      )}
      {passwordModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/48">
          <div
            ref={passwordDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-password-title"
            tabIndex={-1}
            className="frosted-glass w-[340px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {passwordModal === "export" ? (
                  <IconDownload size={19} stroke={2} className="text-white/70" />
                ) : (
                  <IconUpload size={19} stroke={2} className="text-white/70" />
                )}
                <h2 id="data-password-title" className="text-[16px] font-semibold">
                  {passwordModal === "export" ? "Export data" : "Import data"}
                </h2>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/[0.10] hover:text-white"
                onClick={closePasswordModal}
                title="Close"
              >
                <IconX size={17} stroke={2} />
              </button>
            </div>
            <input
              className="left-panel-card mb-4 h-10 w-full rounded-md border border-white/[0.12] bg-black/[0.18] px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/35"
              type="password"
              value={passwordDraft}
              autoFocus
              spellCheck={false}
              onChange={(event) => setPasswordDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitPassword();
                }

                if (event.key === "Escape") {
                  closePasswordModal();
                }
              }}
              placeholder="Password"
            />
            <div className="flex justify-end gap-2">
              <button
                className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
                onClick={closePasswordModal}
              >
                <IconX size={17} stroke={2} />
                <span>Cancel</span>
              </button>
              <button
                className="flex h-9 items-center gap-2 rounded-md bg-white/[0.12] px-3 text-sm text-white transition-colors hover:bg-white/[0.18] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={submitPassword}
                disabled={busy}
              >
                {passwordModal === "export" ? (
                  <IconDownload size={17} stroke={2} />
                ) : (
                  <IconUpload size={17} stroke={2} />
                )}
                <span>{passwordModal === "export" ? "Export" : "Import"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalLayer>
  );
}
