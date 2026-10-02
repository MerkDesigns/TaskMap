import { IconCheck, IconLink } from "@tabler/icons-react";
import { memo, useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import { getTextCardAccent } from "../../constants";
import { openExternalTarget } from "../../platform/opener/externalTargetClient";
import type { TextCardElement } from "../../types";
import "./textCard.css";

export interface TextCardRendererProps {
  readonly card: TextCardElement;
  readonly editing: boolean;
  readonly draft: string;
  /** Overrides the card's own position and size, e.g. inside a container or while dragged. */
  readonly position?: {
    readonly x: number;
    readonly y: number;
    readonly width?: number;
    readonly height?: number;
    readonly maxWidth?: number;
  };
  /** The mind-map node variant: wrapping text edited in a multiline editor. */
  readonly multiline?: boolean;
  readonly accentBar?: boolean;
  readonly overflowVisible?: boolean;
  readonly overlay?: ReactNode;
  readonly onSizeChange?: (id: string, size: { width: number; height: number }) => void;
  readonly entering?: boolean;
  readonly deleting?: boolean;
  readonly pulsing?: boolean;
  readonly dragging?: boolean;
  readonly dragAtTrueSize?: boolean;
  readonly dragPrimary?: boolean;
  readonly dragBundleIndex?: number;
  readonly dragPickupX?: number;
  readonly dragPickupY?: number;
  readonly dragSwayX?: number;
  readonly dragSwayY?: number;
  readonly moving?: boolean;
  readonly settling?: boolean;
  readonly selected?: boolean;
  readonly interactionDisabled?: boolean;
  readonly forceInteractive?: boolean;
  readonly linksDisabled?: boolean;
  readonly privacyHidden?: boolean;
  readonly shadowsUnderElements: boolean;
  readonly onDraftChange: (value: string) => void;
  readonly onSave: (id: string) => void;
  readonly onCancel: () => void;
  readonly onStartMove: (event: PointerEvent<HTMLElement>, card: TextCardElement) => void;
  readonly onOpenMenu: (event: MouseEvent<HTMLElement>, card: TextCardElement) => void;
  readonly onToggleCheckbox: (id: string) => void;
}

/** Linked text is the accent lifted towards white, so it reads as a link on the tinted card. */
function tintTowardWhite(hexColor: string, amount = 0.61) {
  const hex = hexColor.replace("#", "");
  const value = Number.parseInt(
    hex.length === 3 ? hex.replace(/./g, (character) => `${character}${character}`) : hex,
    16,
  );
  if (!Number.isFinite(value)) return "#ffffff";
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`;
}

/** Bundled cards sway behind the held card, further back cards a little more. */
function bundleRestTransform(
  swayX: number,
  swayY: number,
  bundleIndex: number,
  atTrueSize: boolean,
) {
  const depth = Math.min(bundleIndex, 5);
  return `translate(${swayX * (0.18 + depth * 0.04)}px, ${Math.abs(swayX) * 0.08 + swayY * 0.12}px) rotate(${
    swayX * (0.16 + depth * 0.035)
  }deg) scale(${atTrueSize ? 1 : 0.99})`;
}

const stopPointer = (event: PointerEvent<HTMLElement>) => event.stopPropagation();

function TextCardRendererComponent({
  card,
  editing,
  draft,
  position,
  multiline = false,
  accentBar = true,
  overflowVisible = false,
  overlay,
  onSizeChange,
  entering = false,
  deleting = false,
  pulsing = false,
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
  forceInteractive = false,
  linksDisabled = false,
  privacyHidden = false,
  shadowsUnderElements,
  onDraftChange,
  onSave,
  onCancel,
  onStartMove,
  onOpenMenu,
  onToggleCheckbox,
}: TextCardRendererProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const accent = getTextCardAccent(card.accent);
  const isMindMapNode = card.kind === "mindmap";
  const checkboxInstalled = !isMindMapNode && Boolean(card.extensions?.checkbox);
  const checkboxChecked = Boolean(card.extensions?.checkbox?.checked);
  const sized = Boolean(position?.width || position?.maxWidth);
  const bundled = dragging && !dragPrimary;
  const restTransform = bundled
    ? bundleRestTransform(dragSwayX, dragSwayY, dragBundleIndex, dragAtTrueSize)
    : "none";

  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => {
      const editor = multiline ? textareaRef.current : inputRef.current;
      editor?.focus();
      editor?.select();
    });
  }, [editing, multiline]);

  useEffect(() => {
    const node = articleRef.current;
    if (!node || !onSizeChange) return;
    const reportSize = () =>
      onSizeChange(card.id, { width: node.offsetWidth, height: node.offsetHeight });
    reportSize();
    const observer = new ResizeObserver(reportSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [card.id, onSizeChange]);

  const openLink = () => {
    if (isMindMapNode || !card.link) return;
    openExternalTarget(card.link).catch((error) => {
      console.error("Failed to open text card link", error);
    });
  };

  const editorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      if (multiline) event.preventDefault();
      onCancel();
      return;
    }
    // Multiline editing keeps Shift+Enter as a line break.
    if (event.key === "Enter" && !(multiline && event.shiftKey)) {
      if (multiline) event.preventDefault();
      onSave(card.id);
    }
  };

  const shadowClass = shadowsUnderElements
    ? ""
    : `canvas-attached-shadow-card${dragging || moving ? " canvas-attached-drag-shadow" : ""}`;

  return (
    <article
      ref={articleRef}
      data-text-card-id={card.id}
      className={`taskmap-text-card ${shadowClass}`.trim()}
      data-accent-bar={accentBar}
      data-sized={sized}
      data-fixed-width={Boolean(position?.width)}
      data-overflow={overflowVisible ? "visible" : undefined}
      data-drag={
        dragging
          ? dragPrimary
            ? dragAtTrueSize
              ? "primary-true-size"
              : "primary"
            : "bundle"
          : undefined
      }
      data-motion={dragging ? undefined : moving ? "moving" : settling ? "settling" : undefined}
      data-entering={entering || undefined}
      data-deleting={deleting || undefined}
      data-pulsing={pulsing || undefined}
      data-interaction={forceInteractive ? "forced" : interactionDisabled ? "disabled" : undefined}
      data-privacy-hidden={privacyHidden || undefined}
      data-selected={selected || undefined}
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
          height: position?.height,
          maxWidth: position?.maxWidth,
          borderColor: selected ? `color-mix(in srgb, ${accent} 72%, white 28%)` : accent,
          backgroundColor: `color-mix(in srgb, var(--container-bg) 92%, ${accent})`,
          transform: bundled ? restTransform : undefined,
          "--bundle-pickup-x": `${dragPickupX}px`,
          "--bundle-pickup-y": `${dragPickupY}px`,
          "--bundle-rest-transform": restTransform,
        } as CSSProperties
      }
      onPointerDown={(event) => onStartMove(event, card)}
      onContextMenu={(event) => onOpenMenu(event, card)}
    >
      {checkboxInstalled && (
        <button
          type="button"
          className="taskmap-text-card__checkbox"
          aria-pressed={checkboxChecked}
          onPointerDown={stopPointer}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCheckbox(card.id);
          }}
        >
          <span className="taskmap-text-card__checkbox-box" style={{ borderColor: accent }}>
            <IconCheck size={16} stroke={2} />
          </span>
        </button>
      )}
      {editing ? (
        <span className="taskmap-text-card__editor" data-multiline={multiline || undefined}>
          <span className="taskmap-text-card__editor-sizer" aria-hidden>
            {multiline ? (draft ? `${draft}\u200b` : " ") : draft || " "}
          </span>
          {multiline ? (
            <textarea
              ref={textareaRef}
              className="taskmap-text-card__editor-textarea"
              value={draft}
              spellCheck={false}
              onChange={(event) => onDraftChange(event.target.value)}
              onPointerDown={stopPointer}
              onClick={(event) => event.stopPropagation()}
              onBlur={() => onSave(card.id)}
              onKeyDown={editorKeyDown}
            />
          ) : (
            <input
              ref={inputRef}
              className="taskmap-text-card__editor-input"
              value={draft}
              spellCheck={false}
              onChange={(event) => onDraftChange(event.target.value)}
              onPointerDown={stopPointer}
              onClick={(event) => event.stopPropagation()}
              onBlur={() => onSave(card.id)}
              onKeyDown={editorKeyDown}
            />
          )}
        </span>
      ) : !isMindMapNode && card.link ? (
        <span className="taskmap-text-card__link" style={{ color: tintTowardWhite(accent) }}>
          <button
            type="button"
            className="taskmap-text-card__link-button"
            data-disabled={linksDisabled || undefined}
            onPointerDown={(event) => {
              if (!linksDisabled) event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (!linksDisabled) openLink();
            }}
          >
            <span className="taskmap-text-card__text" data-checked={checkboxChecked || undefined}>
              {card.text}
            </span>
          </button>
          <IconLink size={15} stroke={2} className="taskmap-text-card__link-icon" />
        </span>
      ) : (
        <span
          className="taskmap-text-card__text"
          data-multiline={multiline || undefined}
          data-checked={checkboxChecked || undefined}
        >
          {card.text}
        </span>
      )}
      <div
        className={`selection-overlay taskmap-text-card__selection${selected ? " selection-overlay-active" : ""}`}
        style={
          {
            "--selection-overlay-top": "-1px",
            "--selection-overlay-right": "-1px",
            "--selection-overlay-bottom": "-1px",
            "--selection-overlay-left": accentBar ? "-6px" : "-1px",
          } as CSSProperties
        }
      />
      {overlay}
    </article>
  );
}

/** Positions are recreated per render; compare them by value so moving siblings never re-render. */
const arePropsEqual = (previous: TextCardRendererProps, next: TextCardRendererProps) => {
  const a = previous.position;
  const b = next.position;
  if (
    a?.x !== b?.x ||
    a?.y !== b?.y ||
    a?.width !== b?.width ||
    a?.height !== b?.height ||
    a?.maxWidth !== b?.maxWidth
  ) {
    return false;
  }
  const previousValues = previous as unknown as Record<string, unknown>;
  const nextValues = next as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(previousValues), ...Object.keys(nextValues)]);
  keys.delete("position");
  return [...keys].every((key) => previousValues[key] === nextValues[key]);
};

export const TextCardRenderer = memo(TextCardRendererComponent, arePropsEqual);
