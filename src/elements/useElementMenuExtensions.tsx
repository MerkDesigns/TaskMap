import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import type { ExtensionCommands } from "../extensions/extensionCommands";
import type { MenuItemContext } from "../extensions/menuItem";
import { menuItemsFor, removableExtensionsFor } from "../extensions/menuItemRegistry";
import type { RetainedExtensionKey } from "../extensions/retainedExtensionDefinition";
import {
  ContextMenuDivider,
  ContextMenuItem,
  ContextMenuSection,
} from "../ui/primitives/ContextMenuParts";

export interface ElementMenuExtensionsInput {
  readonly context: MenuItemContext;
  readonly commands: ExtensionCommands;
  /** The menu is animating closed; panels close with it. */
  readonly closing: boolean;
}

type OpenPanel = { readonly extension: RetainedExtensionKey; readonly anchor: DOMRect };

/**
 * The extension part of an element menu: `items` goes where the menu lists its actions, `removal` is
 * the "Remove Extensions" section (with its leading divider, or nothing), and `panels` renders beside
 * the menu surface.
 */
export function useElementMenuExtensions({
  context,
  commands,
  closing,
}: ElementMenuExtensionsInput) {
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);
  const contributions = menuItemsFor(context);
  const removable = removableExtensionsFor(context.installedOnTargets);
  const panelOwner = openPanel
    ? contributions.find((item) => item.extension === openPanel.extension)
    : undefined;

  const items = contributions.map(({ extension, Item }) => (
    <Item
      key={extension}
      context={context}
      commands={commands}
      openPanel={(anchor) => setOpenPanel({ extension, anchor: anchor.getBoundingClientRect() })}
    />
  ));

  const removal =
    removable.length > 0 ? (
      <>
        <ContextMenuDivider />
        <ContextMenuSection label="Remove Extensions">
          {removable.map(({ extension, label }) => (
            <ContextMenuItem
              key={extension}
              icon={<IconTrash size={17} stroke={2} />}
              onClick={() => commands.remove(extension, context.elementId)}
            >
              {label}
            </ContextMenuItem>
          ))}
        </ContextMenuSection>
      </>
    ) : null;

  const Panel = panelOwner?.Panel;
  const panels =
    openPanel && Panel && !closing ? (
      <Panel
        context={context}
        commands={commands}
        anchor={openPanel.anchor}
        close={() => setOpenPanel(null)}
      />
    ) : null;

  return { items, removal, panels };
}
