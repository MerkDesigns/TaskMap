import {
  IconCopy,
  IconCut,
  IconLock,
  IconLockOpen,
  IconPhoto,
  IconSquare,
  IconSquareOff,
  IconTrash,
} from "@tabler/icons-react";
import { useRef } from "react";
import type { SyntheticEvent } from "react";
import { ACCENT_PRESETS } from "../../constants";
import { ContextMenuSurface } from "../../ui/primitives/ContextMenu";
import {
  ContextMenuDivider,
  ContextMenuItem,
  ContextMenuSection,
  ContextMenuSwatch,
  ContextMenuSwatches,
} from "../../ui/primitives/ContextMenuParts";
import { useClampedFixedPosition } from "../../useClampedFixedPosition";
import { LayerOrderActions, type LayerMove } from "../LayerOrderActions";
import type { ImageDocumentElement } from "./imageModel";

export interface ImageMenuActions {
  /** Opens the file picker to replace the image's media. */
  readonly onReplace: (id: string) => void;
  readonly onUpdateAccent: (id: string, accent: string) => void;
  readonly onToggleBackground: (id: string) => void;
  readonly onToggleLock: (id: string) => void;
  readonly onMoveLayer: (id: string, direction: LayerMove) => void;
  readonly onCut: (id: string) => void;
  readonly onCopy: (id: string) => void;
  readonly onRemoveLock: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

export interface ImageMenuProps {
  readonly element: ImageDocumentElement;
  readonly position: { readonly left: number; readonly top: number };
  readonly closing: boolean;
  /** The menu acts on the whole selection, so Cut/Copy/Remove say "selected". */
  readonly isMultiTarget: boolean;
  /** The image's own lock, toggled from the menu; null when none is installed. */
  readonly lock: { readonly enabled: boolean } | null;
  /** A lock is installed on any of the menu's targets and can be removed. */
  readonly lockInstalled: boolean;
  readonly actions: ImageMenuActions;
}

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function ImageMenu({
  element,
  position: preferredPosition,
  closing,
  isMultiTarget,
  lock,
  lockInstalled,
  actions,
}: ImageMenuProps) {
  const { id, data } = element;
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, preferredPosition);

  return (
    <ContextMenuSurface
      ref={menuRef}
      label="Image menu"
      motionState={closing ? "closing" : "open"}
      position={position}
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      <ContextMenuItem
        icon={<IconPhoto size={17} stroke={2} />}
        onClick={() => actions.onReplace(id)}
      >
        Replace image
      </ContextMenuItem>
      {lock && (
        <ContextMenuItem
          icon={
            lock.enabled ? <IconLock size={17} stroke={2} /> : <IconLockOpen size={17} stroke={2} />
          }
          onClick={() => actions.onToggleLock(id)}
        >
          {lock.enabled ? "Locked" : "Unlocked"}
        </ContextMenuItem>
      )}
      <ContextMenuDivider />
      <ContextMenuSwatches>
        {ACCENT_PRESETS.map((preset) => (
          <ContextMenuSwatch
            key={preset.accent}
            color={preset.swatch}
            selected={data.accent === preset.accent}
            title="Image frame color"
            aria-label={`Image frame color ${preset.swatch}`}
            onClick={() => actions.onUpdateAccent(id, preset.accent)}
          />
        ))}
      </ContextMenuSwatches>
      <ContextMenuDivider />
      <LayerOrderActions onMove={(direction) => actions.onMoveLayer(id, direction)} />
      <ContextMenuDivider />
      <ContextMenuItem
        icon={
          data.background ? (
            <IconSquareOff size={17} stroke={2} />
          ) : (
            <IconSquare size={17} stroke={2} />
          )
        }
        onClick={() => actions.onToggleBackground(id)}
      >
        {data.background ? "Hide background" : "Show background"}
      </ContextMenuItem>
      <ContextMenuDivider />
      <ContextMenuItem icon={<IconCut size={17} stroke={2} />} onClick={() => actions.onCut(id)}>
        {isMultiTarget ? "Cut selected" : "Cut"}
      </ContextMenuItem>
      <ContextMenuItem icon={<IconCopy size={17} stroke={2} />} onClick={() => actions.onCopy(id)}>
        {isMultiTarget ? "Copy selected" : "Copy"}
      </ContextMenuItem>
      {lockInstalled && (
        <>
          <ContextMenuDivider />
          <ContextMenuSection label="Remove Extensions">
            <ContextMenuItem
              icon={<IconTrash size={17} stroke={2} />}
              onClick={() => actions.onRemoveLock(id)}
            >
              Lock
            </ContextMenuItem>
          </ContextMenuSection>
        </>
      )}
      <ContextMenuDivider />
      <ContextMenuItem
        danger
        icon={<IconTrash size={17} stroke={2} />}
        onClick={() => actions.onDelete(id)}
      >
        {isMultiTarget ? "Remove selected" : "Remove"}
      </ContextMenuItem>
    </ContextMenuSurface>
  );
}
