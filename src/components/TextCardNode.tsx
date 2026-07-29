import { invoke } from "@tauri-apps/api/core";
import {
  IconCheck,
  IconLink,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconSettings,
} from "@tabler/icons-react";
import { MouseEvent, PointerEvent, memo, useEffect, useRef, useState } from "react";
import { getTextCardAccent } from "../constants";
import { TextCardElement } from "../types";

type TextCardNodeProps = {
  card: TextCardElement;
  editing: boolean;
  draft: string;
  position?: {
    x: number;
    y: number;
    width?: number;
    maxWidth?: number;
  };
  entering?: boolean;
  deleting?: boolean;
  pulsing?: boolean;
  glowing?: boolean;
  dragging?: boolean;
  dragAtTrueSize?: boolean;
  dragPrimary?: boolean;
  dragBundleIndex?: number;
  dragPickupX?: number;
  dragPickupY?: number;
  dragSwayX?: number;
  dragSwayY?: number;
  moving?: boolean;
  settling?: boolean;
  selected?: boolean;
  interactionDisabled?: boolean;
  linksDisabled?: boolean;
  privacyHidden?: boolean;
  shadowsUnderElements: boolean;
  onDraftChange: (value: string) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onStartMove: (event: PointerEvent<HTMLElement>, card: TextCardElement) => void;
  onOpenMenu: (event: MouseEvent<HTMLElement>, card: TextCardElement) => void;
  onToggleCheckbox: (id: string) => void;
  onRunCommands: (id: string) => void;
  running: boolean;
  onStopCommands: (id: string) => void;
};

