import { IconEye, IconEyeOff } from "@tabler/icons-react";
import {
  HEADER_BUTTON_WIDTH,
  HeaderControlButton,
  headerIconSize,
  type HeaderControl,
} from "../headerControl";

export const privacyHeaderControl: HeaderControl = {
  extension: "privacy",
  hosts: ["container", "text-block"],
  width: () => HEADER_BUTTON_WIDTH,
  Control: ({ context, commands }) => {
    const enabled = Boolean(context.extensions.privacy?.enabled);
    const size = headerIconSize(context.host, 25);
    return (
      <HeaderControlButton
        onClick={() => commands.toggle("privacy", context.elementId)}
        title={enabled ? "Show content" : "Hide content"}
      >
        {enabled ? <IconEyeOff size={size} stroke={2} /> : <IconEye size={size} stroke={2} />}
      </HeaderControlButton>
    );
  },
};
