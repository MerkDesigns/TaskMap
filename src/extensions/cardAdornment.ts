import type { ComponentType } from "react";
import type { ElementExtensions } from "../types";
import type { ExtensionCommands } from "./extensionCommands";
import type { RetainedExtensionKey } from "./retainedExtensionDefinition";

/** What a card adornment sees of the text card it sits on. */
export interface CardAdornmentContext {
  readonly elementId: string;
  /** The card's resolved accent colour. */
  readonly accent: string;
  /** Installed extensions, from the retained extension projection. */
  readonly extensions: ElementExtensions;
}

/** A state the card styles on its text; adornments name it, the card owns its look. */
export type CardTextState = "done";

export interface CardAdornment {
  readonly extension: RetainedExtensionKey;
  /** Drawn before the card's text; presses must not start a move. */
  readonly Leading: ComponentType<{
    readonly context: CardAdornmentContext;
    readonly commands: ExtensionCommands;
  }>;
  readonly textState?: (context: CardAdornmentContext) => CardTextState | undefined;
}
