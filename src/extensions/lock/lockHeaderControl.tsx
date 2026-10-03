import { IconLock, IconLockOpen } from "@tabler/icons-react";
import {
  HEADER_BUTTON_WIDTH,
  HeaderControlButton,
  headerIconSize,
  type HeaderControl,
} from "../headerControl";

export const lockHeaderControl: HeaderControl = {
  extension: "lock",
  hosts: ["container", "text-block"],
  width: () => HEADER_BUTTON_WIDTH,
  Control: ({ context, commands }) => {
    const enabled = Boolean(context.extensions.lock?.enabled);
    const size = headerIconSize(context.host, 22);
    return (
      <HeaderControlButton
        onClick={() => commands.toggle("lock", context.elementId)}
        title={enabled ? "Unlock" : "Lock"}
      >
        {enabled ? <IconLock size={size} stroke={2} /> : <IconLockOpen size={size} stroke={2} />}
      </HeaderControlButton>
    );
  },
};
