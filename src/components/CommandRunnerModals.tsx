import { invoke } from "@tauri-apps/api/core";
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconFolder,
  IconPlus,
  IconShieldLock,
  IconTerminal2,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { commandErrorMessage } from "../app/commandError";
import type { CommandRunnerCommand } from "../types";

type CommandRunnerSettingsModalProps = {
  cardText: string;
  commands: CommandRunnerCommand[];
  onCancel: () => void;
  onSave: (cardText: string, commands: CommandRunnerCommand[]) => void;
};

type CommandWindowBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type CommandWindowResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

type CommandWindowPointerAction = {
  type: "move" | "resize";
  resizeDirection?: CommandWindowResizeDirection;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startBounds: CommandWindowBounds;
};

const COMMAND_WINDOW_MIN_WIDTH = 560;
const COMMAND_WINDOW_MIN_HEIGHT = 320;
const clampCommandWindow = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(value, maximum));

const getInitialCommandWindowBounds = (): CommandWindowBounds => {
  const width = Math.min(760, window.innerWidth - 32);
  const height = Math.min(560, window.innerHeight - 32);
  return {
    left: Math.max(16, Math.round((window.innerWidth - width) / 2)),
    top: Math.max(16, Math.round((window.innerHeight - height) / 2)),
    width,
    height,
  };
};

