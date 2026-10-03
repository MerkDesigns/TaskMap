import { IconPalette } from "@tabler/icons-react";
import { ColorPickerMenu } from "../../components/ColorPickerMenu";
import {
  HEADER_BUTTON_WIDTH,
  HeaderControlButton,
  headerIconSize,
  type HeaderControl,
} from "../headerControl";

export const colorPickerHeaderControl: HeaderControl = {
  extension: "colorPicker",
  hosts: ["container", "text-block"],
  width: () => HEADER_BUTTON_WIDTH,
  Control: ({ context, togglePanel }) => (
    <HeaderControlButton
      onClick={(event) => togglePanel(event.currentTarget)}
      title="Open color picker"
    >
      <IconPalette size={headerIconSize(context.host, 22)} stroke={2} />
    </HeaderControlButton>
  ),
  Panel: ({ context, commands, open, anchor, close }) =>
    open && anchor ? (
      <ColorPickerMenu
        color={context.accent}
        left={anchor.rect.right + 8}
        top={anchor.rect.top}
        recentColors={[...context.recentColors]}
        onChange={(accent) => commands.updateAccent(context.elementId, accent)}
        onClose={(recentColor) => {
          commands.rememberRecentColor(recentColor);
          close();
        }}
      />
    ) : null,
};
