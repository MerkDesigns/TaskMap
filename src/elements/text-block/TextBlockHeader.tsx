import {
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconNotes,
  IconPalette,
  IconPuzzle,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { ColorPickerMenu } from "../../components/ColorPickerMenu";
import {
  useHeaderExtensionLayout,
  type HeaderExtensionItem,
  type HeaderLayoutMetrics,
} from "../useHeaderExtensionLayout";
import type { TextBlockDocumentElement } from "./textBlockModel";
import type { TextBlockActions, TextBlockViewState } from "./textBlockView";

type HeaderExtension = "lock" | "privacy" | "colorPicker";

const BUTTON_WIDTH = 36;

const TEXT_BLOCK_HEADER_METRICS: HeaderLayoutMetrics = {
  horizontalPadding: 24,
  minimumTitleReserve: 56,
  titleShare: 0.38,
  spacing: 10,
};

export interface TextBlockHeaderProps {
  readonly element: TextBlockDocumentElement;
  readonly view: TextBlockViewState;
  readonly actions: TextBlockActions;
  /** The text block's article; the overflow popover renders into it, outside the frame's clip. */
  readonly article: HTMLElement | null;
}

type Position = { left: number; top: number };

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function TextBlockHeader({ element, view, actions, article }: TextBlockHeaderProps) {
  const { id, data } = element;
  const { geometry } = view;
  const { extensions, renaming, renameDraft } = view;
  const privacyEnabled = Boolean(extensions?.privacy?.enabled);
  const lockEnabled = Boolean(extensions?.lock?.enabled);
  const buttonsVisible = data.headerButtonsVisible;
  const items = useMemo(() => {
    const installed: HeaderExtensionItem<HeaderExtension>[] = [];
    if (extensions?.lock) installed.push({ key: "lock", width: BUTTON_WIDTH });
    if (extensions?.privacy) installed.push({ key: "privacy", width: BUTTON_WIDTH });
    if (extensions?.colorPicker) installed.push({ key: "colorPicker", width: BUTTON_WIDTH });
    return installed;
  }, [extensions?.lock, extensions?.privacy, extensions?.colorPicker]);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const { collapsible, visibleItems, visibleWidth, overflowItems } = useHeaderExtensionLayout(
    items,
    buttonsVisible,
    { name: data.name, renaming },
    TEXT_BLOCK_HEADER_METRICS,
    headerRef,
    titleRef,
  );
  const hasOverflow = overflowItems.length > 0;
  const [overflowPosition, setOverflowPosition] = useState<Position | null>(null);
  const [colorMenuPosition, setColorMenuPosition] = useState<Position | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasOverflow) setOverflowPosition(null);
  }, [hasOverflow]);

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
    const scale = articleRect.width / Math.max(geometry.width, 1) || 1;
    setOverflowPosition({
      left: (buttonRect.left + buttonRect.width / 2 - articleRect.left) / scale,
      top: (buttonRect.top - articleRect.top) / scale - 10,
    });
  };

  const renderExtension = (key: HeaderExtension) => {
    switch (key) {
      case "lock":
        return (
          <button
            key={key}
            className="taskmap-element-header__button"
            onClick={(event) => {
              event.stopPropagation();
              actions.onToggleLock(id);
            }}
            onPointerDown={stopPropagation}
            title={lockEnabled ? "Unlock" : "Lock"}
          >
            {lockEnabled ? (
              <IconLock size={18} stroke={2} />
            ) : (
              <IconLockOpen size={18} stroke={2} />
            )}
          </button>
        );
      case "privacy":
        return (
          <button
            key={key}
            className="taskmap-element-header__button"
            onClick={(event) => {
              event.stopPropagation();
              actions.onTogglePrivacy(id);
            }}
            onPointerDown={stopPropagation}
            title={privacyEnabled ? "Show content" : "Hide content"}
          >
            {privacyEnabled ? (
              <IconEyeOff size={18} stroke={2} />
            ) : (
              <IconEye size={18} stroke={2} />
            )}
          </button>
        );
      case "colorPicker":
        return (
          <button
            key={key}
            className="taskmap-element-header__button"
            onClick={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              setColorMenuPosition((current) =>
                current ? null : { left: rect.right + 8, top: rect.top },
              );
              setOverflowPosition(null);
            }}
            onPointerDown={stopPropagation}
            title="Open color picker"
          >
            <IconPalette size={18} stroke={2} />
          </button>
        );
    }
  };

  // The popovers are siblings of the header, so their events never reach its start-move handler.
  return (
    <>
      <div
        ref={headerRef}
        className="taskmap-text-block__header"
        style={{ backgroundColor: data.accent }}
        onPointerDown={(event) => actions.onStartMove(event, id)}
      >
        <div ref={titleRef} className="taskmap-text-block__title">
          <IconNotes size={18} stroke={2} />
          {renaming ? (
            <input
              data-container-rename-input
              className="taskmap-element-header__rename taskmap-text-block__rename"
              value={renameDraft}
              autoFocus
              spellCheck={false}
              onChange={(event) => actions.onRenameDraftChange(event.target.value)}
              onFocus={(event) => event.target.select()}
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
              onBlur={() => actions.onSaveRename(id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") actions.onSaveRename(id);
                if (event.key === "Escape") actions.onCancelRename();
              }}
            />
          ) : (
            <span className="taskmap-element-header__name taskmap-text-block__name">
              {data.name}
            </span>
          )}
        </div>
        <div className="taskmap-element-header__controls">
          {collapsible && (
            <button
              className="taskmap-element-header__button"
              data-kind="collapse"
              onClick={(event) => {
                event.stopPropagation();
                actions.onHeaderButtonsVisibleChange(id, !buttonsVisible);
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
            {visibleItems.map((item) => renderExtension(item.key))}
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
          <button
            className="taskmap-element-header__button"
            data-kind="menu"
            onClick={(event) => actions.onToggleMenu(event, id)}
            onPointerDown={stopPropagation}
            title="Text block menu"
          >
            <IconDotsVertical size={18} stroke={2} />
          </button>
        </div>
      </div>

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
              {overflowItems.map((item) => renderExtension(item.key))}
            </span>
          </div>,
          article,
        )}
      {colorMenuPosition && (
        <ColorPickerMenu
          color={data.accent}
          left={colorMenuPosition.left}
          top={colorMenuPosition.top}
          recentColors={[...view.recentColors]}
          onChange={(accent) => actions.onUpdateAccent(id, accent)}
          onClose={(recentColor) => {
            actions.onRememberRecentColor(recentColor);
            setColorMenuPosition(null);
          }}
        />
      )}
    </>
  );
}
