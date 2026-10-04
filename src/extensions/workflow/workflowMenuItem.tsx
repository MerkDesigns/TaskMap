import { IconTerminal2 } from "@tabler/icons-react";
import { ContextMenuItem } from "../../ui/primitives/ContextMenuParts";
import type { ExtensionMenuItem } from "../menuItem";

export const workflowMenuItem: ExtensionMenuItem = {
  extension: "workflow",
  hosts: ["text-card"],
  // Edits this card's own workflow, so it is offered only when the card itself has one.
  Item: ({ context, commands }) =>
    context.extensions.workflow ? (
      <ContextMenuItem
        icon={<IconTerminal2 size={17} stroke={2} />}
        onClick={() => commands.openWorkflowEditor(context.elementId)}
      >
        Edit workflow
      </ContextMenuItem>
    ) : null,
};
