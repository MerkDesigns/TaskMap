import {
  IconArrowAutofitDown,
  IconArrowAutofitDownFilled,
  IconArrowAutofitUp,
  IconArrowAutofitUpFilled,
  IconCopy,
  IconCut,
  IconCheck,
  IconBox,
  IconLink,
  IconLock,
  IconLockOpen,
  IconPencil,
  IconNotes,
  IconPalette,
  IconPhoto,
  IconSquare,
  IconSquareOff,
  IconSitemap,
  IconTerminal2,
  IconTextSize,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ACCENT_PRESETS,
  CONTEXT_MENU_PANEL_CLASS,
  getTextCardAccent,
  MENU_DANGER_ITEM_CLASS,
  MENU_DIVIDER_CLASS,
  MENU_ITEM_CLASS,
} from "../constants";
import {
  ContainerElement,
  ContainerMenuState,
  ImageElement,
  MindmapConnection,
  TextBlockElement,
  TextCardElement,
} from "../types";
import { useClampedFixedPosition } from "../useClampedFixedPosition";
import { Tooltip } from "../ui/primitives/Tooltip";
import { ColorPickerMenu } from "./ColorPickerMenu";

const REMOVE_EXTENSIONS_TITLE_CLASS = "px-2 pb-1 pt-0.5 text-[11px] font-semibold text-white/45";

type ContainerContextMenuProps = {
  menu: ContainerMenuState;
  element: ContainerElement;
  closing: boolean;
  isMultiTarget?: boolean;
  extensionState?: Partial<
    Record<
      | "privacy"
      | "search"
      | "sorting"
      | "lock"
      | "colorPicker"
      | "autoCheckbox"
      | "dailyReset"
      | "counter"
      | "inheritCardColor"
      | "pickCard"
      | "copyPasteJson",
      boolean
    >
  >;
  onStartRename: (element: ContainerElement) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  onCut: (element: ContainerElement) => void;
  onCopy: (element: ContainerElement) => void;
  onRemovePrivacyExtension: (id: string) => void;
  onRemoveSearchExtension: (id: string) => void;
  onRemoveSortingExtension: (id: string) => void;
  onRemoveLockExtension: (id: string) => void;
  onRemoveColorPickerExtension: (id: string) => void;
  onRemoveAutoCheckboxExtension: (id: string) => void;
  onRemoveDailyResetExtension: (id: string) => void;
  onRemoveCounterExtension: (id: string) => void;
  onRemoveInheritCardColorExtension: (id: string) => void;
  onRemovePickCardExtension: (id: string) => void;
  onRemoveCopyPasteJsonExtension: (id: string) => void;
  onMoveLayer: (id: string, direction: "back" | "backward" | "forward" | "front") => void;
  onDelete: (id: string) => void;
};

