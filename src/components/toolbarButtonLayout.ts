import {
  PINNED_TOOLBAR_BUTTON,
  TOOLBAR_BUTTON_IDS,
  TOOLBAR_SLOT_COUNT,
  type ToolbarButtonId,
} from "../platform/settings/preferenceContracts";

/** A button being dragged, from the toolbar or from the tray of unused buttons. */
export interface ToolbarDragSource {
  readonly id: ToolbarButtonId;
  readonly from: "toolbar" | "tray";
}

/** Where a dragged button would go if it were let go now. */
export type ToolbarDropTarget =
  /** Between the toolbar's other buttons, at this index among them. */
  | { readonly kind: "toolbar"; readonly index: number }
  /** Onto a toolbar button, which trades places with the tray button dragged onto it. */
  | { readonly kind: "swap"; readonly id: ToolbarButtonId }
  /** Into the tray of unused buttons. */
  | { readonly kind: "tray" }
  /** Nowhere: the button goes back where it came from. */
  | { readonly kind: "none" };

export interface ToolbarArrangement {
  readonly toolbar: readonly ToolbarButtonId[];
  /** Every other button, in their fixed order. */
  readonly tray: readonly ToolbarButtonId[];
}

/** The toolbar and tray after letting `source` go at `target`; unchanged when that is not allowed. */
export function arrangeToolbar(
  toolbar: readonly ToolbarButtonId[],
  source: ToolbarDragSource,
  target: ToolbarDropTarget,
): ToolbarArrangement {
  return withTray(nextToolbar(toolbar, source, target));
}

export function toolbarArrangement(toolbar: readonly ToolbarButtonId[]): ToolbarArrangement {
  return withTray(toolbar);
}

function nextToolbar(
  toolbar: readonly ToolbarButtonId[],
  source: ToolbarDragSource,
  target: ToolbarDropTarget,
): readonly ToolbarButtonId[] {
  const others = toolbar.filter((id) => id !== source.id);
  switch (target.kind) {
    case "toolbar": {
      // A full toolbar takes a tray button only by swapping.
      if (source.from === "tray" && others.length >= TOOLBAR_SLOT_COUNT) return toolbar;
      const index = Math.max(0, Math.min(target.index, others.length));
      return [...others.slice(0, index), source.id, ...others.slice(index)];
    }
    case "swap":
      if (
        source.from !== "tray" ||
        target.id === PINNED_TOOLBAR_BUTTON ||
        !toolbar.includes(target.id)
      ) {
        return toolbar;
      }
      return toolbar.map((id) => (id === target.id ? source.id : id));
    case "tray":
      return source.from === "toolbar" && source.id !== PINNED_TOOLBAR_BUTTON ? others : toolbar;
    case "none":
      return toolbar;
  }
}

function withTray(toolbar: readonly ToolbarButtonId[]): ToolbarArrangement {
  return { toolbar, tray: TOOLBAR_BUTTON_IDS.filter((id) => !toolbar.includes(id)) };
}
