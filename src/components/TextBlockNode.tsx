import {
  IconArrowDownRight,
  IconChevronLeft,
  IconChevronRight,
  IconPalette,
  IconDotsVertical,
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconNotes,
  IconPuzzle,
} from "@tabler/icons-react";
import {
  MouseEvent,
  PointerEvent,
  Suspense,
  WheelEvent,
  lazy,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TextBlockElement } from "../types";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import { ColorPickerMenu } from "./ColorPickerMenu";

const MarkdownContent = lazy(() =>
  import("./MarkdownContent").then(({ MarkdownContent }) => ({ default: MarkdownContent })),
);

type TextBlockHeaderExtensionKey = "lock" | "privacy" | "colorPicker";

type TextBlockNodeProps = {
  element: TextBlockElement;
  selected: boolean;
  multiSelected: boolean;
  entering: boolean;
  deleting: boolean;
  pulsing: boolean;
  moving: boolean;
  shadowsUnderElements: boolean;
  recentColors: string[];
  editing: boolean;
  draft: string;
  renaming: boolean;
  renameDraft: string;
  onDraftChange: (value: string) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onRenameDraftChange: (value: string) => void;
  onSaveRename: (id: string) => void;
  onCancelRename: () => void;
  onStartEdit: (element: TextBlockElement) => void;
  onSelect: (element: TextBlockElement, additive?: boolean) => void;
  onStartMove: (event: PointerEvent<HTMLElement>, element: TextBlockElement) => void;
  onStartResize: (event: PointerEvent<HTMLButtonElement>, element: TextBlockElement) => void;
  onToggleMenu: (event: MouseEvent<HTMLButtonElement>, element: TextBlockElement) => void;
  onTogglePrivacy: (id: string) => void;
  onToggleLock: (id: string) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  onRememberRecentColor: (color?: string) => void;
  onHeaderButtonsVisibleChange: (id: string, visible: boolean) => void;
};

