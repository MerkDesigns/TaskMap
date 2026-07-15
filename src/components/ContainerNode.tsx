import {
  IconArrowDownRight,
  IconArrowsShuffle,
  IconArrowsSort,
  IconBox,
  IconCalendarRepeat,
  IconChevronLeft,
  IconChevronRight,
  IconColorPicker,
  IconDotsVertical,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconLock,
  IconLockOpen,
  IconPuzzle,
  IconSearch,
  IconSortAZ,
  IconSortZA,
  IconPalette,
  IconX,
} from "@tabler/icons-react";
import { PointerEvent, ReactNode, WheelEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ContainerElement, DragState } from "../types";
import { ColorPickerMenu } from "./ColorPickerMenu";

type ContainerHeaderExtensionKey =
  | "lock"
  | "privacy"
  | "sorting"
  | "colorPicker"
  | "dailyReset"
  | "counter"
  | "pickCard";

type ContainerNodeProps = {
  element: ContainerElement;
  selected: boolean;
  multiSelected: boolean;
  entering: boolean;
  deleting: boolean;
  dragState: DragState | null;
  renaming: boolean;
  renameDraft: string;
  onRenameDraftChange: (value: string) => void;
  onSaveRename: (id: string) => void;
  onCancelRename: () => void;
  onSelect: (element: ContainerElement, additive?: boolean) => void;
  onStartMove: (event: PointerEvent<HTMLElement>, element: ContainerElement) => void;
  onStartResize: (event: PointerEvent<HTMLButtonElement>, element: ContainerElement) => void;
  onToggleMenu: (event: React.MouseEvent<HTMLButtonElement>, element: ContainerElement) => void;
  onTogglePrivacy: (id: string) => void;
  onToggleLock: (id: string) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  onTogglePickCard: (id: string) => void;
  onSetSort: (
    id: string,
    mode: "alphabet" | "color" | null,
    direction?: "asc" | "desc",
  ) => void;
  onSearchChange: (id: string, query: string) => void;
  onOpenContentMenu: (event: React.MouseEvent<HTMLElement>, element: ContainerElement) => void;
  onWheelContent: (event: WheelEvent<HTMLElement>, element: ContainerElement) => void;
  onStartContentSelection: (event: PointerEvent<HTMLElement>, element: ContainerElement) => void;
  cardCount: number;
  children?: ReactNode;
};

