import {
  IconArrowAutofitDown,
  IconArrowAutofitDownFilled,
  IconArrowAutofitUp,
  IconArrowAutofitUpFilled,
  IconCopy,
  IconCheck,
  IconLink,
  IconLock,
  IconPencil,
  IconPlus,
  IconPuzzle,
  IconNotes,
  IconPalette,
  IconPhoto,
  IconSquare,
  IconSquareOff,
  IconSearch,
  IconShieldLock,
  IconSortAZ,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ACCENT_PRESETS,
  ALL_ACCENT_PRESETS,
  getTextCardAccent,
  MENU_DIVIDER_CLASS,
  MENU_ITEM_CLASS,
} from "../constants";
import { ContainerElement, ContainerMenuState, ImageElement, TextBlockElement, TextCardElement } from "../types";
import { useClampedFixedPosition } from "../useClampedFixedPosition";

type ContainerContextMenuProps = {
  menu: ContainerMenuState;
  element: ContainerElement;
  closing: boolean;
  onStartRename: (element: ContainerElement) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  onCopy: (element: ContainerElement) => void;
  onRemovePrivacyExtension: (id: string) => void;
  onRemoveSearchExtension: (id: string) => void;
  onRemoveSortingExtension: (id: string) => void;
  onRemoveLockExtension: (id: string) => void;
  onRemoveColorsExtension: (id: string) => void;
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
  onRemovePrivacyExtension,
  onRemoveSearchExtension,
  onRemoveSortingExtension,
  onRemoveLockExtension,
  onRemoveColorsExtension,
  onMoveLayer,
  onDelete,
}: ContainerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  const presets = element.extensions?.colors?.enabled ? ALL_ACCENT_PRESETS : ACCENT_PRESETS;

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`context-menu-panel fixed z-30 w-56 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button className={MENU_ITEM_CLASS} onClick={() => onStartRename(element)}>
        <IconPencil size={17} stroke={2} />
        <span>Edit Container</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <div className="px-1 pb-2 pt-1.5">
        <div className="grid grid-cols-8 gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.accent}
              className="relative aspect-square rounded-md transition hover:ring-2 hover:ring-white/12"
              style={{ backgroundColor: preset.swatch }}
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
      {(element.extensions?.privacy ||
        element.extensions?.search ||
        element.extensions?.sorting ||
        element.extensions?.lock ||
        element.extensions?.colors) && (
        <>
          <div className={MENU_DIVIDER_CLASS} />
          {element.extensions?.privacy && (
          <button className={MENU_ITEM_CLASS} onClick={() => onRemovePrivacyExtension(element.id)}>
            <IconPuzzle size={17} stroke={2} />
            <span>Remove privacy</span>
          </button>
          )}
          {element.extensions?.search && (
          <button className={MENU_ITEM_CLASS} onClick={() => onRemoveSearchExtension(element.id)}>
            <IconPuzzle size={17} stroke={2} />
            <span>Remove search</span>
          </button>
          )}
          {element.extensions?.sorting && (
          <button className={MENU_ITEM_CLASS} onClick={() => onRemoveSortingExtension(element.id)}>
            <IconPuzzle size={17} stroke={2} />
            <span>Remove sorting</span>
          </button>
          )}
          {element.extensions?.colors && (
          <button className={MENU_ITEM_CLASS} onClick={() => onRemoveColorsExtension(element.id)}>
            <IconPuzzle size={17} stroke={2} />
            <span>Remove more colors</span>
          </button>
          )}
          {element.extensions?.lock && (
          <button className={MENU_ITEM_CLASS} onClick={() => onRemoveLockExtension(element.id)}>
            <IconPuzzle size={17} stroke={2} />
            <span>Remove lock</span>
          </button>
          )}
        </>
      )}
      <div className={MENU_DIVIDER_CLASS} />
      <button
        className="flex h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300"
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
  hasCopiedItem: boolean;
  closing: boolean;
  onPaste: (clientX: number, clientY: number) => void;
  onCreate: (clientX: number, clientY: number) => void;
  onCreateTextCard: (clientX: number, clientY: number) => void;
  onCreateTextBlock: (clientX: number, clientY: number) => void;
  onCreateImage: (clientX: number, clientY: number) => void;
  onClear: () => void;
};

type ContainerContentContextMenuProps = {
  menu: { containerId: string; clientX: number; clientY: number };
  hasCopiedItem: boolean;
  closing: boolean;
  onPaste: (clientX: number, clientY: number, containerId: string) => void;
  onCreateTextCard: (containerId: string, clientX: number, clientY: number) => void;
};

export function ContainerContentContextMenu({
  menu,
  hasCopiedItem,
  closing,
  onPaste,
  onCreateTextCard,
}: ContainerContentContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.clientX + 8, top: menu.clientY + 8 });

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`context-menu-panel fixed z-30 w-52 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {hasCopiedItem && (
        <>
          <button className={MENU_ITEM_CLASS} onClick={() => onPaste(menu.clientX, menu.clientY, menu.containerId)}>
            <IconCopy size={17} stroke={2} />
            <span>Paste</span>
          </button>
          <div className={MENU_DIVIDER_CLASS} />
        </>
      )}
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
  hasCopiedItem,
  closing,
  onPaste,
  onCreate,
  onCreateTextCard,
  onCreateTextBlock,
  onCreateImage,
  onClear,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.clientX + 8, top: menu.clientY + 8 });

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`context-menu-panel fixed z-30 w-52 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {hasCopiedItem && (
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
      <button className={MENU_ITEM_CLASS} onClick={() => onCreateTextBlock(menu.clientX, menu.clientY)}>
        <IconNotes size={17} stroke={2} />
        <span>Text block</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_ITEM_CLASS} onClick={() => onCreateImage(menu.clientX, menu.clientY)}>
        <IconPhoto size={17} stroke={2} />
        <span>Image</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <button
        className="flex h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300"
        onClick={onClear}
      >
        <IconTrash size={17} stroke={2} />
        <span>Clear canvas</span>
      </button>
    </div>
  );
}

type TextBlockContextMenuProps = {
  menu: { id: string; left: number; top: number };
  element: TextBlockElement;
  closing: boolean;
  onStartEdit: (element: TextBlockElement) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  onCopy: (element: TextBlockElement) => void;
  onRemovePrivacyExtension: (id: string) => void;
  onRemoveLockExtension: (id: string) => void;
  onRemoveColorsExtension: (id: string) => void;
  onMoveLayer: (
    id: string,
    direction: "back" | "backward" | "forward" | "front",
  ) => void;
  onDelete: (id: string) => void;
};

export function TextBlockContextMenu({
  menu,
  element,
  closing,
  onStartEdit,
  onUpdateAccent,
  onCopy,
  onRemovePrivacyExtension,
  onRemoveLockExtension,
  onRemoveColorsExtension,
  onMoveLayer,
  onDelete,
}: TextBlockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  const presets = element.extensions?.colors?.enabled ? ALL_ACCENT_PRESETS : ACCENT_PRESETS;

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`context-menu-panel fixed z-30 w-56 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button className={MENU_ITEM_CLASS} onClick={() => onStartEdit(element)}>
        <IconPencil size={17} stroke={2} />
        <span>Edit Text</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <div className="px-1 pb-2 pt-1.5">
        <div className="grid grid-cols-8 gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.accent}
              className="relative aspect-square rounded-md transition hover:ring-2 hover:ring-white/12"
              style={{ backgroundColor: preset.swatch }}
              onClick={() => onUpdateAccent(element.id, preset.accent)}
              title="Text block color"
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
      {(element.extensions?.privacy || element.extensions?.lock || element.extensions?.colors) && (
        <>
          <div className={MENU_DIVIDER_CLASS} />
          {element.extensions?.privacy && (
          <button className={MENU_ITEM_CLASS} onClick={() => onRemovePrivacyExtension(element.id)}>
            <IconPuzzle size={17} stroke={2} />
            <span>Remove privacy</span>
          </button>
          )}
          {element.extensions?.lock && (
          <button className={MENU_ITEM_CLASS} onClick={() => onRemoveLockExtension(element.id)}>
            <IconPuzzle size={17} stroke={2} />
            <span>Remove lock</span>
          </button>
          )}
          {element.extensions?.colors && (
          <button className={MENU_ITEM_CLASS} onClick={() => onRemoveColorsExtension(element.id)}>
            <IconPuzzle size={17} stroke={2} />
            <span>Remove more colors</span>
          </button>
          )}
        </>
      )}
      <div className={MENU_DIVIDER_CLASS} />
      <button
        className="flex h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300"
        onClick={() => onDelete(element.id)}
      >
        <IconTrash size={17} stroke={2} />
        <span>Remove</span>
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
  onUpdateLink: (id: string, link: string) => void;
  onCopy: (card: TextCardElement) => void;
  onRemoveColorsExtension: (id: string) => void;
  onDelete: (id: string) => void;
};

