import type { ComponentType } from "react";
import type { ElementExtensions } from "../types";
import type { ExtensionCommands } from "./extensionCommands";
import type { RetainedExtensionKey } from "./retainedExtensionDefinition";

/** The element menus that show extension items. */
export type MenuHost = "container" | "text-block" | "text-card" | "mind-map-node" | "image";

/** What a menu item sees of the element whose menu it sits in. */
export interface MenuItemContext {
  readonly elementId: string;
  readonly host: MenuHost;
  /** The element's own installed extensions, from the retained extension projection. */
  readonly extensions: ElementExtensions;
  /** Extensions installed on any of the menu's targets (the element, or the selection it is in). */
  readonly installedOnTargets: ReadonlySet<RetainedExtensionKey>;
  /** The element's resolved accent colour. */
  readonly accent: string;
  readonly recentColors: readonly string[];
}

export interface MenuItemProps {
  readonly context: MenuItemContext;
  readonly commands: ExtensionCommands;
  /** Opens this item's panel beside the pressed item. */
  readonly openPanel: (anchor: HTMLElement) => void;
}

export interface MenuPanelProps {
  readonly context: MenuItemContext;
  readonly commands: ExtensionCommands;
  /** The pressed item's rectangle, captured when it was pressed. */
  readonly anchor: DOMRect;
  readonly close: () => void;
}

export interface ExtensionMenuItem {
  readonly extension: RetainedExtensionKey;
  readonly hosts: readonly MenuHost[];
  /** Offered while the extension is installed on any menu target; may render nothing. */
  readonly Item: ComponentType<MenuItemProps>;
  /** A popover the item opens; the menu shows it until it closes or the menu does. */
  readonly Panel?: ComponentType<MenuPanelProps>;
}
