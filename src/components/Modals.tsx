import {
  IconDownload,
  IconGrid3x3,
  IconGridDots,
  IconRefresh,
  IconRotateClockwise,
  IconSettings,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { ChangeEvent, useRef, useState } from "react";
import { AppUpdateInfo, CanvasGridStyle } from "../types";

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
  onCheckForUpdate,
  onInstallUpdate,
  onClose,
}: SettingsModalProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [passwordModal, setPasswordModal] = useState<"export" | "import" | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [dataStatus, setDataStatus] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

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
        setUpdateStatus("TaskMap is up to date.");
      }
    } catch (error) {
      setUpdateStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleInstallUpdate = async () => {
    setUpdateStatus("Saving data and installing update...");
    setUpdateBusy(true);

    try {
      await onInstallUpdate();
    } catch (error) {
      setUpdateStatus(error instanceof Error ? error.message : String(error));
      setUpdateModalOpen(false);
      setUpdateBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/35">
      <div className="w-[440px] rounded-xl border border-white/[0.15] bg-[#1b1b1e]/94 p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-md">
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
        <div className="space-y-3 rounded-lg border border-white/[0.10] bg-white/[0.03] p-4">
          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-white/48">
              Canvas grid
            </div>
            <div className="grid grid-cols-2 gap-2">
              {GRID_OPTIONS.map(({ label, value, Icon }) => {
                const selected = canvasGridStyle === value;

                return (
                  <button
                    key={value}
                    className={`flex h-10 items-center justify-center gap-2 rounded-md border text-sm transition-colors ${
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
          <div>
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
          <div className="border-t border-white/[0.10] pt-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
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
              <span
                className="relative h-6 w-11 flex-shrink-0 rounded-full border border-white/[0.12] bg-white/[0.08] transition-colors peer-checked:border-[#5865f2] peer-checked:bg-[#5865f2] after:absolute after:left-0.5 after:top-0.5 after:h-[18px] after:w-[18px] after:rounded-full after:bg-white/55 after:shadow after:transition-all after:content-[''] peer-checked:after:translate-x-5 peer-checked:after:bg-white"
                aria-hidden="true"
              />
            </label>
          </div>
          <div className="border-t border-white/[0.10] pt-3">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-white/48">
              Data
            </div>
            <input
              ref={importInputRef}
              className="hidden"
              type="file"
              accept="application/json,.json"
              spellCheck={false}
              onChange={handleImportFile}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-black/[0.12] text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                onClick={handleExport}
                disabled={busy}
              >
                <IconDownload size={17} stroke={2} />
                <span>Export</span>
              </button>
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-black/[0.12] text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                onClick={handleImportClick}
                disabled={busy}
              >
                <IconUpload size={17} stroke={2} />
                <span>Import</span>
              </button>
            </div>
            {dataStatus && <div className="mt-2 text-xs text-white/58">{dataStatus}</div>}
          </div>
          <div className="border-t border-white/[0.10] pt-3">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-white/48">
              Updates
            </div>
            <button
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-black/[0.12] text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              onClick={handleCheckForUpdate}
              disabled={updateBusy}
            >
              <IconRefresh size={17} stroke={2} />
              <span>{updateBusy ? "Checking..." : "Check for updates"}</span>
            </button>
          </div>
        </div>
        <div className="mt-5 text-center text-[12px] font-semibold tracking-[0.18em] text-white/26">
          MADE BY MERK - v{appVersion}
        </div>
      </div>
      {updateModalOpen && availableUpdate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/48">
          <div className="w-[380px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconDownload size={19} stroke={2} className="text-white/70" />
                <h2 className="text-[16px] font-semibold">Update available</h2>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/[0.10] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setUpdateModalOpen(false)}
                disabled={updateBusy}
                title="Close"
              >
                <IconX size={17} stroke={2} />
              </button>
            </div>
            <div className="mb-5 space-y-2 text-sm text-white/68">
              <div>
                TaskMap {availableUpdate.version} is ready to download.
              </div>
              <div className="text-xs text-white/48">
                Current version: {availableUpdate.currentVersion}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setUpdateModalOpen(false)}
                disabled={updateBusy}
              >
                <IconX size={17} stroke={2} />
                <span>Later</span>
              </button>
              <button
                className="flex h-9 items-center gap-2 rounded-md bg-white/[0.12] px-3 text-sm text-white transition-colors hover:bg-white/[0.18] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={handleInstallUpdate}
                disabled={updateBusy}
              >
                <IconDownload size={17} stroke={2} />
                <span>{updateBusy ? "Installing..." : "Download"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {passwordModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/48">
          <div className="w-[340px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
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
              className="mb-4 h-10 w-full rounded-md border border-white/[0.12] bg-black/[0.18] px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/35"
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