export function TextCardContextMenu({
  menu,
  card,
  closing,
  onStartEdit,
  onUpdateAccent,
  onUpdateLink,
  onCopy,
  onRemoveColorsExtension,
  onDelete,
}: TextCardContextMenuProps) {
  const activeAccent = getTextCardAccent(card.accent);
  const presets = card.extensions?.colors?.enabled ? ALL_ACCENT_PRESETS : ACCENT_PRESETS;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const linkButtonRef = useRef<HTMLButtonElement | null>(null);
  const linkMenuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  const [linkMenuPreferredPosition, setLinkMenuPreferredPosition] = useState({
    left: position.left + 232,
    top: position.top,
  });
  const linkMenuPosition = useClampedFixedPosition(linkMenuRef, linkMenuPreferredPosition);
  const [linkDraft, setLinkDraft] = useState(card.link ?? "");
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);

  useEffect(() => {
    setLinkDraft(card.link ?? "");
  }, [card.id, card.link]);

  useLayoutEffect(() => {
    if (!linkMenuOpen) {
      return;
    }

    const buttonRect = linkButtonRef.current?.getBoundingClientRect();
    if (!buttonRect) {
      return;
    }

    setLinkMenuPreferredPosition({
      left: buttonRect.right + 8,
      top: buttonRect.top,
    });
  }, [linkMenuOpen, position.left, position.top]);

  const saveLink = () => {
    onUpdateLink(card.id, linkDraft);
  };

  return (
    <>
      <div
        ref={menuRef}
        data-context-menu
        className={`context-menu-panel fixed z-30 w-56 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] ${
          closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
        }`}
        style={position}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button className={MENU_ITEM_CLASS} onClick={() => onStartEdit(card)}>
          <IconPencil size={17} stroke={2} />
          <span>Edit Text</span>
        </button>
        <div className={MENU_DIVIDER_CLASS} />
        <div className="px-1 pb-2 pt-1.5">
          <div className="grid grid-cols-8 gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.textCardAccent}
                className="relative aspect-square rounded-md transition hover:ring-2 hover:ring-white/12"
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
          ref={linkButtonRef}
          className={MENU_ITEM_CLASS}
          onClick={() => setLinkMenuOpen((current) => !current)}
        >
          <IconLink size={17} stroke={2} />
          <span>Hyperlink</span>
        </button>
        <div className={MENU_DIVIDER_CLASS} />
        <button className={MENU_ITEM_CLASS} onClick={() => onCopy(card)}>
          <IconCopy size={17} stroke={2} />
          <span>Copy</span>
        </button>
        {card.extensions?.colors && (
          <>
            <div className={MENU_DIVIDER_CLASS} />
            <button className={MENU_ITEM_CLASS} onClick={() => onRemoveColorsExtension(card.id)}>
              <IconPuzzle size={17} stroke={2} />
              <span>Remove more colors</span>
            </button>
          </>
        )}
        <div className={MENU_DIVIDER_CLASS} />
        <button
          className="flex h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300"
          onClick={() => onDelete(card.id)}
        >
          <IconTrash size={17} stroke={2} />
          <span>Remove</span>
        </button>
      </div>

      {linkMenuOpen && !closing && (
        <div
          ref={linkMenuRef}
          data-context-menu
          className="context-menu-panel context-menu-enter fixed z-30 w-72 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)]"
          style={linkMenuPosition}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-1 px-2 py-1.5">
            <input
              className="h-8 min-w-0 flex-1 rounded-md border border-white/[0.12] bg-black/[0.18] px-2 text-[13px] text-white outline-none placeholder:text-white/28 focus:border-white/35"
              value={linkDraft}
              placeholder="https://example.com or C:\path\file"
              spellCheck={false}
              onChange={(event) => setLinkDraft(event.target.value)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  saveLink();
                }

                if (event.key === "Escape") {
                  setLinkDraft(card.link ?? "");
                }
              }}
            />
            <button
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/65 transition-colors hover:bg-white/[0.10] hover:text-white"
              onClick={saveLink}
              title="Save hyperlink"
            >
              <IconCheck size={17} stroke={2} />
            </button>
            <button
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/[0.10] hover:text-white/80"
              onClick={() => setLinkMenuOpen(false)}
              title="Close hyperlink menu"
            >
              <IconX size={17} stroke={2} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

type ImageContextMenuProps = {
  menu: { id: string; left: number; top: number };
  image: ImageElement;
  closing: boolean;
  onReplace: (id: string) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  onToggleBackground: (id: string) => void;
  onMoveLayer: (id: string, direction: "back" | "backward" | "forward" | "front") => void;
  onCopy: (image: ImageElement) => void;
  onRemoveLockExtension: (id: string) => void;
  onRemoveColorsExtension: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ImageContextMenu({
  menu,
  image,
  closing,
  onReplace,
  onUpdateAccent,
  onToggleBackground,
  onMoveLayer,
  onCopy,
  onRemoveLockExtension,
  onRemoveColorsExtension,
  onDelete,
}: ImageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  const presets = image.extensions?.colors?.enabled ? ALL_ACCENT_PRESETS : ACCENT_PRESETS;

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`context-menu-panel fixed z-30 w-56 rounded-xl border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-sm text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button className={MENU_ITEM_CLASS} onClick={() => onReplace(image.id)}>
        <IconPhoto size={17} stroke={2} />
        <span>Replace image</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <div className="px-1 pb-2 pt-1.5">
        <div className="grid grid-cols-8 gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.accent}
              className="relative aspect-square rounded-md transition hover:ring-2 hover:ring-white/12"
              style={{ backgroundColor: preset.swatch }}
              onClick={() => onUpdateAccent(image.id, preset.accent)}
              title="Image frame color"
            >
              {image.accent === preset.accent && (
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
            onClick={() => onMoveLayer(image.id, "back")}
            title="Send to back"
          >
            <IconArrowAutofitDown size={20} stroke={2} />
          </button>
          <button
            className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
            onClick={() => onMoveLayer(image.id, "backward")}
            title="Send one layer back"
          >
            <IconArrowAutofitDownFilled size={20} />
          </button>
          <button
            className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
            onClick={() => onMoveLayer(image.id, "forward")}
            title="Bring one layer forward"
          >
            <IconArrowAutofitUpFilled size={20} />
          </button>
          <button
            className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
            onClick={() => onMoveLayer(image.id, "front")}
            title="Bring to front"
          >
            <IconArrowAutofitUp size={20} stroke={2} />
          </button>
        </div>
      </div>
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_ITEM_CLASS} onClick={() => onToggleBackground(image.id)}>
        {image.background === false ? <IconSquare size={17} stroke={2} /> : <IconSquareOff size={17} stroke={2} />}
        <span>{image.background === false ? "Show background" : "Hide background"}</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_ITEM_CLASS} onClick={() => onCopy(image)}>
        <IconCopy size={17} stroke={2} />
        <span>Copy</span>
      </button>
      {(image.extensions?.lock || image.extensions?.colors) && (
        <>
          <div className={MENU_DIVIDER_CLASS} />
          {image.extensions?.lock && (
          <button className={MENU_ITEM_CLASS} onClick={() => onRemoveLockExtension(image.id)}>
            <IconPuzzle size={17} stroke={2} />
            <span>Remove lock</span>
          </button>
          )}
          {image.extensions?.colors && (
          <button className={MENU_ITEM_CLASS} onClick={() => onRemoveColorsExtension(image.id)}>
            <IconPuzzle size={17} stroke={2} />
            <span>Remove more colors</span>
          </button>
          )}
        </>
      )}
      <div className={MENU_DIVIDER_CLASS} />
      <button
        className="flex h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#ff4949] transition-colors hover:bg-white/[0.10] hover:text-red-300"
        onClick={() => onDelete(image.id)}
      >
        <IconTrash size={17} stroke={2} />
        <span>Remove</span>
      </button>
    </div>
  );
}
