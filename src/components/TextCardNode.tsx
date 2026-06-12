import { invoke } from "@tauri-apps/api/core";
import { IconBold, IconItalic, IconLink, IconUnderline } from "@tabler/icons-react";
import { MouseEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getTextCardAccent } from "../constants";
import { FormatMarker, isTextFormatActive, renderFormattedText, toggleTextFormat } from "../textFormatting";
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
  dragging?: boolean;
  moving?: boolean;
  settling?: boolean;
  selected?: boolean;
  interactionDisabled?: boolean;
  linksDisabled?: boolean;
  privacyHidden?: boolean;
  onDraftChange: (value: string) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onStartMove: (event: PointerEvent<HTMLElement>, card: TextCardElement) => void;
  onOpenMenu: (event: MouseEvent<HTMLElement>, card: TextCardElement) => void;
};

function tintTowardWhite(hexColor: string, amount = 0.61) {
  const hex = hexColor.replace("#", "");
  const value = Number.parseInt(hex.length === 3 ? hex.replace(/./g, (char) => `${char}${char}`) : hex, 16);

  if (!Number.isFinite(value)) {
    return "#ffffff";
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);

  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`;
}

function getFormatButtonClass(active: boolean) {
  return `grid h-7 w-7 place-items-center rounded-md transition-colors ${
    active
      ? "bg-white/[0.16] text-white ring-1 ring-white/20"
      : "text-white/75 hover:bg-white/[0.10] hover:text-white"
  }`;
}

export function TextCardNode({
  card,
  editing,
  draft,
  position,
  entering = false,
  deleting = false,
  pulsing = false,
  dragging = false,
  moving = false,
  settling = false,
  selected = false,
  interactionDisabled = false,
  linksDisabled = false,
  privacyHidden = false,
  onDraftChange,
  onSave,
  onCancel,
  onStartMove,
  onOpenMenu,
}: TextCardNodeProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [formatMenu, setFormatMenu] = useState<{
    left: number;
    top: number;
    start: number;
    end: number;
  } | null>(null);
  const accent = getTextCardAccent(card.accent);
  const linkedTextColor = tintTowardWhite(accent);

  useEffect(() => {
    if (!editing) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [editing]);

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

  const updateFormatMenu = () => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if (start === end) {
      setFormatMenu(null);
      return;
    }

    const rect = input.getBoundingClientRect();
    const selectionCenter = ((start + end) / 2 / Math.max(input.value.length, 1)) * rect.width;
    setFormatMenu({
      left: rect.left + selectionCenter,
      top: rect.top - 38,
      start,
      end,
    });
  };

  const updateFormatMenuAfterSelection = () => {
    window.setTimeout(updateFormatMenu, 0);
  };

  const applyFormat = (marker: FormatMarker) => {
    if (!formatMenu) {
      return;
    }

    const formatted = toggleTextFormat(draft, formatMenu.start, formatMenu.end, marker);
    const nextDraft = formatted.text;
    const selectionStart = formatted.start;
    const selectionEnd = formatted.end;

    onDraftChange(nextDraft);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(selectionStart, selectionEnd);
      updateFormatMenu();
    });
  };

  const isFormatActive = (marker: FormatMarker) =>
    formatMenu ? isTextFormatActive(draft, formatMenu.start, formatMenu.end, marker) : false;

  return (
    <article
      className={`absolute inline-flex cursor-grab select-none items-center rounded-lg border border-l-[6px] bg-[color:var(--container-bg)] py-[7px] pl-[15px] pr-[17px] text-[17px] font-normal text-white active:cursor-grabbing ${
        dragging
          ? "z-30 scale-[1.035] cursor-grabbing opacity-95 shadow-[0_18px_34px_rgba(0,0,0,0.29),0_8px_14px_rgba(0,0,0,0.20)] transition-none"
          : `z-20 shadow-[0_6px_14px_rgba(0,0,0,0.22)] ${
              moving
                ? "transition-none"
                : settling
                  ? "transition-[top,left,width,transform,box-shadow,opacity] duration-100 ease-in"
                  : "transition-[top,left,width,transform,box-shadow,opacity] duration-150 ease-out"
            }`
      } ${dragging ? "" : "scale-100"} ${entering ? "text-card-enter" : ""} ${
        deleting ? "text-card-exit pointer-events-none" : ""
      } ${pulsing ? "text-card-pulse" : ""} ${
        interactionDisabled ? "pointer-events-none" : ""
      } ${privacyHidden ? "select-none blur-[5px]" : ""} ${position?.width || position?.maxWidth ? "" : "max-w-[520px]"}`}
      style={{
        left: position?.x ?? card.x,
        top: position?.y ?? card.y,
        width: position?.width,
        maxWidth: position?.maxWidth,
        borderColor: accent,
        backgroundColor: `color-mix(in srgb, var(--container-bg) 92%, ${accent})`,
        outline: selected ? "2px solid rgba(45, 216, 200, 0.78)" : undefined,
        outlineOffset: selected ? 4 : undefined,
      }}
      onPointerDown={(event) => onStartMove(event, card)}
      onContextMenu={(event) => onOpenMenu(event, card)}
    >
      {editing ? (
        <span className={`relative grid ${position?.width ? "w-full" : "max-w-[480px]"}`}>
          {formatMenu &&
            createPortal(
            <span
              className="fixed z-[1000] flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-white/[0.14] bg-[#1b1b1e] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.42)]"
              style={{ left: formatMenu.left, top: formatMenu.top }}
              onPointerDown={(event) => event.preventDefault()}
            >
              <button
                type="button"
                className={getFormatButtonClass(isFormatActive("**"))}
                aria-pressed={isFormatActive("**")}
                onClick={() => applyFormat("**")}
                title="Bold"
              >
                <IconBold size={20} stroke={2} />
              </button>
              <button
                type="button"
                className={getFormatButtonClass(isFormatActive("*"))}
                aria-pressed={isFormatActive("*")}
                onClick={() => applyFormat("*")}
                title="Italic"
              >
                <IconItalic size={20} stroke={2} />
              </button>
              <button
                type="button"
                className={getFormatButtonClass(isFormatActive("__"))}
                aria-pressed={isFormatActive("__")}
                onClick={() => applyFormat("__")}
                title="Underline"
              >
                <IconUnderline size={20} stroke={2} />
              </button>
            </span>,
              document.body,
            )}
          <span className="invisible col-start-1 row-start-1 min-w-[1ch] whitespace-pre" aria-hidden>
            {draft || " "}
          </span>
          <input
            ref={inputRef}
            className="absolute inset-y-0 left-0 m-0 w-[calc(100%+17px)] min-w-[calc(1ch+17px)] bg-transparent p-0 pr-[17px] text-white outline-none selection:bg-white/25"
            value={draft}
            spellCheck={false}
            onChange={(event) => onDraftChange(event.target.value)}
            onPointerDown={(event) => {
              event.stopPropagation();
              setFormatMenu(null);
            }}
            onPointerUp={updateFormatMenuAfterSelection}
            onClick={(event) => {
              event.stopPropagation();
              setFormatMenu(null);
            }}
            onBlur={() => {
              setFormatMenu(null);
              onSave(card.id);
            }}
            onKeyUp={updateFormatMenu}
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
            className={`min-w-0 ${
              position?.width || position?.maxWidth ? "block truncate" : "whitespace-pre-wrap break-words"
            }`}
          >
            {renderFormattedText(card.text)}
          </span>
          <IconLink size={15} stroke={2} className="shrink-0 opacity-70" />
        </button>
      ) : (
        <span
          className={`min-w-0 ${
            position?.width || position?.maxWidth ? "block truncate" : "whitespace-pre-wrap break-words"
          }`}
        >
          {renderFormattedText(card.text)}
        </span>
      )}
    </article>
  );
}
