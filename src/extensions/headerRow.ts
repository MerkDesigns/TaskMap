import type { ComponentType } from "react";
import type { ExtensionCommands } from "./extensionCommands";
import type { HeaderControlContext, HeaderHost } from "./headerControl";
import type { RetainedExtensionKey } from "./retainedExtensionDefinition";

/** A full-width row an extension adds below an element's header, inside the header's area. */
export interface HeaderRow {
  readonly extension: RetainedExtensionKey;
  readonly hosts: readonly HeaderHost[];
  /** Fixed, so the host sizes its header and content without measuring. */
  readonly height: number;
  /** Presses must not start a move of the element. */
  readonly Row: ComponentType<{
    readonly context: HeaderControlContext;
    readonly commands: ExtensionCommands;
  }>;
}