export function ContainerContextMenu({
  menu,
  element,
  closing,
  isMultiTarget = false,
  extensionState,
  onStartRename,
  onUpdateAccent,
  onCut,
  onCopy,
  onRemovePrivacyExtension,
  onRemoveSearchExtension,
  onRemoveSortingExtension,
  onRemoveLockExtension,
  onRemoveColorPickerExtension,
  onRemoveAutoCheckboxExtension,
  onRemoveDailyResetExtension,
  onRemoveCounterExtension,
  onRemoveInheritCardColorExtension,
  onRemovePickCardExtension,
  onRemoveCopyPasteJsonExtension,
  onMoveLayer,
  onDelete,
}: ContainerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  const extensions = extensionState ?? {
    privacy: Boolean(element.extensions?.privacy),
    search: Boolean(element.extensions?.search),
    sorting: Boolean(element.extensions?.sorting),
    lock: Boolean(element.extensions?.lock),
    colorPicker: Boolean(element.extensions?.colorPicker),
    autoCheckbox: Boolean(element.extensions?.autoCheckbox),
    dailyReset: Boolean(element.extensions?.dailyReset),
    counter: Boolean(element.extensions?.counter),
    inheritCardColor: Boolean(element.extensions?.inheritCardColor),
    pickCard: Boolean(element.extensions?.pickCard),
    copyPasteJson: Boolean(element.extensions?.copyPasteJson),
  };
  const presets = ACCENT_PRESETS;

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`${CONTEXT_MENU_PANEL_CLASS} ${
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
        <div className="grid grid-cols-8 gap-1">
          {presets.map((preset) => (
            <button
              key={preset.accent}
              className="relative aspect-square rounded-[2px] outline-none"
              style={{ backgroundColor: preset.swatch }}
              onClick={() => onUpdateAccent(element.id, preset.accent)}
            >
              {element.accent === preset.accent && (
                <span className="absolute inset-[4px] rounded-[1px] bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={MENU_DIVIDER_CLASS} />
      <div className="px-1 py-1">
        <div className="grid grid-cols-4 gap-1">
          <Tooltip label="Send to back" openDelayMs={1000}>
            <button
              aria-label="Send to back"
              className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
              onClick={() => onMoveLayer(element.id, "back")}
            >
              <IconArrowAutofitDown size={20} stroke={2} />
            </button>
          </Tooltip>
          <Tooltip label="Send one layer back" openDelayMs={1000}>
            <button
              aria-label="Send one layer back"
              className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
              onClick={() => onMoveLayer(element.id, "backward")}
            >
              <IconArrowAutofitDownFilled size={20} />
            </button>
          </Tooltip>
          <Tooltip label="Bring one layer forward" openDelayMs={1000}>
            <button
              aria-label="Bring one layer forward"
              className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
              onClick={() => onMoveLayer(element.id, "forward")}
            >
              <IconArrowAutofitUpFilled size={20} />
            </button>
          </Tooltip>
          <Tooltip label="Bring to front" openDelayMs={1000}>
            <button
              aria-label="Bring to front"
              className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
              onClick={() => onMoveLayer(element.id, "front")}
            >
              <IconArrowAutofitUp size={20} stroke={2} />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_ITEM_CLASS} onClick={() => onCut(element)}>
        <IconCut size={17} stroke={2} />
        <span>{isMultiTarget ? "Cut selected" : "Cut"}</span>
      </button>
      <button className={MENU_ITEM_CLASS} onClick={() => onCopy(element)}>
        <IconCopy size={17} stroke={2} />
        <span>{isMultiTarget ? "Copy selected" : "Copy"}</span>
      </button>
      {(extensions.privacy ||
        extensions.search ||
        extensions.sorting ||
        extensions.lock ||
        extensions.colorPicker ||
        extensions.autoCheckbox ||
        extensions.dailyReset ||
        extensions.counter ||
        extensions.inheritCardColor ||
        extensions.pickCard ||
        extensions.copyPasteJson) && (
        <>
          <div className={MENU_DIVIDER_CLASS} />
          <div className={REMOVE_EXTENSIONS_TITLE_CLASS}>Remove Extensions</div>
          {extensions.privacy && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemovePrivacyExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Privacy</span>
            </button>
          )}
          {extensions.search && (
            <button className={MENU_ITEM_CLASS} onClick={() => onRemoveSearchExtension(element.id)}>
              <IconTrash size={17} stroke={2} />
              <span>Search</span>
            </button>
          )}
          {extensions.sorting && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemoveSortingExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Sorting</span>
            </button>
          )}
          {extensions.lock && (
            <button className={MENU_ITEM_CLASS} onClick={() => onRemoveLockExtension(element.id)}>
              <IconTrash size={17} stroke={2} />
              <span>Lock</span>
            </button>
          )}
          {extensions.colorPicker && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemoveColorPickerExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Extra colors</span>
            </button>
          )}
          {extensions.autoCheckbox && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemoveAutoCheckboxExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Auto checkboxes</span>
            </button>
          )}
          {extensions.dailyReset && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemoveDailyResetExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Daily Resets</span>
            </button>
          )}
          {extensions.counter && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemoveCounterExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Counter</span>
            </button>
          )}
          {extensions.inheritCardColor && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemoveInheritCardColorExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Inherit Card Color</span>
            </button>
          )}
          {extensions.pickCard && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemovePickCardExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Pick a Card</span>
            </button>
          )}
          {extensions.copyPasteJson && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemoveCopyPasteJsonExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Copy/Paste JSON</span>
            </button>
          )}
        </>
      )}
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_DANGER_ITEM_CLASS} onClick={() => onDelete(element.id)}>
        <IconTrash size={17} stroke={2} />
        <span>{isMultiTarget ? "Remove selected" : "Remove"}</span>
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
  onCreateMindmap: (clientX: number, clientY: number) => void;
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
  const position = useClampedFixedPosition(menuRef, {
    left: menu.clientX + 8,
    top: menu.clientY + 8,
  });

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`${CONTEXT_MENU_PANEL_CLASS} ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {hasCopiedItem && (
        <>
          <button
            className={`${MENU_ITEM_CLASS} group`}
            onClick={() => onPaste(menu.clientX, menu.clientY, menu.containerId)}
          >
            <IconCopy size={17} stroke={2} />
            <span className="text-[#7debe1] transition-colors group-hover:text-[#9af3eb]">
              Paste
            </span>
          </button>
          <div className={MENU_DIVIDER_CLASS} />
        </>
      )}
      <button
        className={MENU_ITEM_CLASS}
        onClick={() => onCreateTextCard(menu.containerId, menu.clientX, menu.clientY)}
      >
        <IconTextSize size={17} stroke={2} />
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
  onCreateMindmap,
  onClear,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, {
    left: menu.clientX + 8,
    top: menu.clientY + 8,
  });

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`${CONTEXT_MENU_PANEL_CLASS} ${
        closing ? "context-menu-exit pointer-events-none" : "context-menu-enter"
      }`}
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {hasCopiedItem && (
        <button
          className={`${MENU_ITEM_CLASS} group`}
          onClick={() => onPaste(menu.clientX, menu.clientY)}
        >
          <IconCopy size={17} stroke={2} />
          <span className="text-[#7debe1] transition-colors group-hover:text-[#9af3eb]">
            Paste
          </span>
        </button>
      )}
      <button
        className={MENU_ITEM_CLASS}
        onClick={() => onCreateTextCard(menu.clientX, menu.clientY)}
      >
        <IconTextSize size={17} stroke={2} />
        <span>Create text card</span>
      </button>
      <button className={MENU_ITEM_CLASS} onClick={() => onCreate(menu.clientX, menu.clientY)}>
        <IconBox size={17} stroke={2} />
        <span>Create container</span>
      </button>
      <button
        className={MENU_ITEM_CLASS}
        onClick={() => onCreateTextBlock(menu.clientX, menu.clientY)}
      >
        <IconNotes size={17} stroke={2} />
        <span>Create text block</span>
      </button>
      <button
        className={MENU_ITEM_CLASS}
        onClick={() => onCreateMindmap(menu.clientX, menu.clientY)}
      >
        <IconSitemap size={17} stroke={2} />
        <span>Create mindmap</span>
      </button>
      <button className={MENU_ITEM_CLASS} onClick={() => onCreateImage(menu.clientX, menu.clientY)}>
        <IconPhoto size={17} stroke={2} />
        <span>Create image</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_DANGER_ITEM_CLASS} onClick={onClear}>
        <IconTrash size={17} stroke={2} />
        <span>Clear canvas</span>
      </button>
    </div>
  );
}

