import { IconLock, IconLockOpen } from "@tabler/icons-react";
import { ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import type { ExtensionMenuItem } from "../menuItem";

export const lockMenuItem: ExtensionMenuItem = {
  extension: "lock",
  hosts: ["text-card", "mind-map-node", "image"],
  // Toggles the element's own lock, so it is offered only when the element itself has one.
  Item: ({ context, commands }) => {
    const lock = context.extensions.lock;
    if (!lock) return null;
    return (
      <ContextMenuItem
        icon={
          lock.enabled ? <IconLock size={17} stroke={2} /> : <IconLockOpen size={17} stroke={2} />
        }
        onClick={() => commands.toggle("lock", context.elementId)}
      >
        {lock.enabled ? "Locked" : "Unlocked"}
      </ContextMenuItem>
    );
  },
};
