import type { ElementIdsByKind } from "./useElementPresenceMarks";

export type Layered<Element> = Element & { readonly layer?: number };

/** What the canvas shows about its elements beyond the document: selection, gestures, editing. */
export interface RetainedElementPresentation {
  /** Elements drawn with a selection outline (marquee preview or multi-selection). */
  readonly outlinedIds: readonly string[];
  readonly selectedIds: readonly string[];
  /** Elements following the pointer in a move or resize, in gesture order. */
  readonly draggedIds: readonly string[];
  /** The element the pointer holds in a move. */
  readonly primaryMoveId: string | null;
  readonly shadowsUnderElements: boolean;
  readonly recentColors: readonly string[];
  readonly entering: ElementIdsByKind;
  readonly deleting: ElementIdsByKind;
  readonly pulsing: Pick<ElementIdsByKind, "textCards" | "textBlocks">;
  readonly textCardEdit: { readonly id: string | null; readonly draft: string };
  readonly textBlockEdit: { readonly id: string | null; readonly draft: string };
  readonly rename: { readonly id: string | null; readonly draft: string };
  readonly importingImageIds: readonly string[];
}

export interface LayerProps<Element> {
  readonly elements: readonly Layered<Element>[];
  /** Elements inside the viewport (plus pinned ones); everything else is culled. */
  readonly visibleIds: ReadonlySet<string>;
  readonly presentation: RetainedElementPresentation;
}

export const editDraft = (
  edit: { readonly id: string | null; readonly draft: string },
  id: string,
) => (edit.id === id ? edit.draft : "");
export const isMultiSelected = (presentation: RetainedElementPresentation, id: string) =>
  presentation.selectedIds.length > 1 && presentation.selectedIds.includes(id);
