import { IconChevronLeft, IconChevronRight, IconPuzzle } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, RefObject, SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { ExtensionCommands } from "../extensions/extensionCommands";
import type {
  HeaderControl,
  HeaderControlContext,
  HeaderPanelAnchor,
} from "../extensions/headerControl";
import { headerControlsFor } from "../extensions/headerControlRegistry";
import type { RetainedExtensionKey } from "../extensions/retainedExtensionDefinition";
import { useHeaderExtensionLayout, type HeaderLayoutMetrics } from "./useHeaderExtensionLayout";

export interface ElementHeaderExtensionsInput {
  readonly context: HeaderControlContext;
  readonly commands: ExtensionCommands;
  readonly buttonsVisible: boolean;
  readonly onButtonsVisibleChange: (visible: boolean) => void;
  readonly name: string;
  readonly renaming: boolean;
  readonly metrics: HeaderLayoutMetrics;
  readonly rowRef: RefObject<HTMLElement | null>;
  readonly titleRef: RefObject<HTMLElement | null>;
  /** The element's article; the overflow popover renders into it, outside the frame's clip. */
  readonly article: HTMLElement | null;
  /** The element's canvas width, to place the popover in the article's camera-scaled space. */
  readonly width: number;
}

type Position = { left: number; top: number };

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

/**
 * The extension part of an element header: the installed extensions' controls (with a collapse
 * toggle and an overflow popover for those that do not fit) and their panels. `controls` goes in the
 * header's controls row; `popovers` must be rendered outside the header, so their presses never
 * reach its start-move handler.
 */
export function useElementHeaderExtensions({
  context,
  commands,
  buttonsVisible,
  onButtonsVisibleChange,
  name,
  renaming,
  metrics,
  rowRef,
  titleRef,
  article,
  width,
}: ElementHeaderExtensionsInput) {
  const controls = headerControlsFor(context);
  // The layout needs a stable item list; it changes only with the controls or their widths.
  const itemsKey = controls
    .map((control) => `${control.extension}:${control.width(context)}`)
    .join(" ");
  const items = useMemo(
    () =>
      itemsKey
        .split(" ")
        .filter(Boolean)
        .map((entry) => {
          const [key, itemWidth] = entry.split(":");
          return { key: key as RetainedExtensionKey, width: Number(itemWidth) };
        }),
    [itemsKey],
  );
  const { collapsible, visibleItems, visibleWidth, overflowItems } = useHeaderExtensionLayout(
    items,
    buttonsVisible,
    { name, renaming },
    metrics,
    rowRef,
    titleRef,
  );
  const hasOverflow = overflowItems.length > 0;
  const [overflowPosition, setOverflowPosition] = useState<Position | null>(null);
  const [openPanel, setOpenPanel] = useState<RetainedExtensionKey | null>(null);
  const [anchors, setAnchors] = useState<Partial<Record<RetainedExtensionKey, HeaderPanelAnchor>>>(
    {},
  );
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const closePanel = useCallback(() => setOpenPanel(null), []);

  useEffect(() => {
    if (!hasOverflow) setOverflowPosition(null);
  }, [hasOverflow]);

  // A panel closes with its extension's removal instead of reopening if it is installed again.
  const openPanelInstalled = openPanel !== null && itemsKey.includes(`${openPanel}:`);
  useEffect(() => {
    if (openPanel !== null && !openPanelInstalled) setOpenPanel(null);
  }, [openPanel, openPanelInstalled]);

  useEffect(() => {
    if (!overflowPosition) return;
    const closeOverflow = (event: globalThis.PointerEvent | globalThis.MouseEvent) => {
      if ("button" in event && event.button === 1) return;
      const target = event.target as Node;
      if (
        !overflowButtonRef.current?.contains(target) &&
        !overflowMenuRef.current?.contains(target)
      ) {
        setOverflowPosition(null);
      }
    };
    window.addEventListener("pointerdown", closeOverflow, true);
    window.addEventListener("contextmenu", closeOverflow, true);
    return () => {
      window.removeEventListener("pointerdown", closeOverflow, true);
      window.removeEventListener("contextmenu", closeOverflow, true);
    };
  }, [overflowPosition]);

  const toggleOverflow = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (overflowPosition) {
      setOverflowPosition(null);
      return;
    }
    if (!article) return;
    // The popover is positioned in the article's own (camera-scaled) coordinates.
    const articleRect = article.getBoundingClientRect();
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const scale = articleRect.width / Math.max(width, 1) || 1;
    setOverflowPosition({
      left: (buttonRect.left + buttonRect.width / 2 - articleRect.left) / scale,
      top: (buttonRect.top - articleRect.top) / scale - 10,
    });
  };

  const byKey = new Map(controls.map((control) => [control.extension, control]));
  const renderControl = (key: string) => {
    const control = byKey.get(key as RetainedExtensionKey);
    if (!control) return null;
    const { Control, extension } = control;
    return (
      <Control
        key={extension}
        context={context}
        commands={commands}
        panelOpen={openPanel === extension}
        togglePanel={(element) => {
          setOverflowPosition(null);
          if (openPanel === extension) {
            setOpenPanel(null);
            return;
          }
          setAnchors((current) => ({
            ...current,
            [extension]: { rect: element.getBoundingClientRect(), element },
          }));
          setOpenPanel(extension);
        }}
      />
    );
  };

  const controlsNode = (
    <>
      {collapsible && (
        <button
          className="taskmap-element-header__button"
          data-kind="collapse"
          onClick={(event) => {
            event.stopPropagation();
            onButtonsVisibleChange(!buttonsVisible);
          }}
          onPointerDown={stopPropagation}
          title={buttonsVisible ? "Hide extension buttons" : "Show extension buttons"}
        >
          {buttonsVisible ? (
            <IconChevronRight size={18} stroke={2} />
          ) : (
            <IconChevronLeft size={18} stroke={2} />
          )}
        </button>
      )}
      <div
        className="taskmap-element-header__extensions"
        data-collapsed={(collapsible && !buttonsVisible) || undefined}
        style={{ maxWidth: !collapsible || buttonsVisible ? visibleWidth : 0 }}
      >
        {visibleItems.map((item) => renderControl(item.key))}
      </div>
      {hasOverflow && (
        <button
          ref={overflowButtonRef}
          className="taskmap-element-header__button"
          data-kind="overflow"
          onClick={toggleOverflow}
          onPointerDown={stopPropagation}
          title="More extensions"
        >
          <IconPuzzle size={18} stroke={2} />
        </button>
      )}
    </>
  );

  const popoversNode = (
    <>
      {overflowPosition &&
        article &&
        createPortal(
          <div
            ref={overflowMenuRef}
            className="taskmap-element-header__overflow"
            style={{ left: overflowPosition.left, top: overflowPosition.top }}
            onPointerDown={stopPropagation}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="taskmap-element-header__overflow-arrow" />
            <span className="taskmap-element-header__overflow-items">
              {overflowItems.map((item) => renderControl(item.key))}
            </span>
          </div>,
          article,
        )}
      {controls.map(({ extension, Panel }: HeaderControl) =>
        Panel ? (
          <Panel
            key={extension}
            context={context}
            commands={commands}
            open={openPanel === extension}
            anchor={anchors[extension] ?? null}
            close={closePanel}
          />
        ) : null,
      )}
    </>
  );

  return { controls: controlsNode, popovers: popoversNode };
}
