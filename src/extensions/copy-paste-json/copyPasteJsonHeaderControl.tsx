import { IconBraces, IconClipboardCopy, IconClipboardText, IconEdit } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { ContextMenu } from "../../ui/primitives/ContextMenu";
import { ContextMenuDivider, ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import { useClampedFixedPosition } from "../../useClampedFixedPosition";
import {
  HEADER_BUTTON_WIDTH,
  HeaderControlButton,
  headerIconSize,
  type HeaderControl,
  type HeaderPanelProps,
} from "../headerControl";

const ORIGIN = { left: 0, top: 0 };

function CopyPasteJsonMenu({ context, commands, open, anchor, close }: HeaderPanelProps) {
  const menuRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  returnFocusRef.current = anchor?.element ?? null;
  const position = useClampedFixedPosition(
    menuRef,
    anchor ? { left: anchor.rect.right + 6, top: anchor.rect.top } : ORIGIN,
  );

  useEffect(() => {
    if (!open) return;
    // The shared menu handles outside presses and Escape; the container can move away on resize or
    // scroll, so close then.
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, close]);

  const closeAnd = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <ContextMenu
      ref={menuRef}
      portal
      label="Copy/Paste JSON"
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      position={position}
      returnFocusRef={returnFocusRef}
    >
      <ContextMenuItem
        icon={<IconClipboardCopy size={17} stroke={2} />}
        onClick={closeAnd(() => void commands.copyJsonForAi(context.elementId))}
      >
        Copy JSON for AI
      </ContextMenuItem>
      <ContextMenuDivider />
      <ContextMenuItem
        icon={<IconClipboardText size={17} stroke={2} />}
        onClick={closeAnd(() => void commands.pasteJsonFromAi(context.elementId))}
      >
        Paste JSON from AI
      </ContextMenuItem>
      <ContextMenuDivider />
      <ContextMenuItem
        icon={<IconEdit size={17} stroke={2} />}
        onClick={closeAnd(() => commands.openJsonEditor(context.elementId))}
      >
        Open JSON editor
      </ContextMenuItem>
    </ContextMenu>
  );
}

export const copyPasteJsonHeaderControl: HeaderControl = {
  extension: "copyPasteJson",
  hosts: ["container"],
  width: () => HEADER_BUTTON_WIDTH,
  Control: ({ context, panelOpen, togglePanel }) => (
    <HeaderControlButton
      active={panelOpen}
      onClick={(event) => togglePanel(event.currentTarget)}
      title="Copy/Paste JSON"
    >
      <IconBraces size={headerIconSize(context.host, 22)} stroke={2} />
    </HeaderControlButton>
  ),
  Panel: CopyPasteJsonMenu,
};
