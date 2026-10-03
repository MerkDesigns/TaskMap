import {
  IconCheck,
  IconCopy,
  IconCut,
  IconLink,
  IconPencil,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { ACCENT_PRESETS, getTextCardAccent } from "../../constants";
import type { ElementExtensions } from "../../types";
import type { ExtensionCommands } from "../../extensions/extensionCommands";
import type { RetainedExtensionKey } from "../../extensions/retainedExtensionDefinition";
import { IconButton } from "../../ui/primitives/Button";
import { ContextMenuSurface } from "../../ui/primitives/ContextMenu";
import {
  ContextMenuDivider,
  ContextMenuItem,
  ContextMenuSwatch,
  ContextMenuSwatches,
} from "../../ui/primitives/ContextMenuParts";
import { TextField } from "../../ui/primitives/FormControls";
import { useClampedFixedPosition } from "../../useClampedFixedPosition";
import { LayerOrderActions, type LayerMove } from "../LayerOrderActions";
import { useElementMenuExtensions } from "../useElementMenuExtensions";
import type { TextCardRendererElement } from "./TextCardRenderer";

export interface TextCardMenuActions {
  readonly onStartEdit: (id: string) => void;
  readonly onUpdateAccent: (id: string, accent: string) => void;
  readonly onUpdateLink: (id: string, link: string) => void;
  readonly onCut: (id: string) => void;
  readonly onCopy: (id: string) => void;
  readonly onMoveLayer: (id: string, direction: LayerMove) => void;
  readonly onDelete: (id: string) => void;
}

export interface TextCardMenuProps {
  readonly element: TextCardRendererElement;
  readonly position: { readonly left: number; readonly top: number };
  readonly closing: boolean;
  /** The menu acts on the whole selection, so Cut/Copy/Remove say "selected". */
  readonly isMultiTarget: boolean;
  /** The element's own installed extensions. */
  readonly extensions: ElementExtensions | undefined;
  /** Extensions installed on any of the menu's targets. */
  readonly installedOnTargets: ReadonlySet<RetainedExtensionKey>;
  readonly extensionCommands: ExtensionCommands;
  readonly recentColors: readonly string[];
  readonly actions: TextCardMenuActions;
}

export function TextCardMenu({
  element,
  position: preferredPosition,
  closing,
  isMultiTarget,
  extensions,
  installedOnTargets,
  extensionCommands,
  recentColors,
  actions,
}: TextCardMenuProps) {
  const { id } = element;
  // Mind-map nodes have no hyperlink and always sit on the canvas root.
  const link = element.type === "text-card" ? (element.data.link ?? "") : null;
  const contained = element.type === "text-card" && element.data.placement !== null;
  const activeAccent = getTextCardAccent(element.data.accent);
  const menuRef = useRef<HTMLElement | null>(null);
  const linkButtonRef = useRef<HTMLButtonElement | null>(null);
  const linkMenuRef = useRef<HTMLElement | null>(null);
  const position = useClampedFixedPosition(menuRef, preferredPosition);
  const [linkMenuPreferredPosition, setLinkMenuPreferredPosition] = useState({
    left: position.left + 232,
    top: position.top,
  });
  const linkMenuPosition = useClampedFixedPosition(linkMenuRef, linkMenuPreferredPosition);
  const [linkDraft, setLinkDraft] = useState(link ?? "");
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const menuExtensions = useElementMenuExtensions({
    context: {
      elementId: id,
      host: element.type === "text-card" ? "text-card" : "mind-map-node",
      extensions: extensions ?? {},
      installedOnTargets,
      accent: activeAccent,
      recentColors: recentColors,
    },
    commands: extensionCommands,
    closing,
  });

  useEffect(() => {
    setLinkDraft(link ?? "");
  }, [id, link]);

  useLayoutEffect(() => {
    if (!linkMenuOpen) return;
    const buttonRect = linkButtonRef.current?.getBoundingClientRect();
    if (!buttonRect) return;
    setLinkMenuPreferredPosition({ left: buttonRect.right + 8, top: buttonRect.top });
  }, [linkMenuOpen, position.left, position.top]);

  const saveLink = () => {
    if (link !== null) actions.onUpdateLink(id, linkDraft);
  };
  const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

  return (
    <>
      <ContextMenuSurface
        ref={menuRef}
        label="Text card menu"
        motionState={closing ? "closing" : "open"}
        position={position}
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
      >
        <ContextMenuItem
          icon={<IconPencil size={17} stroke={2} />}
          onClick={() => actions.onStartEdit(id)}
        >
          Edit Text
        </ContextMenuItem>
        {menuExtensions.items}
        <ContextMenuDivider />
        <ContextMenuSwatches>
          {ACCENT_PRESETS.map((preset) => (
            <ContextMenuSwatch
              key={preset.textCardAccent}
              color={preset.swatch}
              selected={activeAccent === preset.textCardAccent}
              title="Text card color"
              aria-label={`Text card color ${preset.swatch}`}
              onClick={() => actions.onUpdateAccent(id, preset.textCardAccent)}
            />
          ))}
        </ContextMenuSwatches>
        <ContextMenuDivider />
        {!contained && (
          <>
            <LayerOrderActions onMove={(direction) => actions.onMoveLayer(id, direction)} />
            <ContextMenuDivider />
          </>
        )}
        {link !== null && (
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

      {linkMenuOpen && link !== null && !closing && (
        <ContextMenuSurface
          ref={linkMenuRef}
          label="Hyperlink"
          className="taskmap-context-menu--wide"
          position={linkMenuPosition}
          onPointerDown={stopPropagation}
          onClick={stopPropagation}
        >
          <div className="taskmap-context-menu__form-row">
            <TextField
              value={linkDraft}
              placeholder="https://example.com or C:\path\file"
              spellCheck={false}
              onChange={(event) => setLinkDraft(event.target.value)}
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveLink();
                if (event.key === "Escape") setLinkDraft(link);
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

      {menuExtensions.panels}
    </>
  );
}
