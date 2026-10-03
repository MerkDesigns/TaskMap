import { IconLink } from "@tabler/icons-react";
import { memo, useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { getTextCardAccent } from "../../constants";
import { cardAdornmentsFor } from "../../extensions/cardAdornmentRegistry";
import type { ExtensionCommands } from "../../extensions/extensionCommands";
import { openExternalTarget } from "../../platform/opener/externalTargetClient";
import type { ElementExtensions } from "../../types";
import type { MindMapNodeDocumentElement } from "../mind-map/mindMapModel";
import type { TextCardDocumentElement } from "./textCardModel";
import "./textCard.css";

/** Text cards and mind-map nodes share this renderer; mind-map nodes wrap and edit multiline. */
export type TextCardRendererElement = TextCardDocumentElement | MindMapNodeDocumentElement;

export interface TextCardDrag {
  /** The card under the pointer; the others form the bundle behind it. */
  readonly primary: boolean;
  readonly atTrueSize: boolean;
  readonly bundleIndex: number;
  readonly pickupX: number;
  readonly pickupY: number;
  readonly swayX: number;
  readonly swayY: number;
}

/** Transient presentation state; everything persistent is read from the element. */
export interface TextCardViewState {
  readonly layer: number;
  /** Installed extensions, from the retained extension projection; they contribute adornments. */
  readonly extensions: ElementExtensions | undefined;
  /** Overrides the element's position and size, e.g. inside a container or while dragged. */
  readonly position?: {
    readonly x: number;
    readonly y: number;
    readonly width?: number;
    readonly height?: number;
    readonly maxWidth?: number;
  };
  readonly editing: boolean;
  readonly draft: string;
  readonly selected?: boolean;
  readonly entering?: boolean;
  readonly deleting?: boolean;
  readonly pulsing?: boolean;
  readonly drag?: TextCardDrag;
  readonly motion?: "moving" | "settling";
  /** "forced" keeps the card interactive inside the pointer-transparent release layer. */
  readonly interaction?: "forced" | "disabled";
  readonly linksDisabled?: boolean;
  readonly privacyHidden?: boolean;
  readonly shadowsUnderElements: boolean;
}

export interface TextCardActions {
  readonly onDraftChange: (value: string) => void;
  readonly onSave: (id: string) => void;
  readonly onCancel: () => void;
  readonly onStartMove: (event: PointerEvent<HTMLElement>, id: string) => void;
  readonly onOpenMenu: (event: MouseEvent<HTMLElement>, id: string) => void;
  readonly onSizeChange: (id: string, size: { width: number; height: number }) => void;
}

export interface TextCardRendererProps {
  readonly element: TextCardRendererElement;
  readonly view: TextCardViewState;
  /** Must be referentially stable; a new object re-renders every card. */
  readonly actions: TextCardActions;
  /** Commands for the installed extensions' adornments; referentially stable. */
  readonly extensionCommands: ExtensionCommands;
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
  element,
  view,
  actions,
  extensionCommands,
}: TextCardRendererProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const { id, geometry, data } = element;
  const { position, editing, draft, drag, selected = false, linksDisabled = false } = view;
  const isMindMapNode = element.type === "mind-map-node";
  const link = element.type === "text-card" ? element.data.link : null;
  const accent = getTextCardAccent(data.accent);
  // Mind-map nodes share this renderer but take no text-card extensions.
  const adornmentContext = { elementId: id, accent, extensions: view.extensions ?? {} };
  const adornments = isMindMapNode ? [] : cardAdornmentsFor(adornmentContext);
  const textState = adornments
    .map((adornment) => adornment.textState?.(adornmentContext))
    .find(Boolean);
  const sized = Boolean(position?.width || position?.maxWidth);
  const bundled = drag !== undefined && !drag.primary;
  const restTransform = bundled
    ? bundleRestTransform(drag.swayX, drag.swayY, drag.bundleIndex, drag.atTrueSize)
    : "none";
  const { onSizeChange } = actions;

  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => {
      const editor = isMindMapNode ? textareaRef.current : inputRef.current;
      editor?.focus();
      editor?.select();
    });
  }, [editing, isMindMapNode]);

  useEffect(() => {
    const node = articleRef.current;
    if (!node) return;
    const reportSize = () =>
      onSizeChange(id, { width: node.offsetWidth, height: node.offsetHeight });
    reportSize();
    const observer = new ResizeObserver(reportSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, onSizeChange]);

  const openLink = () => {
    if (!link) return;
    openExternalTarget(link).catch((error) => {
      console.error("Failed to open text card link", error);
    });
  };

  const editorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      if (isMindMapNode) event.preventDefault();
      actions.onCancel();
      return;
    }
    // Multiline editing keeps Shift+Enter as a line break.
    if (event.key === "Enter" && !(isMindMapNode && event.shiftKey)) {
      if (isMindMapNode) event.preventDefault();
      actions.onSave(id);
    }
  };

  const shadowClass = view.shadowsUnderElements
    ? ""
    : `canvas-attached-shadow-card${drag || view.motion === "moving" ? " canvas-attached-drag-shadow" : ""}`;

  return (
    <article
      ref={articleRef}
      data-text-card-id={id}
      className={`taskmap-text-card ${shadowClass}`.trim()}
      data-accent-bar={!isMindMapNode}
      data-sized={sized}
      data-fixed-width={Boolean(position?.width)}
      data-overflow={isMindMapNode ? "visible" : undefined}
      data-drag={
        drag
          ? drag.primary
            ? drag.atTrueSize
              ? "primary-true-size"
              : "primary"
            : "bundle"
          : undefined
      }
      data-motion={drag ? undefined : view.motion}
      data-entering={view.entering || undefined}
      data-deleting={view.deleting || undefined}
      data-pulsing={view.pulsing || undefined}
      data-interaction={view.interaction}
      data-privacy-hidden={view.privacyHidden || undefined}
      data-selected={selected || undefined}
      style={
        {
          zIndex: drag
            ? drag.primary
              ? 10000
              : 9999 - Math.max(0, drag.bundleIndex)
            : 20 + view.layer,
          left: position?.x ?? geometry.x,
          top: position?.y ?? geometry.y,
          width: position?.width,
          height: position?.height,
          maxWidth: position?.maxWidth,
          borderColor: selected ? `color-mix(in srgb, ${accent} 72%, white 28%)` : accent,
          backgroundColor: `color-mix(in srgb, var(--container-bg) 92%, ${accent})`,
          transform: bundled ? restTransform : undefined,
          "--bundle-pickup-x": `${drag?.pickupX ?? 0}px`,
          "--bundle-pickup-y": `${drag?.pickupY ?? 0}px`,
          "--bundle-rest-transform": restTransform,
        } as CSSProperties
      }
      onPointerDown={(event) => actions.onStartMove(event, id)}
      onContextMenu={(event) => actions.onOpenMenu(event, id)}
    >
      {adornments.map(({ extension, Leading }) => (
        <Leading key={extension} context={adornmentContext} commands={extensionCommands} />
      ))}
      {editing ? (
        <span className="taskmap-text-card__editor" data-multiline={isMindMapNode || undefined}>
          <span className="taskmap-text-card__editor-sizer" aria-hidden>
            {isMindMapNode ? (draft ? `${draft}\u200b` : " ") : draft || " "}
          </span>
          {isMindMapNode ? (
            <textarea
              ref={textareaRef}
              className="taskmap-text-card__editor-textarea"
              value={draft}
              spellCheck={false}
              onChange={(event) => actions.onDraftChange(event.target.value)}
              onPointerDown={stopPointer}
              onClick={(event) => event.stopPropagation()}
              onBlur={() => actions.onSave(id)}
              onKeyDown={editorKeyDown}
            />
          ) : (
            <input
              ref={inputRef}
              className="taskmap-text-card__editor-input"
              value={draft}
              spellCheck={false}
              onChange={(event) => actions.onDraftChange(event.target.value)}
              onPointerDown={stopPointer}
              onClick={(event) => event.stopPropagation()}
              onBlur={() => actions.onSave(id)}
              onKeyDown={editorKeyDown}
            />
          )}
        </span>
      ) : link ? (
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
            <span className="taskmap-text-card__text" data-text-state={textState}>
              {data.text}
            </span>
          </button>
          <IconLink size={15} stroke={2} className="taskmap-text-card__link-icon" />
        </span>
      ) : (
        <span
          className="taskmap-text-card__text"
          data-multiline={isMindMapNode || undefined}
          data-text-state={textState}
        >
          {data.text}
        </span>
      )}
      <div
        className={`selection-overlay taskmap-text-card__selection${selected ? " selection-overlay-active" : ""}`}
        style={
          {
            "--selection-overlay-top": "-1px",
            "--selection-overlay-right": "-1px",
            "--selection-overlay-bottom": "-1px",
            "--selection-overlay-left": isMindMapNode ? "-1px" : "-6px",
          } as CSSProperties
        }
      />
    </article>
  );
}

/** Callers rebuild the view state each render; compare it by value so idle cards never re-render. */
const shallowEqual = (a: object | undefined, b: object | undefined) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
};

const arePropsEqual = (previous: TextCardRendererProps, next: TextCardRendererProps) => {
  if (
    previous.element !== next.element ||
    previous.actions !== next.actions ||
    previous.extensionCommands !== next.extensionCommands
  ) {
    return false;
  }
  const { position: previousPosition, drag: previousDrag, ...previousView } = previous.view;
  const { position: nextPosition, drag: nextDrag, ...nextView } = next.view;
  return (
    shallowEqual(previousView, nextView) &&
    shallowEqual(previousPosition, nextPosition) &&
    shallowEqual(previousDrag, nextDrag)
  );
};

export const TextCardRenderer = memo(TextCardRendererComponent, arePropsEqual);
