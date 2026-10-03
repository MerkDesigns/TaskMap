import { IconTrash } from "@tabler/icons-react";
import { useRef } from "react";
import type { SyntheticEvent } from "react";
import { ContextMenuSurface } from "../../ui/primitives/ContextMenu";
import { ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import { useClampedFixedPosition } from "../../useClampedFixedPosition";

export interface MindMapConnectionMenuProps {
  readonly connectionId: string;
  readonly position: { readonly left: number; readonly top: number };
  readonly onDelete: (connectionId: string) => void;
}

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

/** Opened by clicking a line in connection mode; a connection's only action is deleting it. */
export function MindMapConnectionMenu({
  connectionId,
  position: preferredPosition,
  onDelete,
}: MindMapConnectionMenuProps) {
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, preferredPosition);
  return (
    <ContextMenuSurface
      ref={menuRef}
      label="Connection menu"
      position={position}
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      <ContextMenuItem
        danger
        icon={<IconTrash size={17} stroke={2} />}
        onClick={() => onDelete(connectionId)}
      >
        Delete connection
      </ContextMenuItem>
    </ContextMenuSurface>
  );
}
