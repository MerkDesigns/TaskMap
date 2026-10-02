import {
  IconBox,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardCopy,
  IconClipboardText,
  IconDotsVertical,
  IconEdit,
  IconPuzzle,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { ColorPickerMenu } from "../../components/ColorPickerMenu";
import type { ContainerElement } from "../../types";
import { ContextMenu } from "../../ui/primitives/ContextMenu";
import { ContextMenuDivider, ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import { useClampedFixedPosition } from "../../useClampedFixedPosition";
import {
  ContainerExtensionButton,
  useHeaderExtensionLayout,
  type HeaderExtension,
} from "./ContainerExtensionButtons";

export interface ContainerHeaderProps {
  readonly element: ContainerElement;
  /** The container's article; the overflow popover renders into it, outside the frame's clip. */
  readonly article: HTMLElement | null;
  readonly cardCount: number;
  readonly recentColors: string[];
  readonly renaming: boolean;
  readonly renameDraft: string;
  readonly onRenameDraftChange: (value: string) => void;
  readonly onSaveRename: (id: string) => void;
  readonly onCancelRename: () => void;
  readonly onStartMove: (event: PointerEvent<HTMLElement>, element: ContainerElement) => void;
  readonly onToggleMenu: (event: MouseEvent<HTMLButtonElement>, element: ContainerElement) => void;
  readonly onTogglePrivacy: (id: string) => void;
  readonly onToggleLock: (id: string) => void;
  readonly onUpdateAccent: (id: string, accent: string) => void;
  readonly onRememberRecentColor: (color?: string) => void;
  readonly onCopyJsonForAi: (id: string) => Promise<void>;
  readonly onPasteJsonFromAi: (id: string) => Promise<void>;
  readonly onOpenJsonEditor: (id: string) => void;
  readonly onHeaderButtonsVisibleChange: (id: string, visible: boolean) => void;
  readonly onSearchChange: (id: string, query: string) => void;
}

type Position = { left: number; top: number };

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function ContainerHeader({
  element,
  article,
  cardCount,
  recentColors,
  renaming,
  renameDraft,
  onRenameDraftChange,
  onSaveRename,
  onCancelRename,
  onStartMove,
  onToggleMenu,
  onTogglePrivacy,
  onToggleLock,
  onUpdateAccent,
  onRememberRecentColor,
  onCopyJsonForAi,
  onPasteJsonFromAi,
  onOpenJsonEditor,
  onHeaderButtonsVisibleChange,
  onSearchChange,
}: ContainerHeaderProps) {
  const searchInstalled = Boolean(element.extensions?.search);
  const searchQuery = element.extensions?.search?.query ?? "";
  const copyPasteJsonInstalled = Boolean(element.extensions?.copyPasteJson);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const { collapsible, buttonsVisible, visibleItems, visibleWidth, overflowItems } =
    useHeaderExtensionLayout(element, cardCount, renaming, rowRef, titleRef);
  const hasOverflow = overflowItems.length > 0;
  const [overflowPosition, setOverflowPosition] = useState<Position | null>(null);
  const [colorMenuPosition, setColorMenuPosition] = useState<Position | null>(null);
  const [jsonMenuPosition, setJsonMenuPosition] = useState<Position | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const jsonButtonRef = useRef<HTMLButtonElement | null>(null);
  const jsonMenuRef = useRef<HTMLElement | null>(null);
  // Keeps the last anchor through the shared menu's exit animation.
  const jsonAnchorRef = useRef<Position>({ left: 0, top: 0 });
  if (jsonMenuPosition) jsonAnchorRef.current = jsonMenuPosition;
  const jsonPosition = useClampedFixedPosition(jsonMenuRef, jsonAnchorRef.current);

  useEffect(() => {
    if (!hasOverflow) setOverflowPosition(null);
  }, [hasOverflow]);

  useEffect(() => {
    if (!copyPasteJsonInstalled) setJsonMenuPosition(null);
  }, [copyPasteJsonInstalled]);

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

  useEffect(() => {
    if (!jsonMenuPosition) return;
    // The shared menu handles outside presses and Escape; the container can move away on resize or
    // scroll, so close then.
    const close = () => setJsonMenuPosition(null);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [jsonMenuPosition]);

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
    const scale = articleRect.width / Math.max(element.width, 1) || 1;
    setOverflowPosition({
      left: (buttonRect.left + buttonRect.width / 2 - articleRect.left) / scale,
      top: (buttonRect.top - articleRect.top) / scale - 10,
    });
  };

  const toggleColorPicker = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setColorMenuPosition((current) => (current ? null : { left: rect.right + 8, top: rect.top }));
    setOverflowPosition(null);
  };

  const toggleJsonMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (jsonMenuPosition) {
      setJsonMenuPosition(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setJsonMenuPosition({ left: rect.right + 6, top: rect.top });
    setOverflowPosition(null);
  };

  const closeJsonMenuAnd = (action: () => void) => () => {
    setJsonMenuPosition(null);
    action();
  };

  const renderExtension = (extension: HeaderExtension) => (
    <ContainerExtensionButton
      key={extension}
      extension={extension}
      element={element}
      cardCount={cardCount}
      jsonMenuOpen={jsonMenuPosition !== null}
      jsonButtonRef={jsonButtonRef}
      onToggleLock={onToggleLock}
      onTogglePrivacy={onTogglePrivacy}
      onToggleColorPicker={toggleColorPicker}
      onToggleJsonMenu={toggleJsonMenu}
    />
  );

  // The popovers are siblings of the header, so their events never reach its start-move handler.
  return (
    <>
      <div
        className="taskmap-container__header"
        style={{ backgroundColor: element.accent }}
        onPointerDown={(event) => onStartMove(event, element)}
      >
        <div ref={rowRef} className="taskmap-container__header-row">
          <div ref={titleRef} className="taskmap-container__title">
            <span className="taskmap-container__icon">
              <IconBox size={19} stroke={2} />
            </span>
            {renaming ? (
              <input
                data-container-rename-input
                className="taskmap-container__rename"
                value={renameDraft}
                autoFocus
                spellCheck={false}
                onChange={(event) => onRenameDraftChange(event.target.value)}
                onFocus={(event) => event.target.select()}
                onPointerDown={stopPropagation}
                onClick={stopPropagation}
                onBlur={() => onSaveRename(element.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSaveRename(element.id);
                  if (event.key === "Escape") onCancelRename();
                }}
              />
            ) : (
              <span className="taskmap-container__name">{element.name}</span>
            )}
          </div>
          <div className="taskmap-container__controls">
            {collapsible && (
              <button
                className="taskmap-container__button"
                data-kind="collapse"
                onClick={(event) => {
                  event.stopPropagation();
                  onHeaderButtonsVisibleChange(element.id, !buttonsVisible);
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
              className="taskmap-container__extensions"
              data-collapsed={(collapsible && !buttonsVisible) || undefined}
              style={{ maxWidth: !collapsible || buttonsVisible ? visibleWidth : 0 }}
            >
              {visibleItems.map((item) => renderExtension(item.key))}
            </div>
            {hasOverflow && (
              <button
                ref={overflowButtonRef}
                className="taskmap-container__button"
                data-kind="overflow"
                onClick={toggleOverflow}
                onPointerDown={stopPropagation}
                title="More extensions"
              >
                <IconPuzzle size={18} stroke={2} />
              </button>
            )}
            <button
              className="taskmap-container__button"
              data-kind="menu"
              onClick={(event) => onToggleMenu(event, element)}
              onPointerDown={stopPropagation}
              title="Container menu"
            >
              <IconDotsVertical size={18} stroke={2} />
            </button>
          </div>
        </div>

        {searchInstalled && (
          <div
            className="taskmap-container__search-row"
            onPointerDown={stopPropagation}
            onClick={stopPropagation}
          >
            <div className="taskmap-container__search">
              <IconSearch size={16} stroke={2} />
              <input
                className="taskmap-container__search-input"
                value={searchQuery}
                spellCheck={false}
                placeholder="Search"
                onChange={(event) => onSearchChange(element.id, event.target.value)}
              />
              {searchQuery && (
                <button
                  className="taskmap-container__search-clear"
                  onClick={() => onSearchChange(element.id, "")}
                  title="Clear search"
                >
                  <IconX size={15} stroke={2} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {overflowPosition &&
        article &&
        createPortal(
          <div
            ref={overflowMenuRef}
            className="taskmap-container__overflow"
            style={{ left: overflowPosition.left, top: overflowPosition.top }}
            onPointerDown={stopPropagation}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="taskmap-container__overflow-arrow" />
            <span className="taskmap-container__overflow-items">
              {overflowItems.map((item) => renderExtension(item.key))}
            </span>
          </div>,
          article,
        )}
      <ContextMenu
        ref={jsonMenuRef}
        portal
        label="Copy/Paste JSON"
        open={jsonMenuPosition !== null}
        onOpenChange={(open) => {
          if (!open) setJsonMenuPosition(null);
        }}
        position={jsonPosition}
        returnFocusRef={jsonButtonRef}
      >
        <ContextMenuItem
          icon={<IconClipboardCopy size={17} stroke={2} />}
          onClick={closeJsonMenuAnd(() => void onCopyJsonForAi(element.id))}
        >
          Copy JSON for AI
        </ContextMenuItem>
        <ContextMenuDivider />
        <ContextMenuItem
          icon={<IconClipboardText size={17} stroke={2} />}
          onClick={closeJsonMenuAnd(() => void onPasteJsonFromAi(element.id))}
        >
          Paste JSON from AI
        </ContextMenuItem>
        <ContextMenuDivider />
        <ContextMenuItem
          icon={<IconEdit size={17} stroke={2} />}
          onClick={closeJsonMenuAnd(() => onOpenJsonEditor(element.id))}
        >
          Open JSON editor
        </ContextMenuItem>
      </ContextMenu>
      {colorMenuPosition && (
        <ColorPickerMenu
          color={element.accent}
          left={colorMenuPosition.left}
          top={colorMenuPosition.top}
          recentColors={recentColors}
          onChange={(accent) => onUpdateAccent(element.id, accent)}
          onClose={(recentColor) => {
            onRememberRecentColor(recentColor);
            setColorMenuPosition(null);
          }}
        />
      )}
    </>
  );
}
