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
  dragging?: boolean;
  onDraftChange: (value: string) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onStartMove: (event: PointerEvent<HTMLElement>, card: TextCardElement) => void;
  onOpenMenu: (event: MouseEvent<HTMLElement>, card: TextCardElement) => void;
};

export function TextCardNode({
  card,
  editing,
  draft,
  position,
  dragging = false,
  onDraftChange,
  onSave,
  onCancel,
  onStartMove,
  onOpenMenu,
}: TextCardNodeProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const accent = getTextCardAccent(card.accent);

  useEffect(() => {
    if (!editing) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [editing]);

  return (
    <article
      className={`absolute inline-flex cursor-grab select-none items-center rounded-lg border border-l-[6px] bg-[color:var(--container-bg)] py-[7px] pl-[15px] pr-[17px] text-[17px] font-normal text-white shadow-[0_6px_14px_rgba(0,0,0,0.22)] transition-[top,left,width] duration-150 active:cursor-grabbing ${
        dragging ? "z-30 cursor-grabbing opacity-95 transition-none" : "z-20"
      } ${position?.width || position?.maxWidth ? "" : "max-w-[520px]"}`}
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
      ) : (
        <span className={`min-w-0 ${position?.width || position?.maxWidth ? "block truncate" : "whitespace-pre-wrap break-words"}`}>
          {card.text}
        </span>
      )}
    </article>
  );
}
