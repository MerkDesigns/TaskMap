import { IconCopy, IconCut, IconPencil, IconTrash } from "@tabler/icons-react";
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
import type { TextBlockDocumentElement } from "./textBlockModel";

export type TextBlockMenuExtension = "privacy" | "lock" | "colorPicker";

export interface TextBlockMenuActions {
  /** "Edit Text" renames the block; its body is edited by double-clicking it. */
  readonly onStartRename: (id: string) => void;
  readonly onUpdateAccent: (id: string, accent: string) => void;
  readonly onCut: (id: string) => void;
  readonly onCopy: (id: string) => void;
  readonly onRemoveExtension: (id: string, extension: TextBlockMenuExtension) => void;
  readonly onMoveLayer: (id: string, direction: LayerMove) => void;
  readonly onDelete: (id: string) => void;
}

export interface TextBlockMenuProps {
  readonly element: TextBlockDocumentElement;
  readonly position: { readonly left: number; readonly top: number };
  readonly closing: boolean;
  /** The menu acts on the whole selection, so Cut/Copy/Remove say "selected". */
  readonly isMultiTarget: boolean;
  /** Extensions installed on any of the menu's targets, offered for removal. */
  readonly installed: Readonly<Partial<Record<TextBlockMenuExtension, boolean>>>;
  readonly actions: TextBlockMenuActions;
}

const REMOVABLE_EXTENSIONS: readonly { extension: TextBlockMenuExtension; label: string }[] = [
  { extension: "privacy", label: "Privacy" },
  { extension: "lock", label: "Lock" },
  { extension: "colorPicker", label: "Extra colors" },
];

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function TextBlockMenu({
  element,
  position: preferredPosition,
  closing,
  isMultiTarget,
  installed,
  actions,
}: TextBlockMenuProps) {
  const { id, data } = element;
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, preferredPosition);
  const removable = REMOVABLE_EXTENSIONS.filter(({ extension }) => installed[extension]);

  return (
    <ContextMenuSurface
      ref={menuRef}
      label="Text block menu"
      motionState={closing ? "closing" : "open"}
      position={position}
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      <ContextMenuItem
        icon={<IconPencil size={17} stroke={2} />}
        onClick={() => actions.onStartRename(id)}
      >
        Edit Text
      </ContextMenuItem>
      <ContextMenuDivider />
      <ContextMenuSwatches>
        {ACCENT_PRESETS.map((preset) => (
          <ContextMenuSwatch
            key={preset.accent}
            color={preset.swatch}
            selected={data.accent === preset.accent}
            title="Text block color"
            aria-label={`Text block color ${preset.swatch}`}
            onClick={() => actions.onUpdateAccent(id, preset.accent)}
          />
        ))}
      </ContextMenuSwatches>
      <ContextMenuDivider />
      <LayerOrderActions onMove={(direction) => actions.onMoveLayer(id, direction)} />
      <ContextMenuDivider />
      <ContextMenuItem icon={<IconCut size={17} stroke={2} />} onClick={() => actions.onCut(id)}>
        {isMultiTarget ? "Cut selected" : "Cut"}
      </ContextMenuItem>
      <ContextMenuItem icon={<IconCopy size={17} stroke={2} />} onClick={() => actions.onCopy(id)}>
        {isMultiTarget ? "Copy selected" : "Copy"}
      </ContextMenuItem>
      {removable.length > 0 && (
        <>
          <ContextMenuDivider />
          <ContextMenuSection label="Remove Extensions">
            {removable.map(({ extension, label }) => (
              <ContextMenuItem
                key={extension}
                icon={<IconTrash size={17} stroke={2} />}
                onClick={() => actions.onRemoveExtension(id, extension)}
              >
                {label}
              </ContextMenuItem>
            ))}
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
