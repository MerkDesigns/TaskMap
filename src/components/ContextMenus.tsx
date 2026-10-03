import {
  IconCopy,
  IconBox,
  IconNotes,
  IconPhoto,
  IconSitemap,
  IconTextSize,
  IconTrash,
} from "@tabler/icons-react";
import { useRef } from "react";
import { useClampedFixedPosition } from "../useClampedFixedPosition";
import { ContextMenuSurface } from "../ui/primitives/ContextMenu";
import { ContextMenuDivider, ContextMenuItem } from "../ui/primitives/ContextMenuParts";

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
