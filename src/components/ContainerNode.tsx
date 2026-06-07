import {
  IconArrowDownRight,
  IconBox,
  IconDotsVertical,
} from "@tabler/icons-react";
import { PointerEvent, ReactNode, WheelEvent } from "react";
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
  onOpenContentMenu,
  onWheelContent,
  children,
}: ContainerNodeProps) {
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
          className={`relative z-30 flex h-12 items-center justify-between px-4 text-white ${
            dragState?.type === "move" && dragState.ids.includes(element.id)
              ? "cursor-grabbing"
              : "cursor-grab"
          }`}
          style={{ backgroundColor: element.accent }}
          onPointerDown={(event) => onStartMove(event, element)}
        >
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
          <button
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
            onClick={(event) => onToggleMenu(event, element)}
            onPointerDown={(event) => event.stopPropagation()}
            title="Container menu"
          >
            <IconDotsVertical size={18} stroke={2} />
          </button>
        </div>

        <div
          className={`h-[calc(100%-48px)] rounded-t-lg bg-[color:var(--container-bg)] ${
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
