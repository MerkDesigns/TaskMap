import { IconFolder } from "@tabler/icons-react";
import { ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import type { ExtensionMenuItem } from "../menuItem";

export const folderMenuItem: ExtensionMenuItem = {
  extension: "folder",
  hosts: ["text-card"],
  // Edits this card's own folder, so it is offered only when the card itself has one.
  Item: ({ context, commands }) =>
    context.extensions.folder ? (
      <ContextMenuItem
        icon={<IconFolder size={17} stroke={2} />}
        onClick={() => commands.openFolderEditor(context.elementId)}
      >
        Edit folder
      </ContextMenuItem>
    ) : null,
};
