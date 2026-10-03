import type { MouseEvent, PointerEvent, WheelEvent } from "react";
import type { ElementExtensions } from "../../types";
import type { ElementGeometryView } from "../elementPlacement";

/** Transient presentation state of a container; everything persistent is read from its element. */
export interface ContainerViewState {
  readonly layer: number;
  /**
   * Where the element is shown: its stored geometry, or the live preview while it is being moved
   * or resized (the document only changes when the gesture completes).
   */
  readonly geometry: ElementGeometryView;
  /** Installed extensions, from the retained extension projection. */
  readonly extensions: ElementExtensions | undefined;
  readonly cardCount: number;
  readonly selected: boolean;
  /** Part of a multi-element selection: presses move the group instead of selecting. */
  readonly multiSelected: boolean;
  readonly entering: boolean;
  readonly deleting: boolean;
  readonly moving: boolean;
  readonly shadowsUnderElements: boolean;
  readonly recentColors: readonly string[];
  readonly renaming: boolean;
  readonly renameDraft: string;
  /** Change tokens for the hosted cards; they re-render the container when its content changes. */
  readonly contentRevision: object;
  readonly contentEditRevision: string;
}

/** Container actions by element id; callers pass one referentially stable object. */
export interface ContainerActions {
  readonly onRenameDraftChange: (value: string) => void;
  readonly onSaveRename: (id: string) => void;
  readonly onCancelRename: () => void;
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onStartMove: (event: PointerEvent<HTMLElement>, id: string) => void;
  readonly onStartResize: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
  readonly onToggleMenu: (event: MouseEvent<HTMLButtonElement>, id: string) => void;
  readonly onHeaderButtonsVisibleChange: (id: string, visible: boolean) => void;
  readonly onSearchChange: (id: string, query: string) => void;
  readonly onOpenContentMenu: (event: MouseEvent<HTMLElement>, id: string) => void;
  readonly onWheelContent: (event: WheelEvent<HTMLElement>, id: string) => void;
  readonly onStartContentSelection: (event: PointerEvent<HTMLElement>, id: string) => void;
}
