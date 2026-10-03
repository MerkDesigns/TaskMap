import { IconCopy, IconCut, IconPencil, IconTrash } from "@tabler/icons-react";
import { useRef } from "react";
import type { SyntheticEvent } from "react";
import { ACCENT_PRESETS } from "../../constants";
import type { ElementExtensions } from "../../types";
import type { ExtensionCommands } from "../../extensions/extensionCommands";
import type { RetainedExtensionKey } from "../../extensions/retainedExtensionDefinition";
import { ContextMenuSurface } from "../../ui/primitives/ContextMenu";
import {
  ContextMenuDivider,
  ContextMenuItem,
  ContextMenuSwatch,
  ContextMenuSwatches,
} from "../../ui/primitives/ContextMenuParts";
import { useClampedFixedPosition } from "../../useClampedFixedPosition";
import { LayerOrderActions, type LayerMove } from "../LayerOrderActions";
import { useElementMenuExtensions } from "../useElementMenuExtensions";
import type { ContainerDocumentElement } from "./containerModel";

export interface ContainerMenuActions {
  readonly onStartRename: (id: string) => void;
  readonly onUpdateAccent: (id: string, accent: string) => void;
  readonly onCut: (id: string) => void;
  readonly onCopy: (id: string) => void;
  readonly onMoveLayer: (id: string, direction: LayerMove) => void;
  readonly onDelete: (id: string) => void;
}

export interface ContainerMenuProps {
  readonly element: ContainerDocumentElement;
  readonly position: { readonly left: number; readonly top: number };
  readonly closing: boolean;
  /** The menu acts on the whole selection, so Cut/Copy/Remove say "selected". */
  readonly isMultiTarget: boolean;
  /** The element's own installed extensions. */
  readonly extensions: ElementExtensions | undefined;
  /** Extensions installed on any of the menu's targets. */
  readonly installedOnTargets: ReadonlySet<RetainedExtensionKey>;
  readonly extensionCommands: ExtensionCommands;
  readonly actions: ContainerMenuActions;
}

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function ContainerMenu({
  element,
  position: preferredPosition,
  closing,
  isMultiTarget,
  extensions,
  installedOnTargets,
  extensionCommands,
  actions,
}: ContainerMenuProps) {
  const { id, data } = element;
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, preferredPosition);
  const menuExtensions = useElementMenuExtensions({
    context: {
      elementId: id,
      host: "container",
      extensions: extensions ?? {},
      installedOnTargets,
      accent: data.accent,
      recentColors: [],
    },
    commands: extensionCommands,
    closing,
  });

  return (
    <>
      <ContextMenuSurface
        ref={menuRef}
        label="Container menu"
        motionState={closing ? "closing" : "open"}
        position={position}
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
      >
        <ContextMenuItem
          icon={<IconPencil size={17} stroke={2} />}
          onClick={() => actions.onStartRename(id)}
        >
          Edit Container
        </ContextMenuItem>
        {menuExtensions.items}
        <ContextMenuDivider />
        <ContextMenuSwatches>
          {ACCENT_PRESETS.map((preset) => (
            <ContextMenuSwatch
              key={preset.accent}
              color={preset.swatch}
              selected={data.accent === preset.accent}
              aria-label={`Container accent ${preset.swatch}`}
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
        <ContextMenuItem
          icon={<IconCopy size={17} stroke={2} />}
          onClick={() => actions.onCopy(id)}
        >
          {isMultiTarget ? "Copy selected" : "Copy"}
        </ContextMenuItem>
        {menuExtensions.removal}
        <ContextMenuDivider />
        <ContextMenuItem
          danger
          icon={<IconTrash size={17} stroke={2} />}
          onClick={() => actions.onDelete(id)}
        >
          {isMultiTarget ? "Remove selected" : "Remove"}
        </ContextMenuItem>
      </ContextMenuSurface>
      {menuExtensions.panels}
    </>
  );
}