function tintTowardWhite(hexColor: string, amount = 0.61) {
  const hex = hexColor.replace("#", "");
  const value = Number.parseInt(
    hex.length === 3 ? hex.replace(/./g, (char) => `${char}${char}`) : hex,
    16,
  );

  if (!Number.isFinite(value)) {
    return "#ffffff";
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);

  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`;
}

function TextCardNodeComponent({
  card,
  editing,
  draft,
  position,
  entering = false,
  deleting = false,
  pulsing = false,
  glowing = false,
  dragging = false,
  dragAtTrueSize = false,
  dragPrimary = false,
  dragBundleIndex = -1,
  dragPickupX = 0,
  dragPickupY = 0,
  dragSwayX = 0,
  dragSwayY = 0,
  moving = false,
  settling = false,
  selected = false,
  interactionDisabled = false,
  linksDisabled = false,
  privacyHidden = false,
  shadowsUnderElements,
  onDraftChange,
  onSave,
  onCancel,
  onStartMove,
  onOpenMenu,
  onToggleCheckbox,
  onRunCommands,
  running,
  onStopCommands,
}: TextCardNodeProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const commandAnimationTimeoutRef = useRef<number | null>(null);
  const commandLaunchTimeoutRef = useRef<number | null>(null);
  const [commandPlayAnimating, setCommandPlayAnimating] = useState(false);
  const accent = getTextCardAccent(card.accent);
  const selectedAccent = selected ? `color-mix(in srgb, ${accent} 72%, white 28%)` : accent;
  const linkedTextColor = tintTowardWhite(accent);
  const checkboxInstalled = Boolean(card.extensions?.checkbox);
  const checkboxChecked = Boolean(card.extensions?.checkbox?.checked);
  const commandRunnerInstalled = Boolean(card.extensions?.commandRunner);
  const hasCommands = Boolean(card.extensions?.commandRunner?.commands.length);
  const checkedTextClass = checkboxChecked ? "opacity-55 line-through" : "";

  useEffect(() => {
    if (!editing) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [editing]);

  useEffect(
    () => () => {
      if (commandAnimationTimeoutRef.current !== null) {
        window.clearTimeout(commandAnimationTimeoutRef.current);
      }
      if (commandLaunchTimeoutRef.current !== null) {
        window.clearTimeout(commandLaunchTimeoutRef.current);
      }
    },
    [],
  );

  const openLink = () => {
    if (!card.link) {
      return;
    }

    // Local file paths (Windows drive or UNC) open with the system file handler;
    // everything else is treated as a URL.
    const isLocalPath = /^[a-zA-Z]:[\\/]/.test(card.link) || /^\\\\[^\\]/.test(card.link);
    const command = isLocalPath ? "plugin:opener|open_path" : "plugin:opener|open_url";
    const args = isLocalPath ? { path: card.link } : { url: card.link };

    invoke(command, args).catch((error) => {
      console.error("Failed to open text card link", error);
    });
  };

  return (
    <article
      data-text-card-id={card.id}
      className={`absolute inline-flex cursor-grab select-none items-center overflow-hidden rounded-lg border border-l-[6px] bg-[color:var(--container-bg)] py-[7px] pl-[15px] pr-[17px] text-[17px] font-normal text-white active:cursor-grabbing ${
        dragging
          ? `z-30 cursor-grabbing opacity-95 ${
              dragPrimary
                ? `origin-top-left ${dragAtTrueSize ? "scale-100" : "scale-[1.035]"}`
                : "text-card-bundle-pickup"
            }`
          : `z-20 ${
              moving
                ? "transition-none"
                : settling
                  ? "transition-[top,left,width,transform,opacity,border-color] duration-[180ms] ease-in"
                  : "transition-[top,left,width,transform,box-shadow,opacity,border-color] duration-150 ease-out"
            }`
      } ${dragging ? "" : "scale-100"} ${entering ? "text-card-enter" : ""} ${
        deleting ? "text-card-exit pointer-events-none" : ""
      } ${pulsing ? "text-card-pulse" : ""} ${glowing ? "text-card-picked-glow" : ""} ${
        interactionDisabled ? "pointer-events-none" : ""
      } ${privacyHidden ? "select-none blur-[5px]" : ""} ${
        shadowsUnderElements
          ? ""
          : `canvas-attached-shadow-card ${dragging || moving ? "canvas-attached-drag-shadow" : ""}`
      } ${position?.width || position?.maxWidth ? "" : "max-w-[520px]"}`}
      style={
        {
          zIndex: dragging
            ? dragPrimary
              ? 10000
              : 9999 - Math.max(0, dragBundleIndex)
            : 20 + (card.layer ?? 0),
          left: position?.x ?? card.x,
          top: position?.y ?? card.y,
          width: position?.width,
          maxWidth: position?.maxWidth,
          borderColor: selectedAccent,
          backgroundColor: `color-mix(in srgb, var(--container-bg) 92%, ${accent})`,
          transform:
            dragging && !dragPrimary
              ? `translate(${dragSwayX * (0.18 + Math.min(dragBundleIndex, 5) * 0.04)}px, ${
                  Math.abs(dragSwayX) * 0.08 + dragSwayY * 0.12
                }px) rotate(${dragSwayX * (0.16 + Math.min(dragBundleIndex, 5) * 0.035)}deg) scale(${
                  dragAtTrueSize ? 1 : 0.99
                })`
              : undefined,
          "--bundle-pickup-x": `${dragPickupX}px`,
          "--bundle-pickup-y": `${dragPickupY}px`,
          "--bundle-rest-transform":
            dragging && !dragPrimary
              ? `translate(${dragSwayX * (0.18 + Math.min(dragBundleIndex, 5) * 0.04)}px, ${
                  Math.abs(dragSwayX) * 0.08 + dragSwayY * 0.12
                }px) rotate(${dragSwayX * (0.16 + Math.min(dragBundleIndex, 5) * 0.035)}deg) scale(${
                  dragAtTrueSize ? 1 : 0.99
                })`
              : "none",
        } as React.CSSProperties
      }
      onPointerDown={(event) => onStartMove(event, card)}
      onContextMenu={(event) => onOpenMenu(event, card)}
    >
      {checkboxInstalled && (
        <button
          type="button"
          className={`-my-[7px] -ml-[10px] mr-[3px] grid h-[32px] w-[30px] shrink-0 place-items-center rounded transition-colors ${
            checkboxChecked ? "text-emerald-400" : "text-transparent hover:text-white/18"
          }`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCheckbox(card.id);
          }}
          aria-pressed={checkboxChecked}
        >
          <span
            className={`grid h-[22px] w-[22px] place-items-center rounded border ${
              checkboxChecked ? "bg-white/18" : "bg-black/10"
            }`}
            style={{ borderColor: accent }}
          >
            <IconCheck size={16} stroke={2} />
          </span>
        </button>
      )}
      {commandRunnerInstalled && (
        <div className="-my-[7px] -ml-[10px] mr-[5px] flex h-[32px] shrink-0 items-center">
          <button
            type="button"
            className={`group grid h-[32px] w-[32px] place-items-center rounded text-white transition-[transform,background-color,box-shadow,color] duration-150 ease-out disabled:cursor-not-allowed disabled:text-white disabled:hover:bg-transparent ${
              running ? "hover:bg-red-500/20 hover:text-red-300" : "hover:bg-white/[0.10]"
            } ${commandPlayAnimating ? "command-runner-play-press" : ""}`}
            style={running ? undefined : { color: "#ffffff", opacity: 1 }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (running) {
                onStopCommands(card.id);
                return;
              }
              setCommandPlayAnimating(false);
              window.requestAnimationFrame(() => setCommandPlayAnimating(true));
              if (commandAnimationTimeoutRef.current !== null) {
                window.clearTimeout(commandAnimationTimeoutRef.current);
              }
              if (commandLaunchTimeoutRef.current !== null) {
                window.clearTimeout(commandLaunchTimeoutRef.current);
              }
              commandAnimationTimeoutRef.current = window.setTimeout(
                () => setCommandPlayAnimating(false),
                380,
              );
              commandLaunchTimeoutRef.current = window.setTimeout(
                () => onRunCommands(card.id),
                170,
              );
            }}
            disabled={!hasCommands && !running}
            aria-label={running ? "Stop commands" : "Run saved commands"}
            title={
              running ? "Stop commands" : hasCommands ? "Run saved commands" : "No saved commands"
            }
          >
            {running ? (
              <>
                <IconSettings
                  size={20.7}
                  stroke={2}
                  className="animate-spin group-hover:hidden"
                  style={{ animationDuration: "1.3s" }}
                />
                <IconPlayerStopFilled size={17} stroke={2} className="hidden group-hover:block" />
              </>
            ) : (
              <IconPlayerPlayFilled
                size={18.4}
                stroke={2}
                color="#ffffff"
                className="transition-transform duration-150 ease-out group-active:translate-x-[2px] group-active:scale-[0.88]"
              />
            )}
          </button>
        </div>
      )}
      {editing ? (
        <span className={`relative grid ${position?.width ? "w-full" : "max-w-[480px]"}`}>
          <span
            className="invisible col-start-1 row-start-1 min-w-[1ch] whitespace-pre"
            aria-hidden
          >
            {draft || " "}
          </span>
          <input
            ref={inputRef}
            className="absolute inset-y-0 left-0 m-0 w-[calc(100%+17px)] min-w-[calc(1ch+17px)] bg-transparent p-0 pr-[17px] text-white outline-none selection:bg-white/25"
            value={draft}
            spellCheck={false}
            onChange={(event) => onDraftChange(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onBlur={() => onSave(card.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSave(card.id);
              }

              if (event.key === "Escape") {
                onCancel();
              }
            }}
          />
        </span>
      ) : card.link ? (
        <button
          type="button"
          className={`inline-flex min-w-0 items-center gap-1.5 text-left transition-opacity hover:opacity-85 ${
            position?.width || position?.maxWidth ? "w-full" : "max-w-full"
          } ${linksDisabled ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{ color: linkedTextColor }}
          onPointerDown={(event) => {
            if (!linksDisabled) {
              event.stopPropagation();
            }
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (linksDisabled) {
              return;
            }

            openLink();
          }}
        >
          <span
            className={`min-w-0 ${checkedTextClass} ${
              position?.width || position?.maxWidth
                ? "block truncate"
                : "whitespace-pre-wrap break-words"
            }`}
          >
            {card.text}
          </span>
          <IconLink size={15} stroke={2} className="shrink-0 opacity-70" />
        </button>
      ) : (
        <span
          className={`min-w-0 ${checkedTextClass} ${
            position?.width || position?.maxWidth
              ? "block truncate"
              : "whitespace-pre-wrap break-words"
          }`}
        >
          {card.text}
        </span>
      )}
      <div
        className={`selection-overlay pointer-events-none z-10 rounded-[inherit] ${
          selected ? "selection-overlay-active" : ""
        }`}
        style={
          {
            "--selection-overlay-top": "-1px",
            "--selection-overlay-right": "-1px",
            "--selection-overlay-bottom": "-1px",
            "--selection-overlay-left": "-6px",
          } as React.CSSProperties
        }
      />
    </article>
  );
}

const areTextCardPropsEqual = (previous: TextCardNodeProps, next: TextCardNodeProps) => {
  const previousPosition = previous.position;
  const nextPosition = next.position;
  if (
    previousPosition?.x !== nextPosition?.x ||
    previousPosition?.y !== nextPosition?.y ||
    previousPosition?.width !== nextPosition?.width ||
    previousPosition?.maxWidth !== nextPosition?.maxWidth
  ) {
    return false;
  }

  const previousValues = previous as unknown as Record<string, unknown>;
  const nextValues = next as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(previousValues), ...Object.keys(nextValues)]);
  keys.delete("position");

  return Array.from(keys).every((key) => previousValues[key] === nextValues[key]);
};

export const TextCardNode = memo(TextCardNodeComponent, areTextCardPropsEqual);