export function CommandRunnerSettingsModal({
  cardText,
  commands,
  onCancel,
  onSave,
}: CommandRunnerSettingsModalProps) {
  const [cardTextDraft, setCardTextDraft] = useState(cardText);
  const [draft, setDraft] = useState<CommandRunnerCommand[]>(() => structuredClone(commands));
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [pendingAdminIndex, setPendingAdminIndex] = useState<number | null>(null);
  const [bounds, setBounds] = useState(getInitialCommandWindowBounds);
  const dialogRef = useRef<HTMLElement>(null);
  const pointerActionRef = useRef<CommandWindowPointerAction | null>(null);
  const closingRef = useRef(false);
  const pendingAdminIndexRef = useRef(pendingAdminIndex);
  const closeTimeoutRef = useRef<number | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  pendingAdminIndexRef.current = pendingAdminIndex;

  const requestClose = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    setClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => onCancelRef.current(), 160);
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (pendingAdminIndexRef.current !== null) {
          setPendingAdminIndex(null);
          return;
        }
        requestClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [requestClose]);

  const startPointerAction = (
    event: PointerEvent<HTMLElement>,
    type: CommandWindowPointerAction["type"],
    resizeDirection?: CommandWindowResizeDirection,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerActionRef.current = {
      type,
      resizeDirection,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBounds: bounds,
    };
  };

  const movePointerAction = (event: PointerEvent<HTMLElement>) => {
    const action = pointerActionRef.current;
    if (!action || action.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - action.startClientX;
    const deltaY = event.clientY - action.startClientY;
    if (action.type === "move") {
      setBounds({
        ...action.startBounds,
        left: clampCommandWindow(
          action.startBounds.left + deltaX,
          8,
          window.innerWidth - action.startBounds.width - 8,
        ),
        top: clampCommandWindow(
          action.startBounds.top + deltaY,
          8,
          window.innerHeight - action.startBounds.height - 8,
        ),
      });
      return;
    }

    const direction = action.resizeDirection ?? "se";
    const start = action.startBounds;
    let { left, top, width, height } = start;
    if (direction.includes("e")) {
      width = clampCommandWindow(
        start.width + deltaX,
        COMMAND_WINDOW_MIN_WIDTH,
        window.innerWidth - start.left - 8,
      );
    }
    if (direction.includes("s")) {
      height = clampCommandWindow(
        start.height + deltaY,
        COMMAND_WINDOW_MIN_HEIGHT,
        window.innerHeight - start.top - 8,
      );
    }
    if (direction.includes("w")) {
      left = clampCommandWindow(
        start.left + deltaX,
        8,
        start.left + start.width - COMMAND_WINDOW_MIN_WIDTH,
      );
      width = start.width + start.left - left;
    }
    if (direction.includes("n")) {
      top = clampCommandWindow(
        start.top + deltaY,
        8,
        start.top + start.height - COMMAND_WINDOW_MIN_HEIGHT,
      );
      height = start.height + start.top - top;
    }
    setBounds({ left, top, width, height });
  };

  const finishPointerAction = (event: PointerEvent<HTMLElement>) => {
    if (pointerActionRef.current?.pointerId !== event.pointerId) return;
    pointerActionRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resizeHandleProps = (direction: CommandWindowResizeDirection) => ({
    onPointerDown: (event: PointerEvent<HTMLDivElement>) =>
      startPointerAction(event, "resize", direction),
    onPointerMove: movePointerAction,
    onPointerUp: finishPointerAction,
    onPointerCancel: finishPointerAction,
  });

  const updateCommand = (index: number, update: Partial<CommandRunnerCommand>) => {
    setDraft((current) =>
      current.map((command, commandIndex) =>
        commandIndex === index ? { ...command, ...update } : command,
      ),
    );
    setError("");
  };

  const moveCommand = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= draft.length) {
      return;
    }
    setDraft((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const pickDirectory = async (index: number) => {
    try {
      const directory = await invoke<string | null>("pick_command_working_directory");
      if (directory) {
        updateCommand(index, { workingDirectory: directory });
      }
    } catch (caught) {
      setError(commandErrorMessage(caught));
    }
  };

  const save = () => {
    const nextCardText = cardTextDraft.trim();
    if (!nextCardText) {
      setError("Text card name cannot be blank.");
      return;
    }
    if (draft.some(({ command }) => !command.trim())) {
      setError("Commands cannot be blank.");
      return;
    }

    onSave(
      nextCardText,
      draft.map(({ command, workingDirectory, runMode, runAsAdmin }) => ({
        command,
        runMode,
        ...(workingDirectory?.trim() ? { workingDirectory: workingDirectory.trim() } : {}),
        ...(runAsAdmin ? { runAsAdmin: true } : {}),
      })),
    );
    requestClose();
  };

  return createPortal(
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="command-runner-settings-title"
      className={`fixed z-[1004] flex flex-col overflow-hidden rounded-xl border border-white/[0.15] bg-[#141519] text-white shadow-[0_24px_70px_rgba(0,0,0,0.62)] ${
        closing ? "command-runner-modal-exit pointer-events-none" : "command-runner-modal-enter"
      }`}
      style={bounds}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <header
        ref={dialogRef}
        tabIndex={-1}
        className="flex h-12 shrink-0 cursor-grab items-center justify-between border-b border-white/[0.10] bg-[#1b1b1e] px-3 active:cursor-grabbing"
        onPointerDown={(event) => startPointerAction(event, "move")}
        onPointerMove={movePointerAction}
        onPointerUp={finishPointerAction}
        onPointerCancel={finishPointerAction}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <IconTerminal2 size={19} stroke={2} className="shrink-0 text-white/72" />
          <h2
            id="command-runner-settings-title"
            className="shrink-0 text-sm font-semibold text-white/85"
          >
            Command Runner
          </h2>
          <span className="shrink-0 text-sm text-white/45">-</span>
          <input
            aria-label="Text card name"
            className="h-8 min-w-0 max-w-[320px] flex-1 rounded-md border border-white/[0.12] bg-black/[0.20] px-2.5 text-sm font-medium text-white outline-none selection:bg-white/25 focus:border-white/35"
            value={cardTextDraft}
            spellCheck={false}
            onChange={(event) => {
              setCardTextDraft(event.target.value);
              setError("");
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/[0.10] hover:text-white"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => requestClose()}
            title="Close"
          >
            <IconX size={17} stroke={2} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <div className="json-editor-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {draft.map((entry, index) => (
            <div key={index} className="rounded-lg border border-white/[0.10] bg-black/[0.14] p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="w-6 -translate-x-0.5 -translate-y-1 text-center text-xs font-semibold text-white/40">
                  {index + 1}
                </span>
                <input
                  aria-label={`Command ${index + 1}`}
                  className="h-9 min-w-0 flex-1 rounded-md border border-white/[0.12] bg-black/[0.20] px-2.5 text-sm text-white outline-none placeholder:text-white/28 focus:border-white/35"
                  value={entry.command}
                  placeholder="Command"
                  spellCheck={false}
                  onChange={(event) => updateCommand(index, { command: event.target.value })}
                />
                <div
                  role="group"
                  aria-label={`Run mode ${index + 1}`}
                  className="flex h-9 overflow-hidden rounded-md border border-white/[0.12] bg-black/[0.20] p-0.5"
                >
                  {(["terminal", "background"] as const).map((runMode) => (
                    <button
                      key={runMode}
                      type="button"
                      className={`rounded px-2.5 text-xs transition-colors ${
                        entry.runMode === runMode
                          ? "bg-white/[0.16] text-white"
                          : "text-white/45 hover:bg-white/[0.08] hover:text-white/75"
                      }`}
                      onClick={() => updateCommand(index, { runMode })}
                      aria-pressed={entry.runMode === runMode}
                    >
                      {runMode === "terminal" ? "Terminal" : "Background"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="-ml-1 -translate-y-1 flex h-10 w-7 shrink-0 flex-col">
                  <button
                    type="button"
                    className="grid min-h-0 flex-1 place-items-center text-white/60 hover:text-white disabled:opacity-20"
                    onClick={() => moveCommand(index, -1)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    <IconChevronUp size={18} stroke={3} />
                  </button>
                  <button
                    type="button"
                    className="grid min-h-0 flex-1 place-items-center text-white/60 hover:text-white disabled:opacity-20"
                    onClick={() => moveCommand(index, 1)}
                    disabled={index === draft.length - 1}
                    title="Move down"
                  >
                    <IconChevronDown size={18} stroke={3} />
                  </button>
                </div>
                <input
                  aria-label={`Working directory ${index + 1}`}
                  className="h-8 min-w-0 flex-1 rounded-md border border-white/[0.12] bg-black/[0.20] px-2.5 text-xs text-white outline-none placeholder:text-white/28 focus:border-white/35"
                  value={entry.workingDirectory ?? ""}
                  placeholder="Working directory (optional)"
                  spellCheck={false}
                  onChange={(event) =>
                    updateCommand(index, { workingDirectory: event.target.value })
                  }
                />
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/[0.10] hover:text-white"
                  onClick={() => void pickDirectory(index)}
                  title="Choose folder"
                >
                  <IconFolder size={19.55} stroke={2} />
                </button>
                <button
                  type="button"
                  className={`grid h-8 w-8 place-items-center rounded-md transition-colors ${
                    entry.runAsAdmin
                      ? "bg-red-500/40 text-red-50 hover:bg-red-500/50"
                      : "text-white/50 hover:bg-white/[0.10] hover:text-white/80"
                  }`}
                  onClick={() => {
                    if (entry.runAsAdmin) {
                      updateCommand(index, { runAsAdmin: false });
                    } else {
                      setPendingAdminIndex(index);
                    }
                  }}
                  aria-label={`Run as administrator ${index + 1}`}
                  aria-pressed={Boolean(entry.runAsAdmin)}
                  title="Run as administrator"
                >
                  <IconShieldLock size={19.2} stroke={2} />
                </button>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-md text-red-400 hover:bg-red-500/[0.18] hover:text-red-300"
                  onClick={() => setDraft((current) => current.filter((_, i) => i !== index))}
                  title="Remove command"
                >
                  <IconTrash size={18.7} stroke={2} />
                </button>
              </div>
            </div>
          ))}
          {draft.length === 0 && (
            <div className="grid min-h-28 place-items-center rounded-lg border border-dashed border-white/[0.12] text-sm text-white/40">
              No saved commands
            </div>
          )}
        </div>

        {error && <div className="mt-3 text-xs text-red-300">{error}</div>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-md bg-white/[0.08] px-3 text-sm text-white/75 hover:bg-white/[0.13] hover:text-white"
            onClick={() =>
              setDraft((current) => [...current, { command: "", runMode: "terminal" }])
            }
          >
            <IconPlus size={17} stroke={2} />
            <span>Add command</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 rounded-md px-3 text-sm text-white/70 hover:bg-white/[0.10] hover:text-white"
              onClick={() => requestClose()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 rounded-md bg-[#318f87] px-3 text-sm font-semibold text-white/92 transition-colors hover:bg-[#38a198]"
              onClick={save}
            >
              <IconCheck size={16} stroke={2} />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
      <div
        className="absolute left-2 right-2 top-0 z-10 h-1 cursor-ns-resize"
        {...resizeHandleProps("n")}
      />
      <div
        className="absolute bottom-0 left-2 right-2 z-10 h-1 cursor-ns-resize"
        {...resizeHandleProps("s")}
      />
      <div
        className="absolute bottom-2 left-0 top-2 z-10 w-1 cursor-ew-resize"
        {...resizeHandleProps("w")}
      />
      <div
        className="absolute bottom-2 right-0 top-2 z-10 w-1 cursor-ew-resize"
        {...resizeHandleProps("e")}
      />
      <div
        className="absolute left-0 top-0 z-20 h-2 w-2 cursor-nwse-resize"
        {...resizeHandleProps("nw")}
      />
      <div
        className="absolute right-0 top-0 z-20 h-2 w-2 cursor-nesw-resize"
        {...resizeHandleProps("ne")}
      />
      <div
        className="absolute bottom-0 left-0 z-20 h-2 w-2 cursor-nesw-resize"
        {...resizeHandleProps("sw")}
      />
      <div
        className="absolute bottom-0 right-0 z-20 h-2 w-2 cursor-nwse-resize"
        {...resizeHandleProps("se")}
      />
      {pendingAdminIndex !== null && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-runner-admin-confirm-title"
            className="w-full max-w-[390px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 shadow-[0_20px_55px_rgba(0,0,0,0.55)]"
          >
            <div className="mb-3 flex items-center gap-2 text-red-200">
              <IconShieldLock size={20} stroke={2} />
              <h3 id="command-runner-admin-confirm-title" className="text-sm font-semibold">
                Run this command as administrator?
              </h3>
            </div>
            <p className="text-sm leading-5 text-white/60">
              Windows will request administrator permission when this command starts. Only enable
              this for commands you trust.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="h-9 rounded-md px-3 text-sm text-white/70 hover:bg-white/[0.10] hover:text-white"
                onClick={() => setPendingAdminIndex(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-9 rounded-md bg-red-500/20 px-3 text-sm font-medium text-red-100 hover:bg-red-500/30"
                onClick={() => {
                  updateCommand(pendingAdminIndex, { runAsAdmin: true });
                  setPendingAdminIndex(null);
                }}
              >
                Enable Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </section>,
    document.body,
  );
}

type ExtensionConflictModalProps = {
  requestedLabel: string;
  existingLabels: string[];
  affectedCount: number;
  targetCount: number;
  removesSavedCommands: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ExtensionConflictModal({
  requestedLabel,
  existingLabels,
  affectedCount,
  targetCount,
  removesSavedCommands,
  onCancel,
  onConfirm,
}: ExtensionConflictModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  const plural = affectedCount === 1 ? "card" : "cards";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/48">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="extension-conflict-title"
        tabIndex={-1}
        className="w-[400px] rounded-xl border border-white/[0.15] bg-[#202023] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-3 flex items-center gap-2">
          <IconTerminal2 size={20} stroke={2} className="text-amber-300" />
          <h2 id="extension-conflict-title" className="text-[16px] font-semibold">
            Replace {existingLabels.join(" and ")}?
          </h2>
        </div>
        <p className="text-sm leading-5 text-white/65">
          {targetCount > 1
            ? `${affectedCount} of ${targetCount} selected ${plural} already use a conflicting extension.`
            : `This card already uses ${existingLabels.join(" and ")}.`}{" "}
          {requestedLabel} will replace
          {existingLabels.length === 1 ? " it" : " them"}.
        </p>
        {removesSavedCommands && (
          <p className="mt-2 text-sm leading-5 text-amber-200/80">
            Saved Command Runner commands on affected cards will be removed.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="h-9 rounded-md px-3 text-sm text-white/70 hover:bg-white/[0.10] hover:text-white"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-9 rounded-md bg-amber-400/[0.16] px-3 text-sm text-amber-100 hover:bg-amber-400/[0.23]"
            onClick={onConfirm}
          >
            Replace with {requestedLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
