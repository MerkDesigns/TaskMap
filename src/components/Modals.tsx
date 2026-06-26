import {
  IconDownload,
  IconGrid3x3,
  IconGridDots,
  IconKeyboard,
  IconRefresh,
  IconRotateClockwise,
  IconSettings,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { AppUpdateInfo, CanvasGridStyle } from "../types";

type UpdateAvailableModalProps = {
  update: AppUpdateInfo;
  onInstall: () => Promise<void>;
  onDismiss: () => void;
};

export function UpdateAvailableModal({ update, onInstall, onDismiss }: UpdateAvailableModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      <div className="w-[380px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconDownload size={19} stroke={2} className="text-white/70" />
            <h2 className="text-[16px] font-semibold">Update available</h2>
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
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45">
      <div className="w-[360px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <div className="mb-3 flex items-center gap-2">
          <IconTrash size={20} stroke={2} className="text-red-300" />
          <h2 className="text-[16px] font-semibold">Clear canvas?</h2>
        </div>
        <p className="mb-5 text-sm leading-5 text-white/65">
          This will remove all containers from the canvas.
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
  onExportData: (password: string) => Promise<void>;
  onImportData: (file: File, password: string) => Promise<void>;
  discordRpcEnabled: boolean;
  onDiscordRpcEnabledChange: (enabled: boolean) => void;
  availableUpdate: AppUpdateInfo | null;
  appVersion: string;
  fpsCounterVisible: boolean;
  onFpsCounterVisibleChange: (visible: boolean) => void;
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
] as const;

export function SettingsModal({
  canvasGridStyle,
  onCanvasGridStyleChange,
  canvasGridOpacity,
  onCanvasGridOpacityChange,
  onExportData,
  onImportData,
  discordRpcEnabled,
  onDiscordRpcEnabledChange,
  availableUpdate,
  appVersion,
  fpsCounterVisible,
  onFpsCounterVisibleChange,
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
  const [activeTab, setActiveTab] =
    useState<"visual" | "data" | "misc" | "shortcuts" | "dev">("visual");

  useEffect(() => {
    const trigger = document.activeElement;
    if (trigger instanceof HTMLElement) {
      trigger.blur();
    }
  }, []);

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


  const runDataAction = async (
    password: string,
    action: (password: string) => Promise<void>,
    successMessage: string,
  ) => {
    setDataStatus("");

    if (!password) {
      setDataStatus("Password required.");
      return;
    }

    setBusy(true);
    try {
      await action(password);
      setDataStatus(successMessage);
      setPasswordModal(null);
      setPasswordDraft("");
      setPendingImportFile(null);
    } catch (error) {
      setDataStatus(error instanceof Error ? error.message : String(error));
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
      setUpdateStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setUpdateBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50">
      <div className="relative flex h-[432px] w-[528px] flex-col rounded-xl border border-white/[0.15] bg-[#141519] p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconSettings size={20} stroke={2} className="text-white/75" />
            <h2 className="text-[16px] font-semibold">Settings</h2>
          </div>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/[0.10] hover:text-white"
            onClick={onClose}
            title="Close settings"
          >
            <IconX size={17} stroke={2} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-5 items-end gap-1 px-1">
            {(["visual", "data", "misc", "shortcuts", "dev"] as const).map((tab) => (
              <button
                key={tab}
                className={`relative flex h-9 min-w-0 items-center justify-center rounded-t-lg px-2 text-center text-sm font-semibold capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-[#318f87] text-white/88"
                    : "bg-[#141519] text-white/48 hover:bg-white/[0.06] hover:text-white/72"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 space-y-3 px-1 py-4">
            {activeTab === "visual" && (
              <>
                <div className="settings-island left-panel-card left-panel-card-static rounded-lg border border-white/[0.10] bg-[#0f1014] p-3">
                  <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-white/48">
                    Canvas grid
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {GRID_OPTIONS.map(({ label, value, Icon }) => {
                      const selected = canvasGridStyle === value;

                      return (
                        <button
                          key={value}
                          className={`left-panel-card flex h-10 items-center justify-center gap-2 rounded-md border text-sm transition-colors ${
                            selected
                              ? "border-white/30 bg-white/[0.14] text-white"
                              : "border-white/[0.10] bg-black/[0.12] text-white/62 hover:bg-white/[0.08] hover:text-white"
                          }`}
                          onClick={() => onCanvasGridStyleChange(value)}
                        >
                          <Icon size={17} stroke={2} />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="settings-island left-panel-card left-panel-card-static rounded-lg border border-white/[0.10] bg-[#0f1014] p-3">
                  <div className="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wide text-white/48">
                    <span>Grid opacity</span>
                    <span className="text-white/60">{canvasGridOpacity}%</span>
                  </div>
                  <input
                    className="range range-xs [--range-shdw:rgba(255,255,255,0.72)]"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={canvasGridOpacity}
                    spellCheck={false}
                    onChange={(event) => onCanvasGridOpacityChange(Number(event.target.value))}
                    title="Grid opacity"
                  />
                </div>
              </>
            )}
            {activeTab === "data" && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  ref={importInputRef}
                  className="hidden"
                  type="file"
                  accept="application/json,.json"
                  spellCheck={false}
                  onChange={handleImportFile}
                />
                <button
                  className="settings-island left-panel-card left-panel-card-static flex h-11 items-center justify-center gap-2 rounded-lg border border-white/[0.10] bg-[#0f1014] px-3 text-sm font-semibold text-white/72 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={handleExport}
                  disabled={busy}
                >
                  <IconDownload size={18} stroke={2} />
                  <span>Export data</span>
                </button>
                <button
                  className="settings-island left-panel-card left-panel-card-static flex h-11 items-center justify-center gap-2 rounded-lg border border-white/[0.10] bg-[#0f1014] px-3 text-sm font-semibold text-white/72 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={handleImportClick}
                  disabled={busy}
                >
                  <IconUpload size={18} stroke={2} />
                  <span>Import data</span>
                </button>
                {dataStatus && <div className="col-span-2 text-xs text-white/58">{dataStatus}</div>}
              </div>
            )}
            {activeTab === "misc" && (
              <div className="flex min-h-[198px] flex-col">
                <label className="settings-island left-panel-card left-panel-card-static flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[0.10] bg-[#0f1014] p-3">
                  <span className="flex flex-col">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-white/48">
                      Discord status
                    </span>
                    <span className="mt-0.5 text-[12px] text-white/45">
                      Show time spent in TaskMap on your Discord profile.
                    </span>
                  </span>
                  <input
                    className="peer sr-only"
                    type="checkbox"
                    checked={discordRpcEnabled}
                    onChange={(event) => onDiscordRpcEnabledChange(event.target.checked)}
                  />
                  <span className="relative h-6 w-11 flex-shrink-0 rounded-full bg-white/[0.08] transition-colors peer-checked:bg-[#318f87] after:absolute after:left-0.5 after:top-0.5 after:h-[18px] after:w-[18px] after:rounded-full after:bg-white/55 after:shadow after:transition-all after:content-[''] peer-checked:after:translate-x-5 peer-checked:after:bg-white" aria-hidden="true" />
                </label>
                <button
                  className="mt-auto flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-white/[0.06] text-sm text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={handleCheckForUpdate}
                  disabled={updateBusy}
                >
                  <IconRefresh size={17} stroke={2} />
                  <span>{updateBusy ? "Checking..." : "Check for updates"}</span>
                </button>
              </div>
            )}
            {activeTab === "shortcuts" && (
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-2 flex items-center gap-2 px-1 py-1 text-[13px] font-semibold uppercase tracking-wide text-white/48">
                  <IconKeyboard size={16} stroke={2} />
                  <span>Shortcuts</span>
                </div>
                <div className="canvas-browser-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                  {SHORTCUTS.map((shortcut) => (
                    <div
                      key={shortcut.label}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-white/[0.10] bg-[#0f1014] px-3 py-2"
                    >
                      <span className="text-[14px] text-white/72">{shortcut.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {shortcut.keys.map((key) => (
                          <kbd
                            key={key}
                            className="rounded border border-white/[0.14] bg-white/[0.07] px-2 py-1 font-mono text-[12px] font-medium text-white/76 shadow-[0_1px_0_rgba(255,255,255,0.08)]"
                          >
                            {key}
                          </kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === "dev" && (
              <div className="space-y-3">
                <label className="settings-island left-panel-card left-panel-card-static flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[0.10] bg-[#0f1014] p-3">
                  <span className="flex flex-col">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-white/48">
                      FPS counter
                    </span>
                    <span className="mt-0.5 text-[12px] text-white/45">
                      Show frame timing overlay.
                    </span>
                  </span>
                  <input
                    className="peer sr-only"
                    type="checkbox"
                    checked={fpsCounterVisible}
                    onChange={(event) => onFpsCounterVisibleChange(event.target.checked)}
                  />
                  <span className="relative h-6 w-11 flex-shrink-0 rounded-full bg-white/[0.08] transition-colors peer-checked:bg-[#318f87] after:absolute after:left-0.5 after:top-0.5 after:h-[18px] after:w-[18px] after:rounded-full after:bg-white/55 after:shadow after:transition-all after:content-[''] peer-checked:after:translate-x-5 peer-checked:after:bg-white" />
                </label>
                <div className="settings-island left-panel-card left-panel-card-static rounded-lg border border-white/[0.10] bg-[#0f1014] p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-white/48">
                        Temporary panels
                      </span>
                      <span className="mt-0.5 text-[12px] text-white/45">
                        Show frosted glass tuning overlays.
                      </span>
                    </span>
                    <input
                      className="peer sr-only"
                      type="checkbox"
                      checked={temporaryPanelsVisible}
                      onChange={(event) => onTemporaryPanelsVisibleChange(event.target.checked)}
                    />
                    <span className="relative h-6 w-11 flex-shrink-0 rounded-full bg-white/[0.08] transition-colors peer-checked:bg-[#318f87] after:absolute after:left-0.5 after:top-0.5 after:h-[18px] after:w-[18px] after:rounded-full after:bg-white/55 after:shadow after:transition-all after:content-[''] peer-checked:after:translate-x-5 peer-checked:after:bg-white" />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 text-center text-[12px] font-semibold tracking-[0.18em] text-white/26">
          MADE BY MERK - v{appVersion}
        </div>
      </div>
      {updateModalOpen && availableUpdate && (
        <UpdateAvailableModal
          update={availableUpdate}
          onInstall={onInstallUpdate}
          onDismiss={() => setUpdateModalOpen(false)}
        />
      )}
      {passwordModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/48">
          <div className="frosted-glass w-[340px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {passwordModal === "export" ? (
                  <IconDownload size={19} stroke={2} className="text-white/70" />
                ) : (
                  <IconUpload size={19} stroke={2} className="text-white/70" />
                )}
                <h2 className="text-[16px] font-semibold">
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
    </div>
  );
}
