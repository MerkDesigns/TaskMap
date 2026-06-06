import {
  IconArrowAutofitDown,
  IconArrowAutofitDownFilled,
  IconArrowAutofitUp,
  IconArrowAutofitUpFilled,
  IconCopy,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { ACCENT_PRESETS, getTextCardAccent, MENU_DIVIDER_CLASS, MENU_ITEM_CLASS } from "../constants";
import { ContainerElement, ContainerMenuState, TextCardElement } from "../types";

type ContainerContextMenuProps = {
  menu: ContainerMenuState;
  element: ContainerElement;
  closing: boolean;
  onStartRename: (element: ContainerElement) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  onCopy: (element: ContainerElement) => void;
  onMoveLayer: (
    id: string,
    direction: "back" | "backward" | "forward" | "front",
  ) => void;
  onDelete: (id: string) => void;
};

export function ContainerContextMenu({
  menu,
  element,
  closing,
  onStartRename,
  onUpdateAccent,
  onCopy,
  onMoveLayer,
  onDelete,
}: ContainerContextMenuProps) {
  return (
    <div
      data-context-menu
      className={`context-menu-panel fixed z-30 w-56 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={{ left: menu.left, top: menu.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button className={MENU_ITEM_CLASS} onClick={() => onStartRename(element)}>
        <IconPencil size={17} stroke={2} />
        <span>Edit Container</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <div className="px-2 pb-2 pt-1.5">
        <div className="grid grid-cols-8 gap-1.5">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.accent}
              className="relative h-5 rounded-md transition hover:ring-2 hover:ring-white/12"
              style={{ backgroundColor: preset.accent }}
              onClick={() => onUpdateAccent(element.id, preset.accent)}
              title="Container accent color"
            >
              {element.accent === preset.accent && (
                <span className="absolute inset-x-1.5 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={MENU_DIVIDER_CLASS} />
      <div className="px-2 py-1">
        <div className="grid grid-cols-4 gap-1">
          <button
            className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
            onClick={() => onMoveLayer(element.id, "back")}
            title="Send to back"
          >
            <IconArrowAutofitDown size={20} stroke={2} />
          </button>
          <button
            className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
            onClick={() => onMoveLayer(element.id, "backward")}
            title="Send one layer back"
          >
            <IconArrowAutofitDownFilled size={20} />
          </button>
          <button
            className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
            onClick={() => onMoveLayer(element.id, "forward")}
            title="Bring one layer forward"
          >
            <IconArrowAutofitUpFilled size={20} />
          </button>
          <button
            className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
            onClick={() => onMoveLayer(element.id, "front")}
            title="Bring to front"
          >
            <IconArrowAutofitUp size={20} stroke={2} />
          </button>
        </div>
      </div>
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_ITEM_CLASS} onClick={() => onCopy(element)}>
        <IconCopy size={17} stroke={2} />
        <span>Copy</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <button
        className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300"
        onClick={() => onDelete(element.id)}
      >
        <IconTrash size={17} stroke={2} />
        <span>Remove</span>
      </button>
    </div>
  );
}

type CanvasContextMenuProps = {
  menu: { clientX: number; clientY: number };
  hasCopiedContainer: boolean;
  closing: boolean;
  onPaste: (clientX: number, clientY: number) => void;
  onCreate: (clientX: number, clientY: number) => void;
  onCreateTextCard: (clientX: number, clientY: number) => void;
  onClear: () => void;
};

type ContainerContentContextMenuProps = {
  menu: { containerId: string; clientX: number; clientY: number };
  closing: boolean;
  onCreateTextCard: (containerId: string, clientX: number, clientY: number) => void;
};

export function ContainerContentContextMenu({
  menu,
  closing,
  onCreateTextCard,
}: ContainerContentContextMenuProps) {
  return (
    <div
      data-context-menu
      className={`context-menu-panel fixed z-30 w-52 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={{ left: menu.clientX + 8, top: menu.clientY + 8 }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className={MENU_ITEM_CLASS}
        onClick={() => onCreateTextCard(menu.containerId, menu.clientX, menu.clientY)}
      >
        <IconPencil size={17} stroke={2} />
        <span>Create text card</span>
      </button>
    </div>
  );
}

export function CanvasContextMenu({
  menu,
  hasCopiedContainer,
  closing,
  onPaste,
  onCreate,
  onCreateTextCard,
  onClear,
}: CanvasContextMenuProps) {
  return (
    <div
      data-context-menu
      className={`context-menu-panel fixed z-30 w-52 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={{ left: menu.clientX + 8, top: menu.clientY + 8 }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {hasCopiedContainer && (
        <>
          <button className={MENU_ITEM_CLASS} onClick={() => onPaste(menu.clientX, menu.clientY)}>
            <IconCopy size={17} stroke={2} />
            <span>Paste</span>
          </button>
          <div className={MENU_DIVIDER_CLASS} />
        </>
      )}
      <button className={MENU_ITEM_CLASS} onClick={() => onCreate(menu.clientX, menu.clientY)}>
        <IconPlus size={17} stroke={2} />
        <span>Create container</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_ITEM_CLASS} onClick={() => onCreateTextCard(menu.clientX, menu.clientY)}>
        <IconPencil size={17} stroke={2} />
        <span>Create text card</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <button
        className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300"
        onClick={onClear}
      >
        <IconTrash size={17} stroke={2} />
        <span>Clear canvas</span>
      </button>
    </div>
  );
}

type TextCardContextMenuProps = {
  menu: { id: string; left: number; top: number };
  card: TextCardElement;
  closing: boolean;
  onStartEdit: (card: TextCardElement) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  onDelete: (id: string) => void;
};

export function TextCardContextMenu({
  menu,
  card,
  closing,
  onStartEdit,
  onUpdateAccent,
  onDelete,
}: TextCardContextMenuProps) {
  const activeAccent = getTextCardAccent(card.accent);

  return (
    <div
      data-context-menu
      className={`context-menu-panel fixed z-30 w-56 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={{ left: menu.left, top: menu.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button className={MENU_ITEM_CLASS} onClick={() => onStartEdit(card)}>
        <IconPencil size={17} stroke={2} />
        <span>Edit Text</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <div className="px-2 pb-2 pt-1.5">
        <div className="grid grid-cols-8 gap-1.5">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.textCardAccent}
              className="relative h-5 rounded-md transition hover:ring-2 hover:ring-white/12"
              style={{ backgroundColor: preset.swatch }}
              onClick={() => onUpdateAccent(card.id, preset.textCardAccent)}
              title="Text card color"
            >
              {activeAccent === preset.textCardAccent && (
                <span className="absolute inset-x-1.5 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={MENU_DIVIDER_CLASS} />
      <button
        className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300"
        onClick={() => onDelete(card.id)}
      >
        <IconTrash size={17} stroke={2} />
        <span>Remove</span>
      </button>
    </div>
  );
}