type MindmapConnectionContextMenuProps = {
  menu: { id: string; left: number; top: number };
  connection: MindmapConnection;
  onDelete: (id: string) => void;
};

export function MindmapConnectionContextMenu({
  menu,
  connection,
  onDelete,
}: MindmapConnectionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`${CONTEXT_MENU_PANEL_CLASS} context-menu-enter`}
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button className={MENU_DANGER_ITEM_CLASS} onClick={() => onDelete(connection.id)}>
        <IconTrash size={17} stroke={2} />
        <span>Delete connection</span>
      </button>
    </div>
  );
}

type TextBlockContextMenuProps = {
  menu: { id: string; left: number; top: number };
  element: TextBlockElement;
  closing: boolean;
  isMultiTarget?: boolean;
  extensionState?: Partial<Record<"privacy" | "lock" | "colorPicker", boolean>>;
  onStartEdit: (element: TextBlockElement) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  onCut: (element: TextBlockElement) => void;
  onCopy: (element: TextBlockElement) => void;
  onRemovePrivacyExtension: (id: string) => void;
  onRemoveLockExtension: (id: string) => void;
  onRemoveColorPickerExtension: (id: string) => void;
  onMoveLayer: (id: string, direction: "back" | "backward" | "forward" | "front") => void;
  onDelete: (id: string) => void;
};

