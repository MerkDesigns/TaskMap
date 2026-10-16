import {
  IconCopy,
  IconCut,
  IconPhoto,
  IconSquare,
  IconSquareOff,
  IconTrash,
} from "@tabler/icons-react";
import { useRef } from "react";
import type { SyntheticEvent } from "react";
import type { ElementExtensions } from "../../types";
import type { ExtensionCommands } from "../../extensions/extensionCommands";
import type { RetainedExtensionKey } from "../../extensions/retainedExtensionDefinition";
import { ContextMenuSurface } from "../../ui/primitives/ContextMenu";
import { ContextMenuDivider, ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import { useClampedFixedPosition } from "../../useClampedFixedPosition";
import { LayerOrderActions, type LayerMove } from "../LayerOrderActions";
import { useElementColorSwatches } from "../useElementColorSwatches";
import { useElementMenuExtensions } from "../useElementMenuExtensions";
import type { ImageDocumentElement } from "./imageModel";

export interface ImageMenuActions {
  /** Opens the file picker to replace the image's media. */
  readonly onReplace: (id: string) => void;
  readonly onUpdateAccent: (id: string, accent: string) => void;
  readonly onToggleBackground: (id: string) => void;
  readonly onMoveLayer: (id: string, direction: LayerMove) => void;
  readonly onCut: (id: string) => void;
  readonly onCopy: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

export interface ImageMenuProps {
  readonly element: ImageDocumentElement;
  readonly position: { readonly left: number; readonly top: number };
  readonly closing: boolean;
  /** The menu acts on the whole selection, so Cut/Copy/Remove say "selected". */
  readonly isMultiTarget: boolean;
  /** The element's own installed extensions. */
  readonly extensions: ElementExtensions | undefined;
  /** Extensions installed on any of the menu's targets. */
  readonly installedOnTargets: ReadonlySet<RetainedExtensionKey>;
  readonly extensionCommands: ExtensionCommands;
  /** Recently picked colors, offered by the color picker. */
  readonly recentColors: readonly string[];
  readonly actions: ImageMenuActions;
}

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function ImageMenu({
  element,
  position: preferredPosition,
  closing,
  isMultiTarget,
  extensions,
  installedOnTargets,
  extensionCommands,
  recentColors,
  actions,
}: ImageMenuProps) {
  const { id, data } = element;
  const menuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, preferredPosition);
  const menuExtensions = useElementMenuExtensions({
    context: {
      elementId: id,
      host: "image",
      extensions: extensions ?? {},
      installedOnTargets,
      accent: data.accent,
      recentColors,
    },
    commands: extensionCommands,
    closing,
  });
  const colors = useElementColorSwatches({
    accent: data.accent,
    accentOf: (preset) => preset.accent,
    label: "Image frame color",
    recentColors,
    closing,
    onChange: (accent) => actions.onUpdateAccent(id, accent),
    onRememberRecentColor: extensionCommands.rememberRecentColor,
  });

  return (
    <>
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
        {menuExtensions.items}
        <ContextMenuDivider />
        {colors.swatches}
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
      {colors.panel}
    </>
  );
}
