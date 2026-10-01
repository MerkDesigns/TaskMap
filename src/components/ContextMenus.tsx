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
  IconTextSize,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ACCENT_PRESETS, getTextCardAccent } from "../constants";
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
import { IconButton } from "../ui/primitives/Button";
import { TextField } from "../ui/primitives/FormControls";
import { ContextMenuSurface } from "../ui/primitives/ContextMenu";
import {
  ContextMenuActionGroup,
  ContextMenuDivider,
  ContextMenuIconAction,
  ContextMenuItem,
  ContextMenuSection,
  ContextMenuSwatch,
  ContextMenuSwatches,
} from "../ui/primitives/ContextMenuParts";
import { ColorPickerMenu } from "./ColorPickerMenu";

type ContainerContextMenuProps = {
  menu: ContainerMenuState;
  element: ContainerElement;
  closing: boolean;
  isMultiTarget?: boolean;
  extensionState?: Partial<
    Record<
      | "privacy"
      | "search"
      | "lock"
      | "colorPicker"
      | "autoCheckbox"
      | "counter"
      | "inheritCardColor"
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
  onRemoveLockExtension: (id: string) => void;
  onRemoveColorPickerExtension: (id: string) => void;
  onRemoveAutoCheckboxExtension: (id: string) => void;
  onRemoveCounterExtension: (id: string) => void;
  onRemoveInheritCardColorExtension: (id: string) => void;
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
  onRemoveLockExtension,
  onRemoveColorPickerExtension,
  onRemoveAutoCheckboxExtension,
  onRemoveCounterExtension,
  onRemoveInheritCardColorExtension,
  onRemoveCopyPasteJsonExtension,
  onMoveLayer,
  onDelete,
}: ContainerContextMenuProps) {
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  const extensions = extensionState ?? {
    privacy: Boolean(element.extensions?.privacy),
    search: Boolean(element.extensions?.search),
    lock: Boolean(element.extensions?.lock),
    colorPicker: Boolean(element.extensions?.colorPicker),
    autoCheckbox: Boolean(element.extensions?.autoCheckbox),
    counter: Boolean(element.extensions?.counter),
    inheritCardColor: Boolean(element.extensions?.inheritCardColor),
    copyPasteJson: Boolean(element.extensions?.copyPasteJson),
  };
  const presets = ACCENT_PRESETS;

  return (
    <ContextMenuSurface
      ref={menuRef}
      label="Container menu"
      motionState={closing ? "closing" : "open"}
      position={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <ContextMenuItem
        icon={<IconPencil size={17} stroke={2} />}
        onClick={() => onStartRename(element)}
      >
        Edit Container
      </ContextMenuItem>
      <ContextMenuDivider />
      <ContextMenuSwatches>
        {presets.map((preset) => (
          <ContextMenuSwatch
            key={preset.accent}
            color={preset.swatch}
            selected={element.accent === preset.accent}
            aria-label={`Container accent ${preset.swatch}`}
            onClick={() => onUpdateAccent(element.id, preset.accent)}
          />
        ))}
      </ContextMenuSwatches>
      <ContextMenuDivider />
      <ContextMenuActionGroup label="Layer order">
        <Tooltip label="Send to back" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Send to back"
            icon={<IconArrowAutofitDown size={20} stroke={2} />}
            onClick={() => onMoveLayer(element.id, "back")}
          />
        </Tooltip>
        <Tooltip label="Send one layer back" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Send one layer back"
            icon={<IconArrowAutofitDownFilled size={20} />}
            onClick={() => onMoveLayer(element.id, "backward")}
          />
        </Tooltip>
        <Tooltip label="Bring one layer forward" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Bring one layer forward"
            icon={<IconArrowAutofitUpFilled size={20} />}
            onClick={() => onMoveLayer(element.id, "forward")}
          />
        </Tooltip>
        <Tooltip label="Bring to front" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Bring to front"
            icon={<IconArrowAutofitUp size={20} stroke={2} />}
            onClick={() => onMoveLayer(element.id, "front")}
          />
        </Tooltip>
      </ContextMenuActionGroup>
      <ContextMenuDivider />
      <ContextMenuItem icon={<IconCut size={17} stroke={2} />} onClick={() => onCut(element)}>
        {isMultiTarget ? "Cut selected" : "Cut"}
      </ContextMenuItem>
      <ContextMenuItem icon={<IconCopy size={17} stroke={2} />} onClick={() => onCopy(element)}>
        {isMultiTarget ? "Copy selected" : "Copy"}
      </ContextMenuItem>
      {(extensions.privacy ||
        extensions.search ||
        extensions.lock ||
        extensions.colorPicker ||
        extensions.autoCheckbox ||
        extensions.counter ||
        extensions.inheritCardColor ||
        extensions.copyPasteJson) && (
        <>
          <ContextMenuDivider />
          <ContextMenuSection label="Remove Extensions">
            {extensions.privacy && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemovePrivacyExtension(element.id)}
              >
                Privacy
              </ContextMenuItem>
            )}
            {extensions.search && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemoveSearchExtension(element.id)}
              >
                Search
              </ContextMenuItem>
            )}
            {extensions.lock && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemoveLockExtension(element.id)}
              >
                Lock
              </ContextMenuItem>
            )}
            {extensions.colorPicker && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemoveColorPickerExtension(element.id)}
              >
                Extra colors
              </ContextMenuItem>
            )}
            {extensions.autoCheckbox && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemoveAutoCheckboxExtension(element.id)}
              >
                Auto checkboxes
              </ContextMenuItem>
            )}
            {extensions.counter && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemoveCounterExtension(element.id)}
              >
                Counter
              </ContextMenuItem>
            )}
            {extensions.inheritCardColor && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemoveInheritCardColorExtension(element.id)}
              >
                Inherit Card Color
              </ContextMenuItem>
            )}
            {extensions.copyPasteJson && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemoveCopyPasteJsonExtension(element.id)}
              >
                Copy/Paste JSON
              </ContextMenuItem>
            )}
          </ContextMenuSection>
        </>
      )}
      <ContextMenuDivider />
      <ContextMenuItem
        danger
        icon={<IconTrash size={17} stroke={2} />}
        onClick={() => onDelete(element.id)}
      >
        {isMultiTarget ? "Remove selected" : "Remove"}
      </ContextMenuItem>
    </ContextMenuSurface>
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
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, {
    left: menu.clientX + 8,
    top: menu.clientY + 8,
  });

  return (
    <ContextMenuSurface
      ref={menuRef}
      label="Container content menu"
      motionState={closing ? "closing" : "open"}
      position={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {hasCopiedItem && (
        <>
          <ContextMenuItem
            icon={<IconCopy size={17} stroke={2} />}
            onClick={() => onPaste(menu.clientX, menu.clientY, menu.containerId)}
          >
            Paste
          </ContextMenuItem>
          <ContextMenuDivider />
        </>
      )}
      <ContextMenuItem
        icon={<IconTextSize size={17} stroke={2} />}
        onClick={() => onCreateTextCard(menu.containerId, menu.clientX, menu.clientY)}
      >
        Create text card
      </ContextMenuItem>
    </ContextMenuSurface>
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
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, {
    left: menu.clientX + 8,
    top: menu.clientY + 8,
  });

  return (
    <ContextMenuSurface
      ref={menuRef}
      label="Canvas menu"
      motionState={closing ? "closing" : "open"}
      position={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {hasCopiedItem && (
        <ContextMenuItem
          icon={<IconCopy size={17} stroke={2} />}
          onClick={() => onPaste(menu.clientX, menu.clientY)}
        >
          Paste
        </ContextMenuItem>
      )}
      <ContextMenuItem
        icon={<IconTextSize size={17} stroke={2} />}
        onClick={() => onCreateTextCard(menu.clientX, menu.clientY)}
      >
        Create text card
      </ContextMenuItem>
      <ContextMenuItem
        icon={<IconBox size={17} stroke={2} />}
        onClick={() => onCreate(menu.clientX, menu.clientY)}
      >
        Create container
      </ContextMenuItem>
      <ContextMenuItem
        icon={<IconNotes size={17} stroke={2} />}
        onClick={() => onCreateTextBlock(menu.clientX, menu.clientY)}
      >
        Create text block
      </ContextMenuItem>
      <ContextMenuItem
        icon={<IconSitemap size={17} stroke={2} />}
        onClick={() => onCreateMindmap(menu.clientX, menu.clientY)}
      >
        Create mindmap
      </ContextMenuItem>
      <ContextMenuItem
        icon={<IconPhoto size={17} stroke={2} />}
        onClick={() => onCreateImage(menu.clientX, menu.clientY)}
      >
        Create image
      </ContextMenuItem>
      <ContextMenuDivider />
      <ContextMenuItem danger icon={<IconTrash size={17} stroke={2} />} onClick={onClear}>
        Clear canvas
      </ContextMenuItem>
    </ContextMenuSurface>
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
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  return (
    <ContextMenuSurface
      ref={menuRef}
      label="Connection menu"
      position={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <ContextMenuItem
        danger
        icon={<IconTrash size={17} stroke={2} />}
        onClick={() => onDelete(connection.id)}
      >
        Delete connection
      </ContextMenuItem>
    </ContextMenuSurface>
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
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  const extensions = extensionState ?? {
    privacy: Boolean(element.extensions?.privacy),
    lock: Boolean(element.extensions?.lock),
    colorPicker: Boolean(element.extensions?.colorPicker),
  };
  const presets = ACCENT_PRESETS;

  return (
    <ContextMenuSurface
      ref={menuRef}
      label="Text block menu"
      motionState={closing ? "closing" : "open"}
      position={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <ContextMenuItem
        icon={<IconPencil size={17} stroke={2} />}
        onClick={() => onStartEdit(element)}
      >
        Edit Text
      </ContextMenuItem>
      <ContextMenuDivider />
      <ContextMenuSwatches>
        {presets.map((preset) => (
          <ContextMenuSwatch
            key={preset.accent}
            color={preset.swatch}
            selected={element.accent === preset.accent}
            title="Text block color"
            aria-label={`Text block color ${preset.swatch}`}
            onClick={() => onUpdateAccent(element.id, preset.accent)}
          />
        ))}
      </ContextMenuSwatches>
      <ContextMenuDivider />
      <ContextMenuActionGroup label="Layer order">
        <Tooltip label="Send to back" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Send to back"
            icon={<IconArrowAutofitDown size={20} stroke={2} />}
            onClick={() => onMoveLayer(element.id, "back")}
          />
        </Tooltip>
        <Tooltip label="Send one layer back" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Send one layer back"
            icon={<IconArrowAutofitDownFilled size={20} />}
            onClick={() => onMoveLayer(element.id, "backward")}
          />
        </Tooltip>
        <Tooltip label="Bring one layer forward" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Bring one layer forward"
            icon={<IconArrowAutofitUpFilled size={20} />}
            onClick={() => onMoveLayer(element.id, "forward")}
          />
        </Tooltip>
        <Tooltip label="Bring to front" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Bring to front"
            icon={<IconArrowAutofitUp size={20} stroke={2} />}
            onClick={() => onMoveLayer(element.id, "front")}
          />
        </Tooltip>
      </ContextMenuActionGroup>
      <ContextMenuDivider />
      <ContextMenuItem icon={<IconCut size={17} stroke={2} />} onClick={() => onCut(element)}>
        {isMultiTarget ? "Cut selected" : "Cut"}
      </ContextMenuItem>
      <ContextMenuItem icon={<IconCopy size={17} stroke={2} />} onClick={() => onCopy(element)}>
        {isMultiTarget ? "Copy selected" : "Copy"}
      </ContextMenuItem>
      {(extensions.privacy || extensions.lock || extensions.colorPicker) && (
        <>
          <ContextMenuDivider />
          <ContextMenuSection label="Remove Extensions">
            {extensions.privacy && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemovePrivacyExtension(element.id)}
              >
                Privacy
              </ContextMenuItem>
            )}
            {extensions.lock && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemoveLockExtension(element.id)}
              >
                Lock
              </ContextMenuItem>
            )}
            {extensions.colorPicker && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemoveColorPickerExtension(element.id)}
              >
                Extra colors
              </ContextMenuItem>
            )}
          </ContextMenuSection>
        </>
      )}
      <ContextMenuDivider />
      <ContextMenuItem
        danger
        icon={<IconTrash size={17} stroke={2} />}
        onClick={() => onDelete(element.id)}
      >
        {isMultiTarget ? "Remove selected" : "Remove"}
      </ContextMenuItem>
    </ContextMenuSurface>
  );
}