function TextBlockNodeComponent({
  element,
  selected,
  multiSelected,
  entering,
  deleting,
  pulsing,
  moving,
  shadowsUnderElements,
  recentColors,
  editing,
  draft,
  renaming,
  renameDraft,
  onDraftChange,
  onSave,
  onCancel,
  onRenameDraftChange,
  onSaveRename,
  onCancelRename,
  onStartEdit,
  onSelect,
  onStartMove,
  onStartResize,
  onToggleMenu,
  onTogglePrivacy,
  onToggleLock,
  onUpdateAccent,
  onRememberRecentColor,
  onHeaderButtonsVisibleChange,
}: TextBlockNodeProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const selectedAccent = selected
    ? `color-mix(in srgb, ${element.accent} 72%, white 28%)`
    : element.accent;

  useEffect(() => {
    if (!editing) {
      return;
    }

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    });
  }, [editing]);

  const handleTextBlockWheel = (event: WheelEvent<HTMLElement>) => {
    const content = editing ? textareaRef.current : contentRef.current;
    const scrollable = Boolean(
      content &&
      (content.scrollHeight > content.clientHeight || content.scrollWidth > content.clientWidth),
    );

    if (editing || scrollable) {
      event.stopPropagation();
    }
  };

  const privacyEnabled = Boolean(element.extensions?.privacy?.enabled);
  const privacyInstalled = Boolean(element.extensions?.privacy);
  const lockInstalled = Boolean(element.extensions?.lock);
  const lockEnabled = Boolean(element.extensions?.lock?.enabled);
  const colorPickerInstalled = Boolean(element.extensions?.colorPicker);
  const extensionButtonsVisible = element.headerButtonsVisible ?? true;
  const headerExtensionItems = useMemo(() => {
    const items: Array<{ key: TextBlockHeaderExtensionKey; width: number }> = [];
    if (lockInstalled) items.push({ key: "lock", width: 36 });
    if (privacyInstalled) items.push({ key: "privacy", width: 36 });
    if (colorPickerInstalled) items.push({ key: "colorPicker", width: 36 });
    return items;
  }, [colorPickerInstalled, lockInstalled, privacyInstalled]);
  const headerExtensionButtonCount = headerExtensionItems.length;
  const headerExtensionWidth = headerExtensionItems.reduce((total, item) => total + item.width, 0);
  const collapsibleExtensions = headerExtensionButtonCount > 1;
  const [visibleExtensionCount, setVisibleExtensionCount] = useState(headerExtensionButtonCount);
  const [overflowMenuPosition, setOverflowMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [colorMenuPosition, setColorMenuPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const articleRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const headerTitleRef = useRef<HTMLDivElement | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const visibleExtensionItems = headerExtensionItems.slice(0, visibleExtensionCount);
  const overflowExtensionItems = extensionButtonsVisible
    ? headerExtensionItems.slice(visibleExtensionCount)
    : [];
  const hasOverflowExtensions = overflowExtensionItems.length > 0;

  useEffect(() => {
    const header = headerRef.current;
    const title = headerTitleRef.current;
    if (!header || !title) {
      return;
    }

    const measure = () => {
      const innerWidth = Math.max(0, header.clientWidth - 24);
      const titleReserve = Math.min(title.scrollWidth, Math.max(56, innerWidth * 0.38));
      const fixedControlsWidth = 28 + (collapsibleExtensions ? 24 : 0);
      const availableWithoutOverflow = Math.max(
        0,
        innerWidth - titleReserve - fixedControlsWidth - 10,
      );

      if (headerExtensionWidth <= availableWithoutOverflow) {
        setVisibleExtensionCount(headerExtensionButtonCount);
        return;
      }

      const availableWithOverflow = Math.max(0, availableWithoutOverflow - 32);
      let usedWidth = 0;
      let nextVisibleCount = 0;
      for (const item of headerExtensionItems) {
        if (usedWidth + item.width > availableWithOverflow) {
          break;
        }
        usedWidth += item.width;
        nextVisibleCount += 1;
      }

      setVisibleExtensionCount(nextVisibleCount);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(title);
    measure();

    return () => observer.disconnect();
  }, [
    collapsibleExtensions,
    element.name,
    headerExtensionButtonCount,
    headerExtensionItems,
    headerExtensionWidth,
    renaming,
  ]);

  useEffect(() => {
    if (!hasOverflowExtensions) {
      setOverflowMenuPosition(null);
    }
  }, [hasOverflowExtensions]);

  useEffect(() => {
    if (!overflowMenuPosition) {
      return;
    }

    const closeOverflowMenu = (event: globalThis.PointerEvent | globalThis.MouseEvent) => {
      if ("button" in event && event.button === 1) {
        return;
      }

      const target = event.target as Node;
      if (
        !overflowButtonRef.current?.contains(target) &&
        !overflowMenuRef.current?.contains(target)
      ) {
        setOverflowMenuPosition(null);
      }
    };

    window.addEventListener("pointerdown", closeOverflowMenu, true);
    window.addEventListener("contextmenu", closeOverflowMenu, true);
    return () => {
      window.removeEventListener("pointerdown", closeOverflowMenu, true);
      window.removeEventListener("contextmenu", closeOverflowMenu, true);
    };
  }, [overflowMenuPosition]);

  const getExtensionButtonClass = (active: boolean) =>
    `grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 ${
      active ? "bg-white/10 text-white" : "text-white/70"
    }`;

  const renderExtensionButton = (key: TextBlockHeaderExtensionKey) => {
    if (key === "lock") {
      return (
        <button
          key={key}
          className={getExtensionButtonClass(false)}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLock(element.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          title={lockEnabled ? "Unlock" : "Lock"}
        >
          {lockEnabled ? <IconLock size={18} stroke={2} /> : <IconLockOpen size={18} stroke={2} />}
        </button>
      );
    }

    if (key === "privacy") {
      return (
        <button
          key={key}
          className={getExtensionButtonClass(false)}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePrivacy(element.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          title={privacyEnabled ? "Show content" : "Hide content"}
        >
          {privacyEnabled ? <IconEyeOff size={18} stroke={2} /> : <IconEye size={18} stroke={2} />}
        </button>
      );
    }

    return (
      <button
        key={key}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setColorMenuPosition((current) =>
            current ? null : { left: rect.right + 8, top: rect.top },
          );
          setOverflowMenuPosition(null);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        title="Open color picker"
      >
        <IconPalette size={18} stroke={2} />
      </button>
    );
  };

  const toggleOverflowMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (overflowMenuPosition) {
      setOverflowMenuPosition(null);
      return;
    }

    const article = articleRef.current;
    if (!article) {
      return;
    }

    const articleRect = article.getBoundingClientRect();
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const scale = articleRect.width / Math.max(element.width, 1) || 1;
    setOverflowMenuPosition({
      left: (buttonRect.left + buttonRect.width / 2 - articleRect.left) / scale,
      top: (buttonRect.top - articleRect.top) / scale - 10,
    });
  };

  return (
    <article
      ref={articleRef}
      className={`group/text-block absolute z-20 overflow-visible rounded-xl border-2 border-[color:var(--container-chrome)] transition-[border-color] duration-150 ease-out ${
        entering ? "container-enter" : ""
      } ${deleting ? "container-exit pointer-events-none" : ""} ${pulsing ? "text-card-pulse" : ""} ${
        shadowsUnderElements
          ? ""
          : `canvas-attached-shadow-shell ${moving ? "canvas-attached-drag-shadow" : ""}`
      }`}
      style={{
        zIndex: 20 + (element.layer ?? 0),
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        backgroundColor: element.accent,
        borderColor: selectedAccent,
      }}
      onPointerDown={(event) => {
        if (event.button !== 1) {
          event.stopPropagation();
        }

        if (event.button === 0 && multiSelected) {
          onStartMove(event, element);
          return;
        }

        if (event.button === 0) {
          onSelect(element, event.shiftKey);
        }
      }}
    >
      <div className="relative h-full overflow-hidden rounded-[10px]">
        <div
          ref={headerRef}
          className={`relative z-30 flex h-10 items-center justify-between px-3 text-white ${
            moving ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ backgroundColor: element.accent }}
          onPointerDown={(event) => onStartMove(event, element)}
        >
          <div ref={headerTitleRef} className="flex min-w-0 items-center gap-2">
            <IconNotes size={18} stroke={2} className="shrink-0 text-white/80" />
            {renaming ? (
              <input
                data-container-rename-input
                className="h-7 min-w-0 flex-1 appearance-none rounded-md border border-white/20 bg-black/[0.18] px-2 text-[14px] font-semibold text-white outline-none selection:bg-white/20 focus:border-white/45"
                value={renameDraft}
                autoFocus
                spellCheck={false}
                onChange={(event) => onRenameDraftChange(event.target.value)}
                onFocus={(event) => event.target.select()}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => onSaveRename(element.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSaveRename(element.id);
                  }

                  if (event.key === "Escape") {
                    onCancelRename();
                  }
                }}
              />
            ) : (
              <span className="truncate text-[14px] font-semibold text-white/86">
                {element.name}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {collapsibleExtensions && (
              <button
                className="grid h-8 w-5 place-items-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
                onClick={(event) => {
                  event.stopPropagation();
                  onHeaderButtonsVisibleChange(element.id, !extensionButtonsVisible);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                title={
                  extensionButtonsVisible ? "Hide extension buttons" : "Show extension buttons"
                }
              >
                {extensionButtonsVisible ? (
                  <IconChevronRight size={18} stroke={2} />
                ) : (
                  <IconChevronLeft size={18} stroke={2} />
                )}
              </button>
            )}
            <div
              className={`flex items-center gap-1 overflow-hidden transition-[max-width,opacity,transform] duration-150 ease-out ${
                !collapsibleExtensions || extensionButtonsVisible
                  ? "translate-x-0 opacity-100"
                  : "pointer-events-none max-w-0 translate-x-2 opacity-0"
              }`}
              style={{
                maxWidth:
                  !collapsibleExtensions || extensionButtonsVisible
                    ? visibleExtensionItems.reduce((total, item) => total + item.width, 0)
                    : 0,
              }}
            >
              {visibleExtensionItems.map((item) => renderExtensionButton(item.key))}
            </div>
            {hasOverflowExtensions && (
              <button
                ref={overflowButtonRef}
                className="grid h-8 w-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
                onClick={toggleOverflowMenu}
                onPointerDown={(event) => event.stopPropagation()}
                title="More extensions"
              >
                <IconPuzzle size={18} stroke={2} />
              </button>
            )}
            <button
              className="grid h-8 w-7 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
              onClick={(event) => onToggleMenu(event, element)}
              onPointerDown={(event) => event.stopPropagation()}
              title="Text block menu"
            >
              <IconDotsVertical size={18} stroke={2} />
            </button>
          </div>
        </div>

        <div
          className={`h-[calc(100%-40px)] bg-[color:var(--container-bg)] transition-[filter] ${
            privacyEnabled ? "select-none blur-[5px]" : ""
          } ${multiSelected ? (moving ? "cursor-grabbing" : "cursor-grab") : ""}`}
          onWheel={handleTextBlockWheel}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            event.stopPropagation();
            if (multiSelected) {
              onStartMove(event, element);
              return;
            }

            onSelect(element, event.shiftKey);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onStartEdit(element);
          }}
        >
          {editing ? (
            <div className="relative h-full">
              <textarea
                ref={textareaRef}
                className="hidden-scrollbar h-full w-full resize-none overflow-auto bg-transparent px-4 py-3 text-[16px] leading-6 text-white outline-none selection:bg-white/25"
                value={draft}
                spellCheck={false}
                onChange={(event) => onDraftChange(event.target.value)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => onSave(element.id)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    onCancel();
                  }
                }}
              />
            </div>
          ) : (
            <div
              ref={contentRef}
              data-text-block-content
              className="markdown-content hidden-scrollbar h-full select-text overflow-auto break-words px-4 py-3 text-[16px] leading-6 text-white/92"
            >
              <Suspense fallback={<div className="whitespace-pre-wrap">{element.text}</div>}>
                <MarkdownContent>{element.text}</MarkdownContent>
              </Suspense>
            </div>
          )}
        </div>

        <button
          className="pointer-events-none absolute bottom-1.5 right-1.5 z-30 grid h-7 w-7 cursor-nwse-resize place-items-center rounded-md text-white/45 opacity-0 transition-[opacity,background-color,color] duration-150 ease-out group-hover/text-block:pointer-events-auto group-hover/text-block:opacity-100 hover:bg-white/10 hover:text-white/80 active:bg-white/15 active:text-white focus-visible:pointer-events-auto focus-visible:opacity-100 focus:outline-none"
          onPointerDown={(event) => {
            event.currentTarget.blur();
            onStartResize(event, element);
          }}
          title="Resize text block"
        >
          <IconArrowDownRight size={18} stroke={2} />
        </button>
        <div
          className={`selection-overlay pointer-events-none z-50 rounded-[10px] ${
            selected ? "selection-overlay-active" : ""
          }`}
        />
      </div>
      {overflowMenuPosition && (
        <MaterialSurface
          ref={overflowMenuRef}
          material="opaque"
          radius={8}
          className="absolute z-[60] flex -translate-x-1/2 -translate-y-full items-center gap-1 p-1"
          style={{ left: overflowMenuPosition.left, top: overflowMenuPosition.top }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span
            className="absolute bottom-[-7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-white/[0.15]"
            style={{ background: "rgb(var(--taskmap-material-tint-rgb))" }}
          />
          <span className="relative z-10 flex items-center gap-1">
            {overflowExtensionItems.map((item) => renderExtensionButton(item.key))}
          </span>
        </MaterialSurface>
      )}
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
    </article>
  );
}

export const TextBlockNode = memo(TextBlockNodeComponent);
