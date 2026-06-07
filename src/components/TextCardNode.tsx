import { invoke } from "@tauri-apps/api/core";
import { IconLink } from "@tabler/icons-react";
import { MouseEvent, PointerEvent, useEffect, useRef } from "react";
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
  dragging?: boolean;
  settling?: boolean;
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

export function TextCardNode({
  card,
  editing,
  draft,
  position,
  entering = false,
  deleting = false,
  pulsing = false,
  dragging = false,
  settling = false,
  onDraftChange,
  onSave,
  onCancel,
  onStartMove,
  onOpenMenu,
}: TextCardNodeProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
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

    invoke("plugin:opener|open_url", { url: card.link }).catch((error) => {
      console.error("Failed to open text card link", error);
    });
  };

  return (
    <article
      className={`absolute inline-flex cursor-grab select-none items-center rounded-lg border border-l-[6px] bg-[color:var(--container-bg)] py-[7px] pl-[15px] pr-[17px] text-[17px] font-normal text-white active:cursor-grabbing ${
        dragging
          ? "z-30 scale-[1.035] cursor-grabbing opacity-95 shadow-[0_18px_34px_rgba(0,0,0,0.29),0_8px_14px_rgba(0,0,0,0.20)] transition-none"
          : `z-20 shadow-[0_6px_14px_rgba(0,0,0,0.22)] ${
              settling
                ? "transition-[top,left,width,transform,box-shadow,opacity] duration-100 ease-in"
                : "transition-[top,left,width,transform,box-shadow,opacity] duration-150 ease-out"
            }`
      } ${dragging ? "" : "scale-100"} ${entering ? "text-card-enter" : ""} ${
        deleting ? "text-card-exit pointer-events-none" : ""
      } ${pulsing ? "text-card-pulse" : ""} ${position?.width || position?.maxWidth ? "" : "max-w-[520px]"}`}
      style={{
        left: position?.x ?? card.x,
        top: position?.y ?? card.y,
        width: position?.width,
        maxWidth: position?.maxWidth,
        borderColor: accent,
      }}
      onPointerDown={(event) => onStartMove(event, card)}
      onContextMenu={(event) => onOpenMenu(event, card)}
    >
      {editing ? (
        <span className={`relative grid ${position?.width ? "w-full" : "max-w-[480px]"}`}>
          <span className="invisible col-start-1 row-start-1 min-w-[1ch] whitespace-pre" aria-hidden>
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
          }`}
          style={{ color: linkedTextColor }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            openLink();
          }}
        >
          <span
            className={`min-w-0 ${
              position?.width || position?.maxWidth ? "block truncate" : "whitespace-pre-wrap break-words"
            }`}
          >
            {card.text}
          </span>
          <IconLink size={15} stroke={2} className="shrink-0 opacity-70" />
        </button>
      ) : (
        <span
          className={`min-w-0 ${
            position?.width || position?.maxWidth ? "block truncate" : "whitespace-pre-wrap break-words"
          }`}
        >
          {card.text}
        </span>
      )}
    </article>
  );
}