export function TextBlockContextMenu({
  menu,
  element,
  closing,
  isMultiTarget = false,
  extensionState,
  onStartEdit,
  onUpdateAccent,
  onCut,
  onCopy,
  onRemovePrivacyExtension,
  onRemoveLockExtension,
  onRemoveColorPickerExtension,
  onMoveLayer,
  onDelete,
}: TextBlockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  const extensions = extensionState ?? {
    privacy: Boolean(element.extensions?.privacy),
    lock: Boolean(element.extensions?.lock),
    colorPicker: Boolean(element.extensions?.colorPicker),
  };
  const presets = ACCENT_PRESETS;

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`${CONTEXT_MENU_PANEL_CLASS} ${
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
        <div className="grid grid-cols-8 gap-1">
          {presets.map((preset) => (
            <button
              key={preset.accent}
              className="relative aspect-square rounded-[2px] transition hover:ring-2 hover:ring-white/12"
              style={{ backgroundColor: preset.swatch }}
              onClick={() => onUpdateAccent(element.id, preset.accent)}
              title="Text block color"
            >
              {element.accent === preset.accent && (
                <span className="absolute inset-[4px] rounded-[1px] bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={MENU_DIVIDER_CLASS} />
      <div className="px-1 py-1">
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
      <button className={MENU_ITEM_CLASS} onClick={() => onCut(element)}>
        <IconCut size={17} stroke={2} />
        <span>{isMultiTarget ? "Cut selected" : "Cut"}</span>
      </button>
      <button className={MENU_ITEM_CLASS} onClick={() => onCopy(element)}>
        <IconCopy size={17} stroke={2} />
        <span>{isMultiTarget ? "Copy selected" : "Copy"}</span>
      </button>
      {(extensions.privacy || extensions.lock || extensions.colorPicker) && (
        <>
          <div className={MENU_DIVIDER_CLASS} />
          <div className={REMOVE_EXTENSIONS_TITLE_CLASS}>Remove Extensions</div>
          {extensions.privacy && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemovePrivacyExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Privacy</span>
            </button>
          )}
          {extensions.lock && (
            <button className={MENU_ITEM_CLASS} onClick={() => onRemoveLockExtension(element.id)}>
              <IconTrash size={17} stroke={2} />
              <span>Lock</span>
            </button>
          )}
          {extensions.colorPicker && (
            <button
              className={MENU_ITEM_CLASS}
              onClick={() => onRemoveColorPickerExtension(element.id)}
            >
              <IconTrash size={17} stroke={2} />
              <span>Extra colors</span>
            </button>
          )}
        </>
      )}
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_DANGER_ITEM_CLASS} onClick={() => onDelete(element.id)}>
        <IconTrash size={17} stroke={2} />
        <span>{isMultiTarget ? "Remove selected" : "Remove"}</span>
      </button>
    </div>
  );
}

type TextCardContextMenuProps = {
  menu: { id: string; left: number; top: number };
  card: TextCardElement;
  closing: boolean;
  isMultiTarget?: boolean;
  extensionState?: Partial<Record<"lock" | "colorPicker" | "checkbox" | "commandRunner", boolean>>;
  onStartEdit: (card: TextCardElement) => void;
  onEditCommand: (id: string) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  recentColors: string[];
  onRememberRecentColor: (color?: string) => void;
  onUpdateLink: (id: string, link: string) => void;
  onToggleLock: (id: string) => void;
  onCut: (card: TextCardElement) => void;
  onCopy: (card: TextCardElement) => void;
  onRemoveLockExtension: (id: string) => void;
  onRemoveColorPickerExtension: (id: string) => void;
  onRemoveCheckboxExtension: (id: string) => void;
  onRemoveCommandRunnerExtension: (id: string) => void;
  onMoveLayer: (id: string, direction: "back" | "backward" | "forward" | "front") => void;
  onDelete: (id: string) => void;
};

export function TextCardContextMenu({
  menu,
  card,
  closing,
  isMultiTarget = false,
  extensionState,
  onStartEdit,
  onEditCommand,
  onUpdateAccent,
  recentColors,
  onRememberRecentColor,
  onUpdateLink,
  onToggleLock,
  onCut,
  onCopy,
  onRemoveLockExtension,
  onRemoveColorPickerExtension,
  onRemoveCheckboxExtension,
  onRemoveCommandRunnerExtension,
  onMoveLayer,
  onDelete,
}: TextCardContextMenuProps) {
  const activeAccent = getTextCardAccent(card.accent);
  const extensions = extensionState ?? {
    lock: Boolean(card.extensions?.lock),
    colorPicker: Boolean(card.extensions?.colorPicker),
    checkbox: card.kind !== "mindmap" && Boolean(card.extensions?.checkbox),
    commandRunner: card.kind !== "mindmap" && Boolean(card.extensions?.commandRunner),
  };
  const presets = ACCENT_PRESETS;
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
  const [colorPickerPosition, setColorPickerPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    setLinkDraft(card.kind === "mindmap" ? "" : (card.link ?? ""));
  }, [card.id, card.kind, card.link]);

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
    if (card.kind !== "mindmap") {
      onUpdateLink(card.id, linkDraft);
    }
  };

  return (
    <>
      <div
        ref={menuRef}
        data-context-menu
        className={`${CONTEXT_MENU_PANEL_CLASS} ${
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
        {extensions.colorPicker && (
          <button
            className={MENU_ITEM_CLASS}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setColorPickerPosition({ left: rect.right + 8, top: rect.top });
            }}
          >
            <IconPalette size={17} stroke={2} />
            <span>Open color picker</span>
          </button>
        )}
        {card.kind !== "mindmap" && card.extensions?.commandRunner && (
          <button className={MENU_ITEM_CLASS} onClick={() => onEditCommand(card.id)}>
            <IconTerminal2 size={17} stroke={2} />
            <span>Edit Command</span>
          </button>
        )}
        {card.extensions?.lock && (
          <button className={MENU_ITEM_CLASS} onClick={() => onToggleLock(card.id)}>
            {card.extensions.lock.enabled ? (
              <IconLock size={17} stroke={2} />
            ) : (
              <IconLockOpen size={17} stroke={2} />
            )}
            <span>{card.extensions.lock.enabled ? "Locked" : "Unlocked"}</span>
          </button>
        )}
        <div className={MENU_DIVIDER_CLASS} />
        <div className="px-1 pb-2 pt-1.5">
          <div className="grid grid-cols-8 gap-1">
            {presets.map((preset) => (
              <button
                key={preset.textCardAccent}
                className="relative aspect-square rounded-[2px] transition hover:ring-2 hover:ring-white/12"
                style={{ backgroundColor: preset.swatch }}
                onClick={() => onUpdateAccent(card.id, preset.textCardAccent)}
                title="Text card color"
              >
                {activeAccent === preset.textCardAccent && (
                  <span className="absolute inset-[4px] rounded-[1px] bg-white" />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className={MENU_DIVIDER_CLASS} />
        {!card.containerId && (
          <>
            <div className="px-1 py-1">
              <div className="grid grid-cols-4 gap-1">
                <button
                  className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
                  onClick={() => onMoveLayer(card.id, "back")}
                  title="Send to back"
                >
                  <IconArrowAutofitDown size={20} stroke={2} />
                </button>
                <button
                  className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
                  onClick={() => onMoveLayer(card.id, "backward")}
                  title="Send one layer back"
                >
                  <IconArrowAutofitDownFilled size={20} />
                </button>
                <button
                  className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
                  onClick={() => onMoveLayer(card.id, "forward")}
                  title="Bring one layer forward"
                >
                  <IconArrowAutofitUpFilled size={20} />
                </button>
                <button
                  className="grid h-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/[0.10] hover:text-white"
                  onClick={() => onMoveLayer(card.id, "front")}
                  title="Bring to front"
                >
                  <IconArrowAutofitUp size={20} stroke={2} />
                </button>
              </div>
            </div>
            <div className={MENU_DIVIDER_CLASS} />
          </>
        )}
        {card.kind !== "mindmap" && (
          <>
            <button
              ref={linkButtonRef}
              className={MENU_ITEM_CLASS}
              onClick={() => setLinkMenuOpen((current) => !current)}
            >
              <IconLink size={17} stroke={2} />
              <span>Hyperlink</span>
            </button>
            <div className={MENU_DIVIDER_CLASS} />
          </>
        )}
        <button className={MENU_ITEM_CLASS} onClick={() => onCut(card)}>
          <IconCut size={17} stroke={2} />
          <span>{isMultiTarget ? "Cut selected" : "Cut"}</span>
        </button>
        <button className={MENU_ITEM_CLASS} onClick={() => onCopy(card)}>
          <IconCopy size={17} stroke={2} />
          <span>{isMultiTarget ? "Copy selected" : "Copy"}</span>
        </button>
        {(extensions.lock ||
          extensions.colorPicker ||
          extensions.checkbox ||
          extensions.commandRunner) && (
          <>
            <div className={MENU_DIVIDER_CLASS} />
            <div className={REMOVE_EXTENSIONS_TITLE_CLASS}>Remove Extensions</div>
            {extensions.lock && (
              <button className={MENU_ITEM_CLASS} onClick={() => onRemoveLockExtension(card.id)}>
                <IconTrash size={17} stroke={2} />
                <span>Lock</span>
              </button>
            )}
            {extensions.colorPicker && (
              <button
                className={MENU_ITEM_CLASS}
                onClick={() => onRemoveColorPickerExtension(card.id)}
              >
                <IconTrash size={17} stroke={2} />
                <span>Extra colors</span>
              </button>
            )}
            {extensions.checkbox && (
              <button
                className={MENU_ITEM_CLASS}
                onClick={() => onRemoveCheckboxExtension(card.id)}
              >
                <IconTrash size={17} stroke={2} />
                <span>Checkbox</span>
              </button>
            )}
            {extensions.commandRunner && (
              <button
                className={MENU_ITEM_CLASS}
                onClick={() => onRemoveCommandRunnerExtension(card.id)}
              >
                <IconTrash size={17} stroke={2} />
                <span>Command Runner</span>
              </button>
            )}
          </>
        )}
        <div className={MENU_DIVIDER_CLASS} />
        <button className={MENU_DANGER_ITEM_CLASS} onClick={() => onDelete(card.id)}>
          <IconTrash size={17} stroke={2} />
          <span>{isMultiTarget ? "Remove selected" : "Remove"}</span>
        </button>
      </div>

      {linkMenuOpen && card.kind !== "mindmap" && !closing && (
        <div
          ref={linkMenuRef}
          data-context-menu
          className="context-menu-panel context-menu-enter fixed z-[201] w-[230px] rounded-[9px] border border-white/[0.15] bg-[#1b1b1e] px-[5px] py-1 text-[12px] text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] [&_svg]:scale-[1.08]"
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

      {colorPickerPosition && !closing && (
        <ColorPickerMenu
          color={activeAccent}
          left={colorPickerPosition.left}
          top={colorPickerPosition.top}
          recentColors={recentColors}
          onChange={(accent) => onUpdateAccent(card.id, accent)}
          onClose={(recentColor) => {
            onRememberRecentColor(recentColor);
            setColorPickerPosition(null);
          }}
        />
      )}
    </>
  );
}

type ImageContextMenuProps = {
  menu: { id: string; left: number; top: number };
  image: ImageElement;
  closing: boolean;
  isMultiTarget?: boolean;
  extensionState?: Partial<Record<"lock", boolean>>;
  onReplace: (id: string) => void;
  onUpdateAccent: (id: string, accent: string) => void;
  onToggleBackground: (id: string) => void;
  onToggleLock: (id: string) => void;
  onMoveLayer: (id: string, direction: "back" | "backward" | "forward" | "front") => void;
  onCut: (image: ImageElement) => void;
  onCopy: (image: ImageElement) => void;
  onRemoveLockExtension: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ImageContextMenu({
  menu,
  image,
  closing,
  isMultiTarget = false,
  extensionState,
  onReplace,
  onUpdateAccent,
  onToggleBackground,
  onToggleLock,
  onMoveLayer,
  onCut,
  onCopy,
  onRemoveLockExtension,
  onDelete,
}: ImageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  const extensions = extensionState ?? {
    lock: Boolean(image.extensions?.lock),
  };
  const presets = ACCENT_PRESETS;

  return (
    <div
      ref={menuRef}
      data-context-menu
      className={`${CONTEXT_MENU_PANEL_CLASS} ${
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
      {image.extensions?.lock && (
        <button className={MENU_ITEM_CLASS} onClick={() => onToggleLock(image.id)}>
          {image.extensions.lock.enabled ? (
            <IconLock size={17} stroke={2} />
          ) : (
            <IconLockOpen size={17} stroke={2} />
          )}
          <span>{image.extensions.lock.enabled ? "Locked" : "Unlocked"}</span>
        </button>
      )}
      <div className={MENU_DIVIDER_CLASS} />
      <div className="px-1 pb-2 pt-1.5">
        <div className="grid grid-cols-8 gap-1">
          {presets.map((preset) => (
            <button
              key={preset.accent}
              className="relative aspect-square rounded-[2px] transition hover:ring-2 hover:ring-white/12"
              style={{ backgroundColor: preset.swatch }}
              onClick={() => onUpdateAccent(image.id, preset.accent)}
              title="Image frame color"
            >
              {image.accent === preset.accent && (
                <span className="absolute inset-[4px] rounded-[1px] bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={MENU_DIVIDER_CLASS} />
      <div className="px-1 py-1">
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
        {image.background === false ? (
          <IconSquare size={17} stroke={2} />
        ) : (
          <IconSquareOff size={17} stroke={2} />
        )}
        <span>{image.background === false ? "Show background" : "Hide background"}</span>
      </button>
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_ITEM_CLASS} onClick={() => onCut(image)}>
        <IconCut size={17} stroke={2} />
        <span>{isMultiTarget ? "Cut selected" : "Cut"}</span>
      </button>
      <button className={MENU_ITEM_CLASS} onClick={() => onCopy(image)}>
        <IconCopy size={17} stroke={2} />
        <span>{isMultiTarget ? "Copy selected" : "Copy"}</span>
      </button>
      {extensions.lock && (
        <>
          <div className={MENU_DIVIDER_CLASS} />
          <div className={REMOVE_EXTENSIONS_TITLE_CLASS}>Remove Extensions</div>
          {extensions.lock && (
            <button className={MENU_ITEM_CLASS} onClick={() => onRemoveLockExtension(image.id)}>
              <IconTrash size={17} stroke={2} />
              <span>Lock</span>
            </button>
          )}
        </>
      )}
      <div className={MENU_DIVIDER_CLASS} />
      <button className={MENU_DANGER_ITEM_CLASS} onClick={() => onDelete(image.id)}>
        <IconTrash size={17} stroke={2} />
        <span>{isMultiTarget ? "Remove selected" : "Remove"}</span>
      </button>
    </div>
  );
}
