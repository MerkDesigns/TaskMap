import {
  IconArrowDownRight,
  IconBox,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconSearch,
  IconSortAZ,
  IconSortZA,
  IconPalette,
  IconX,
} from "@tabler/icons-react";
import { PointerEvent, ReactNode, WheelEvent, useState } from "react";
import { ContainerElement, DragState } from "../types";

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
  onSelect: (element: ContainerElement) => void;
  onStartMove: (event: PointerEvent<HTMLElement>, element: ContainerElement) => void;
  onStartResize: (event: PointerEvent<HTMLButtonElement>, element: ContainerElement) => void;
  onToggleMenu: (event: React.MouseEvent<HTMLButtonElement>, element: ContainerElement) => void;
  onTogglePrivacy: (id: string) => void;
  onToggleLock: (id: string) => void;
  onCycleSort: (id: string, mode: "alphabet" | "color") => void;
  onSearchChange: (id: string, query: string) => void;
  onOpenContentMenu: (event: React.MouseEvent<HTMLElement>, element: ContainerElement) => void;
  onWheelContent: (event: WheelEvent<HTMLElement>, element: ContainerElement) => void;
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
  onCycleSort,
  onSearchChange,
  onOpenContentMenu,
  onWheelContent,
  children,
}: ContainerNodeProps) {
  const privacyEnabled = Boolean(element.extensions?.privacy?.enabled);
  const lockInstalled = Boolean(element.extensions?.lock);
  const lockEnabled = Boolean(element.extensions?.lock?.enabled);
  const searchInstalled = Boolean(element.extensions?.search);
  const searchQuery = element.extensions?.search?.query ?? "";
  const sorting = element.extensions?.sorting;
  const alphabetSortActive = sorting?.mode === "alphabet";
  const colorSortActive = sorting?.mode === "color";
  const [extensionButtonsVisible, setExtensionButtonsVisible] = useState(true);
  const headerExtensionButtonCount =
    (lockInstalled ? 1 : 0) + (element.extensions?.privacy ? 1 : 0) + (element.extensions?.sorting ? 2 : 0);
  const collapsibleExtensions = headerExtensionButtonCount > 1;

  const getSortButtonClass = (active: boolean) =>
    `grid h-8 w-8 place-items-center rounded-md transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 ${
      active ? "bg-white/10 text-white" : "text-white/70"
    }`;

  return (
    <article
      className={`absolute z-20 overflow-visible rounded-xl border-2 border-[color:var(--container-chrome)] shadow-xl ${
        entering ? "container-enter" : ""
      } ${deleting ? "container-exit pointer-events-none" : ""}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        backgroundColor: element.accent,
        borderColor: element.accent,
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
          onSelect(element);
        }
      }}
      onWheelCapture={(event) => onWheelContent(event, element)}
    >
      <div
        className="pointer-events-none absolute -inset-[6px] rounded-[15px] border-2 border-[#2dd8c8]/75 transition-opacity duration-100 ease-out"
        style={{
          opacity: selected ? 1 : 0,
          boxShadow: "0 0 14px rgba(45, 216, 200, 0.10)",
        }}
      />
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
          <div className="flex h-12 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-2">
              <IconBox size={19} stroke={2} className="shrink-0 text-white/80" />
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
                  className="grid h-8 w-6 place-items-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
                  onClick={(event) => {
                    event.stopPropagation();
                    setExtensionButtonsVisible((current) => !current);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title={extensionButtonsVisible ? "Hide extension buttons" : "Show extension buttons"}
                >
                  {extensionButtonsVisible ? (
                    <IconChevronLeft size={18} stroke={2} />
                  ) : (
                    <IconChevronRight size={18} stroke={2} />
                  )}
                </button>
              )}
              <div
                className={`flex items-center gap-1 overflow-hidden transition-[max-width,opacity,transform] duration-150 ease-out ${
                  !collapsibleExtensions || extensionButtonsVisible
                    ? "max-w-[152px] translate-x-0 opacity-100"
                    : "pointer-events-none max-w-0 translate-x-2 opacity-0"
                }`}
              >
                {lockInstalled && (
                  <button
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
                )}
                {element.extensions?.privacy && (
                  <button
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
                )}
                {element.extensions?.sorting && (
                  <>
                    <button
                      className={getSortButtonClass(alphabetSortActive)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCycleSort(element.id, "alphabet");
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      title={
                        alphabetSortActive
                          ? sorting.direction === "asc"
                            ? "Alphabet: A to Z"
                            : "Alphabet: Z to A"
                          : "Sort alphabetically"
                      }
                    >
                      {alphabetSortActive && sorting.direction === "desc" ? (
                        <IconSortZA size={25} stroke={2} />
                      ) : (
                        <IconSortAZ size={25} stroke={2} />
                      )}
                    </button>
                    <button
                      className={getSortButtonClass(colorSortActive)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCycleSort(element.id, "color");
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      title={
                        colorSortActive
                          ? sorting.direction === "asc"
                            ? "Color: ascending"
                            : "Color: descending"
                          : "Sort by color"
                      }
                    >
                      <IconPalette size={22} stroke={2} />
                    </button>
                  </>
                )}
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
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
      </div>
    </article>
  );
}
