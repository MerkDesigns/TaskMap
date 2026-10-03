import { IconPalette } from "@tabler/icons-react";
import { ColorPickerMenu } from "../../components/ColorPickerMenu";
import { ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import type { ExtensionMenuItem } from "../menuItem";

export const colorPickerMenuItem: ExtensionMenuItem = {
  extension: "colorPicker",
  hosts: ["text-card", "mind-map-node"],
  Item: ({ openPanel }) => (
    <ContextMenuItem
      icon={<IconPalette size={17} stroke={2} />}
      onClick={(event) => openPanel(event.currentTarget)}
    >
      Open color picker
    </ContextMenuItem>
  ),
  // Recolours the menu's targets, like the menu's own swatches.
  Panel: ({ context, commands, anchor, close }) => (
    <ColorPickerMenu
      color={context.accent}
      left={anchor.right + 8}
      top={anchor.top}
      recentColors={[...context.recentColors]}
      onChange={(accent) => commands.updateSelectionAccent(context.elementId, accent)}
      onClose={(recentColor) => {
        commands.rememberRecentColor(recentColor);
        close();
      }}
    />
  ),
};