type TextCardContextMenuProps = {
  menu: { id: string; left: number; top: number };
  card: TextCardElement;
  closing: boolean;
  isMultiTarget?: boolean;
  extensionState?: Partial<Record<"lock" | "colorPicker" | "checkbox", boolean>>;
  onStartEdit: (card: TextCardElement) => void;
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
  onMoveLayer,
  onDelete,
}: TextCardContextMenuProps) {
  const activeAccent = getTextCardAccent(card.accent);
  const extensions = extensionState ?? {
    lock: Boolean(card.extensions?.lock),
    colorPicker: Boolean(card.extensions?.colorPicker),
    checkbox: card.kind !== "mindmap" && Boolean(card.extensions?.checkbox),
  };
  const presets = ACCENT_PRESETS;
  const menuRef = useRef<HTMLElement | null>(null);
  const linkButtonRef = useRef<HTMLButtonElement | null>(null);
  const linkMenuRef = useRef<HTMLElement | null>(null);
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
      <ContextMenuSurface
        ref={menuRef}
        label="Text card menu"
        motionState={closing ? "closing" : "open"}
        position={position}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <ContextMenuItem
          icon={<IconPencil size={17} stroke={2} />}
          onClick={() => onStartEdit(card)}
        >
          Edit Text
        </ContextMenuItem>
        {extensions.colorPicker && (
          <ContextMenuItem
            icon={<IconPalette size={17} stroke={2} />}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setColorPickerPosition({ left: rect.right + 8, top: rect.top });
            }}
          >
            Open color picker
          </ContextMenuItem>
        )}
        {card.extensions?.lock && (
          <ContextMenuItem
            icon={
              card.extensions.lock.enabled ? (
                <IconLock size={17} stroke={2} />
              ) : (
                <IconLockOpen size={17} stroke={2} />
              )
            }
            onClick={() => onToggleLock(card.id)}
          >
            {card.extensions.lock.enabled ? "Locked" : "Unlocked"}
          </ContextMenuItem>
        )}
        <ContextMenuDivider />
        <ContextMenuSwatches>
          {presets.map((preset) => (
            <ContextMenuSwatch
              key={preset.textCardAccent}
              color={preset.swatch}
              selected={activeAccent === preset.textCardAccent}
              title="Text card color"
              aria-label={`Text card color ${preset.swatch}`}
              onClick={() => onUpdateAccent(card.id, preset.textCardAccent)}
            />
          ))}
        </ContextMenuSwatches>
        <ContextMenuDivider />
        {!card.containerId && (
          <>
            <ContextMenuActionGroup label="Layer order">
              <Tooltip label="Send to back" openDelayMs={1000}>
                <ContextMenuIconAction
                  aria-label="Send to back"
                  icon={<IconArrowAutofitDown size={20} stroke={2} />}
                  onClick={() => onMoveLayer(card.id, "back")}
                />
              </Tooltip>
              <Tooltip label="Send one layer back" openDelayMs={1000}>
                <ContextMenuIconAction
                  aria-label="Send one layer back"
                  icon={<IconArrowAutofitDownFilled size={20} />}
                  onClick={() => onMoveLayer(card.id, "backward")}
                />
              </Tooltip>
              <Tooltip label="Bring one layer forward" openDelayMs={1000}>
                <ContextMenuIconAction
                  aria-label="Bring one layer forward"
                  icon={<IconArrowAutofitUpFilled size={20} />}
                  onClick={() => onMoveLayer(card.id, "forward")}
                />
              </Tooltip>
              <Tooltip label="Bring to front" openDelayMs={1000}>
                <ContextMenuIconAction
                  aria-label="Bring to front"
                  icon={<IconArrowAutofitUp size={20} stroke={2} />}
                  onClick={() => onMoveLayer(card.id, "front")}
                />
              </Tooltip>
            </ContextMenuActionGroup>
            <ContextMenuDivider />
          </>
        )}
        {card.kind !== "mindmap" && (
          <>
            <ContextMenuItem
              ref={linkButtonRef}
              icon={<IconLink size={17} stroke={2} />}
              onClick={() => setLinkMenuOpen((current) => !current)}
            >
              Hyperlink
            </ContextMenuItem>
            <ContextMenuDivider />
          </>
        )}
        <ContextMenuItem icon={<IconCut size={17} stroke={2} />} onClick={() => onCut(card)}>
          {isMultiTarget ? "Cut selected" : "Cut"}
        </ContextMenuItem>
        <ContextMenuItem icon={<IconCopy size={17} stroke={2} />} onClick={() => onCopy(card)}>
          {isMultiTarget ? "Copy selected" : "Copy"}
        </ContextMenuItem>
        {(extensions.lock || extensions.colorPicker || extensions.checkbox) && (
          <>
            <ContextMenuDivider />
            <ContextMenuSection label="Remove Extensions">
              {extensions.lock && (
                <ContextMenuItem
                  icon={<IconTrash size={17} stroke={2} />}
                  onClick={() => onRemoveLockExtension(card.id)}
                >
                  Lock
                </ContextMenuItem>
              )}
              {extensions.colorPicker && (
                <ContextMenuItem
                  icon={<IconTrash size={17} stroke={2} />}
                  onClick={() => onRemoveColorPickerExtension(card.id)}
                >
                  Extra colors
                </ContextMenuItem>
              )}
              {extensions.checkbox && (
                <ContextMenuItem
                  icon={<IconTrash size={17} stroke={2} />}
                  onClick={() => onRemoveCheckboxExtension(card.id)}
                >
                  Checkbox
                </ContextMenuItem>
              )}
            </ContextMenuSection>
          </>
        )}
        <ContextMenuDivider />
        <ContextMenuItem
          danger
          icon={<IconTrash size={17} stroke={2} />}
          onClick={() => onDelete(card.id)}
        >
          {isMultiTarget ? "Remove selected" : "Remove"}
        </ContextMenuItem>
      </ContextMenuSurface>

      {linkMenuOpen && card.kind !== "mindmap" && !closing && (
        <ContextMenuSurface
          ref={linkMenuRef}
          label="Hyperlink"
          className="taskmap-context-menu--wide"
          position={linkMenuPosition}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="taskmap-context-menu__form-row">
            <TextField
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
            <IconButton
              variant="ghost"
              size="compact"
              aria-label="Save hyperlink"
              title="Save hyperlink"
              onClick={saveLink}
              icon={<IconCheck size={17} stroke={2} />}
            />
            <IconButton
              variant="ghost"
              size="compact"
              aria-label="Close hyperlink menu"
              title="Close hyperlink menu"
              onClick={() => setLinkMenuOpen(false)}
              icon={<IconX size={17} stroke={2} />}
            />
          </div>
        </ContextMenuSurface>
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
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, { left: menu.left, top: menu.top });
  const extensions = extensionState ?? {
    lock: Boolean(image.extensions?.lock),
  };
  const presets = ACCENT_PRESETS;

  return (
    <ContextMenuSurface
      ref={menuRef}
      label="Image menu"
      motionState={closing ? "closing" : "open"}
      position={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <ContextMenuItem
        icon={<IconPhoto size={17} stroke={2} />}
        onClick={() => onReplace(image.id)}
      >
        Replace image
      </ContextMenuItem>
      {image.extensions?.lock && (
        <ContextMenuItem
          icon={
            image.extensions.lock.enabled ? (
              <IconLock size={17} stroke={2} />
            ) : (
              <IconLockOpen size={17} stroke={2} />
            )
          }
          onClick={() => onToggleLock(image.id)}
        >
          {image.extensions.lock.enabled ? "Locked" : "Unlocked"}
        </ContextMenuItem>
      )}
      <ContextMenuDivider />
      <ContextMenuSwatches>
        {presets.map((preset) => (
          <ContextMenuSwatch
            key={preset.accent}
            color={preset.swatch}
            selected={image.accent === preset.accent}
            title="Image frame color"
            aria-label={`Image frame color ${preset.swatch}`}
            onClick={() => onUpdateAccent(image.id, preset.accent)}
          />
        ))}
      </ContextMenuSwatches>
      <ContextMenuDivider />
      <ContextMenuActionGroup label="Layer order">
        <Tooltip label="Send to back" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Send to back"
            icon={<IconArrowAutofitDown size={20} stroke={2} />}
            onClick={() => onMoveLayer(image.id, "back")}
          />
        </Tooltip>
        <Tooltip label="Send one layer back" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Send one layer back"
            icon={<IconArrowAutofitDownFilled size={20} />}
            onClick={() => onMoveLayer(image.id, "backward")}
          />
        </Tooltip>
        <Tooltip label="Bring one layer forward" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Bring one layer forward"
            icon={<IconArrowAutofitUpFilled size={20} />}
            onClick={() => onMoveLayer(image.id, "forward")}
          />
        </Tooltip>
        <Tooltip label="Bring to front" openDelayMs={1000}>
          <ContextMenuIconAction
            aria-label="Bring to front"
            icon={<IconArrowAutofitUp size={20} stroke={2} />}
            onClick={() => onMoveLayer(image.id, "front")}
          />
        </Tooltip>
      </ContextMenuActionGroup>
      <ContextMenuDivider />
      <ContextMenuItem
        icon={
          image.background === false ? (
            <IconSquare size={17} stroke={2} />
          ) : (
            <IconSquareOff size={17} stroke={2} />
          )
        }
        onClick={() => onToggleBackground(image.id)}
      >
        {image.background === false ? "Show background" : "Hide background"}
      </ContextMenuItem>
      <ContextMenuDivider />
      <ContextMenuItem icon={<IconCut size={17} stroke={2} />} onClick={() => onCut(image)}>
        {isMultiTarget ? "Cut selected" : "Cut"}
      </ContextMenuItem>
      <ContextMenuItem icon={<IconCopy size={17} stroke={2} />} onClick={() => onCopy(image)}>
        {isMultiTarget ? "Copy selected" : "Copy"}
      </ContextMenuItem>
      {extensions.lock && (
        <>
          <ContextMenuDivider />
          <ContextMenuSection label="Remove Extensions">
            {extensions.lock && (
              <ContextMenuItem
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => onRemoveLockExtension(image.id)}
              >
                Lock
              </ContextMenuItem>
            )}
          </ContextMenuSection>
        </>
      )}
      <ContextMenuDivider />
      <ContextMenuItem
        danger
        icon={<IconTrash size={17} stroke={2} />}
        onClick={() => onDelete(image.id)}
      >
        {isMultiTarget ? "Remove selected" : "Remove"}
      </ContextMenuItem>
    </ContextMenuSurface>
  );
}