export function ContainerNode({
  element,
  selected,
  multiSelected,
  entering,
  deleting,
  dragState,
  renaming,
  renameDraft,
  onRenameDraftChange,
  onSaveRename,
  onCancelRename,
  onSelect,
  onStartMove,
  onStartResize,
  onToggleMenu,
  onTogglePrivacy,
  onToggleLock,
  onUpdateAccent,
  onTogglePickCard,
  onSetSort,
  onSearchChange,
  onOpenContentMenu,
  onWheelContent,
  onStartContentSelection,
  cardCount,
  children,
}: ContainerNodeProps) {
  const privacyEnabled = Boolean(element.extensions?.privacy?.enabled);
  const lockInstalled = Boolean(element.extensions?.lock);
  const lockEnabled = Boolean(element.extensions?.lock?.enabled);
  const searchInstalled = Boolean(element.extensions?.search);
  const searchQuery = element.extensions?.search?.query ?? "";
  const sorting = element.extensions?.sorting;
  const colorPickerInstalled = Boolean(element.extensions?.colorPicker);
  const dailyResetInstalled = Boolean(element.extensions?.dailyReset);
  const counterInstalled = Boolean(element.extensions?.counter);
  const pickCardInstalled = Boolean(element.extensions?.pickCard);
  const pickedCardActive = Boolean(element.extensions?.pickCard?.selectedCardId);
  const selectedAccent = selected
    ? `color-mix(in srgb, ${element.accent} 72%, white 28%)`
    : element.accent;
  const alphabetSortActive = sorting?.mode === "alphabet";
  const colorSortActive = sorting?.mode === "color";
  const sortActive = Boolean(sorting?.mode);
  const counterHeaderWidth = counterInstalled ? Math.max(36, String(cardCount).length * 8 + 26) : 0;
  const headerExtensionItems: Array<{ key: ContainerHeaderExtensionKey; width: number }> = [];
  if (lockInstalled) headerExtensionItems.push({ key: "lock", width: 36 });
  if (element.extensions?.privacy) headerExtensionItems.push({ key: "privacy", width: 36 });
  if (element.extensions?.sorting) headerExtensionItems.push({ key: "sorting", width: 36 });
  if (colorPickerInstalled) headerExtensionItems.push({ key: "colorPicker", width: 36 });
  if (dailyResetInstalled) headerExtensionItems.push({ key: "dailyReset", width: 36 });
  if (counterInstalled) headerExtensionItems.push({ key: "counter", width: counterHeaderWidth });
  if (pickCardInstalled) headerExtensionItems.push({ key: "pickCard", width: 36 });
  const headerExtensionWidth = headerExtensionItems.reduce((total, item) => total + item.width, 0);
  const headerExtensionSignature = headerExtensionItems.map((item) => `${item.key}:${item.width}`).join("|");
  const headerExtensionButtonCount =
    headerExtensionItems.length;
  const collapsibleExtensions = headerExtensionButtonCount > 1;
  const [extensionButtonsVisible, setExtensionButtonsVisible] = useState(true);
  const [visibleExtensionCount, setVisibleExtensionCount] = useState(headerExtensionButtonCount);
  const [overflowMenuPosition, setOverflowMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [colorMenuPosition, setColorMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const headerTitleRef = useRef<HTMLDivElement | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const visibleExtensionItems = headerExtensionItems.slice(0, visibleExtensionCount);
  const overflowExtensionItems =
    extensionButtonsVisible ? headerExtensionItems.slice(visibleExtensionCount) : [];
  const hasOverflowExtensions = overflowExtensionItems.length > 0;

  useEffect(() => {
    const header = headerRef.current;
    const title = headerTitleRef.current;
    if (!header || !title) {
      return;
    }

    const measure = () => {
      const innerWidth = Math.max(0, header.clientWidth - 32);
      const titleReserve = Math.min(title.scrollWidth, Math.max(76, innerWidth * 0.42));
      const fixedControlsWidth = 28 + (collapsibleExtensions ? 24 : 0);
      const availableWithoutOverflow = Math.max(0, innerWidth - titleReserve - fixedControlsWidth - 12);

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
    headerExtensionSignature,
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

    const closeOverflowMenu = (event: globalThis.PointerEvent | MouseEvent) => {
      if ("button" in event && event.button === 1) {
        return;
      }

      const target = event.target as Node;
      if (!overflowButtonRef.current?.contains(target) && !overflowMenuRef.current?.contains(target)) {
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

  useEffect(() => {
    if (!sortMenuPosition) {
      return;
    }

    const closeSortMenu = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (!sortButtonRef.current?.contains(target) && !sortMenuRef.current?.contains(target)) {
        setSortMenuPosition(null);
      }
    };
    const repositionSortMenu = () => setSortMenuPosition(null);

    window.addEventListener("pointerdown", closeSortMenu);
    window.addEventListener("resize", repositionSortMenu);
    window.addEventListener("scroll", repositionSortMenu, true);
    return () => {
      window.removeEventListener("pointerdown", closeSortMenu);
      window.removeEventListener("resize", repositionSortMenu);
      window.removeEventListener("scroll", repositionSortMenu, true);
    };
  }, [sortMenuPosition]);

  const getSortButtonClass = (active: boolean) =>
    `grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 ${
      active ? "bg-white/10 text-white" : "text-white/70"
    }`;

  const openSortMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (sortMenuPosition) {
      setSortMenuPosition(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setSortMenuPosition({
      left: Math.min(rect.right + 6, window.innerWidth - 202),
      top: Math.min(rect.top, window.innerHeight - 226),
    });
  };

  const toggleOverflowMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
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

  const renderExtensionButton = (key: ContainerHeaderExtensionKey) => {
    if (key === "lock") {
      return (
        <button
          key={key}
          className={getSortButtonClass(lockEnabled)}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLock(element.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          title={lockEnabled ? "Unlock" : "Lock"}
        >
          {lockEnabled ? <IconLock size={22} stroke={2} /> : <IconLockOpen size={22} stroke={2} />}
        </button>
      );
    }

    if (key === "privacy") {
      return (
        <button
          key={key}
          className={getSortButtonClass(privacyEnabled)}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePrivacy(element.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          title={privacyEnabled ? "Show content" : "Hide content"}
        >
          {privacyEnabled ? <IconEyeOff size={25} stroke={2} /> : <IconEye size={25} stroke={2} />}
        </button>
      );
    }

    if (key === "sorting") {
      return (
        <button
          key={key}
          ref={sortButtonRef}
          className={getSortButtonClass(sortActive)}
          onClick={openSortMenu}
          onPointerDown={(event) => event.stopPropagation()}
          title="Sort cards"
        >
          {colorSortActive ? (
            <IconPalette size={22} stroke={2} />
          ) : alphabetSortActive && sorting?.direction === "desc" ? (
            <IconSortZA size={25} stroke={2} />
          ) : (
            <IconArrowsSort size={23} stroke={2} />
          )}
        </button>
      );
    }

    if (key === "colorPicker") {
      return (
        <button
          key={key}
          className={getSortButtonClass(false)}
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
          <IconColorPicker size={22} stroke={2} />
        </button>
      );
    }

    if (key === "dailyReset") {
      return (
        <button
          key={key}
          className={getSortButtonClass(false)}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          title="Checkboxes reset daily"
        >
          <IconCalendarRepeat size={22} stroke={2} />
        </button>
      );
    }

    if (key === "counter") {
      return (
        <span
          key={key}
          className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-2 text-sm font-semibold tabular-nums text-white/78"
          onPointerDown={(event) => event.stopPropagation()}
          title={`${cardCount} ${cardCount === 1 ? "card" : "cards"}`}
        >
          {cardCount}
        </span>
      );
    }

    return (
      <button
        key={key}
        className={getSortButtonClass(pickedCardActive)}
        onClick={(event) => {
          event.stopPropagation();
          onTogglePickCard(element.id);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        title={pickedCardActive ? "Show all cards" : "Pick a random card"}
      >
        <IconArrowsShuffle size={22} stroke={2} />
      </button>
    );
  };

  return (
    <article
      ref={articleRef}
      className={`absolute z-20 overflow-visible rounded-xl border-2 border-[color:var(--container-chrome)] shadow-xl transition-[border-color] duration-150 ease-out ${
        entering ? "container-enter" : ""
      } ${deleting ? "container-exit pointer-events-none" : ""}`}
      style={{
        zIndex: 20 + (element.layer ?? 0),
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        backgroundColor: element.accent,
        borderColor: selectedAccent,
        boxShadow: "0 18px 42px rgba(0, 0, 0, 0.42)",
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
      onWheelCapture={(event) => onWheelContent(event, element)}
    >
      <div className="relative h-full overflow-hidden rounded-[10px]">
        <div
          className={`relative z-30 flex flex-col text-white ${
            dragState?.type === "move" && dragState.ids.includes(element.id)
              ? "cursor-grabbing"
              : "cursor-grab"
          } ${searchInstalled ? "h-[90px]" : "h-12"}`}
          style={{ backgroundColor: element.accent }}
          onPointerDown={(event) => onStartMove(event, element)}
        >
          <div ref={headerRef} className="flex h-12 items-center justify-between gap-3 px-4">
            <div ref={headerTitleRef} className="flex min-w-0 items-center gap-2">
              <span className="relative grid h-6 w-6 shrink-0 place-items-center">
                <IconBox size={19} stroke={2} className="text-white/80" />
              </span>
              {renaming ? (
                <input
                  data-container-rename-input
                  className="h-8 min-w-0 flex-1 appearance-none rounded-md border border-white/20 bg-black/[0.18] px-2 text-[18.4px] font-semibold text-white outline-none selection:bg-white/20 focus:border-white/45"
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
                <span className="truncate text-[18.4px] font-semibold">{element.name}</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {collapsibleExtensions && (
                <button
                  className="grid h-8 w-5 place-items-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
                  onClick={(event) => {
                    event.stopPropagation();
                    setExtensionButtonsVisible((current) => !current);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title={extensionButtonsVisible ? "Hide extension buttons" : "Show extension buttons"}
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
                title="Container menu"
              >
                <IconDotsVertical size={18} stroke={2} />
              </button>
            </div>
          </div>

          {searchInstalled && (
            <div
              className="flex h-[42px] items-center px-4 pb-3"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-8 w-full items-center gap-2 rounded-md bg-black/[0.38] px-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <IconSearch size={16} stroke={2} className="shrink-0 text-white/48" />
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/45"
                  value={searchQuery}
                  spellCheck={false}
                  placeholder="Search"
                  onChange={(event) => onSearchChange(element.id, event.target.value)}
                />
                {searchQuery && (
                  <button
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/55 transition-colors hover:bg-white/[0.12] hover:text-white"
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

        <div
          className={`${
            searchInstalled ? "h-[calc(100%-90px)]" : "h-[calc(100%-48px)]"
          } rounded-t-lg bg-[color:var(--container-bg)] transition-[filter] ${
            privacyEnabled ? "select-none blur-[5px]" : ""
          } ${
            multiSelected
              ? dragState?.type === "move" && dragState.ids.includes(element.id)
                ? "cursor-grabbing"
                : "cursor-grab"
              : ""
          }`}
          onContextMenu={(event) => {
            if (multiSelected) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }

            onOpenContentMenu(event, element);
          }}
          onPointerDown={(event) => onStartContentSelection(event, element)}
          onWheelCapture={(event) => onWheelContent(event, element)}
        />

        {children}

        <button
          className="absolute bottom-1.5 right-1.5 z-30 grid h-7 w-7 cursor-nwse-resize place-items-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white/80 active:bg-white/15 active:text-white focus:outline-none"
          onPointerDown={(event) => {
            event.currentTarget.blur();
            onStartResize(event, element);
          }}
          title="Resize container"
        >
          <IconArrowDownRight size={18} stroke={2} />
        </button>
        <div
          className={`selection-overlay pointer-events-none z-50 rounded-[10px] ${
            selected ? "selection-overlay-active" : ""
          }`}
        />
      </div>
      {overflowMenuPosition &&
        (
          <div
            ref={overflowMenuRef}
            className="absolute z-[60] flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-lg border border-white/[0.15] bg-[#1b1b1e] p-1 shadow-[0_14px_32px_rgba(0,0,0,0.52)]"
            style={{ left: overflowMenuPosition.left, top: overflowMenuPosition.top }}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="absolute bottom-[-7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-white/[0.15] bg-[#1b1b1e]" />
            <span className="relative z-10 flex items-center gap-1">
              {overflowExtensionItems.map((item) => renderExtensionButton(item.key))}
            </span>
          </div>
        )}
      {sortMenuPosition &&
        createPortal(
          <div
            ref={sortMenuRef}
            data-context-menu
            className="fixed z-[1002] w-[196px] rounded-md border border-white/[0.15] bg-[#1b1b1e] p-1 shadow-[0_14px_32px_rgba(0,0,0,0.52)]"
            style={sortMenuPosition}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            {[
              { label: "Alphabet: A to Z", mode: "alphabet" as const, direction: "asc" as const, icon: IconSortAZ },
              { label: "Alphabet: Z to A", mode: "alphabet" as const, direction: "desc" as const, icon: IconSortZA },
              { label: "Color: ascending", mode: "color" as const, direction: "asc" as const, icon: IconPalette },
              { label: "Color: descending", mode: "color" as const, direction: "desc" as const, icon: IconPalette },
            ].map((option) => {
              const selected = sorting?.mode === option.mode && sorting.direction === option.direction;
              const OptionIcon = option.icon;
              return (
                <button
                  key={`${option.mode}-${option.direction}`}
                  className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-white/78 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    onSetSort(element.id, option.mode, option.direction);
                    setSortMenuPosition(null);
                  }}
                >
                  <OptionIcon size={18} stroke={2} />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {selected && <IconCheck size={17} stroke={2} className="text-white" />}
                </button>
              );
            })}
            <div className="my-1 border-t border-white/10" />
            <button
              className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-red-300/85 transition-colors hover:bg-red-500/10 hover:text-red-200"
              onClick={() => {
                onSetSort(element.id, null);
                setSortMenuPosition(null);
              }}
            >
              <IconX size={18} stroke={2} />
              <span className="flex-1">Clear sorting</span>
            </button>
          </div>,
          document.body,
        )}
      {colorMenuPosition && (
        <ColorPickerMenu
          color={element.accent}
          left={colorMenuPosition.left}
          top={colorMenuPosition.top}
          onChange={(accent) => onUpdateAccent(element.id, accent)}
          onClose={() => setColorMenuPosition(null)}
        />
      )}
    </article>
  );
}
