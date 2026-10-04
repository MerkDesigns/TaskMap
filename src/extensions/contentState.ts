import type { ElementExtensions } from "../types";
import { privacyContentState } from "./privacy/privacyContentState";
import type { RetainedExtensionKey } from "./retainedExtensionDefinition";

/**
 * A state an element styles its content in. Extensions name the state; the element owns its look
 * (`hidden`: blurred and unselectable, for containers and text blocks, and for the cards a hidden
 * container holds).
 */
export type ContentState = "hidden";

export interface ContentStateContribution {
  readonly extension: RetainedExtensionKey;
  readonly state: ContentState;
  /** Whether the installed extension puts the element's content in this state now. */
  readonly applies: (extensions: ElementExtensions) => boolean;
}

/** Content-state contributions; an element may be in several states at once. */
const contentStates: readonly ContentStateContribution[] = Object.freeze([privacyContentState]);

/** Whether an element's installed extensions put its content in `state`. */
export function hasContentState(
  extensions: ElementExtensions | undefined,
  state: ContentState,
): boolean {
  if (!extensions) return false;
  return contentStates.some(
    (contribution) =>
      contribution.state === state &&
      extensions[contribution.extension] !== undefined &&
      contribution.applies(extensions),
  );
}
