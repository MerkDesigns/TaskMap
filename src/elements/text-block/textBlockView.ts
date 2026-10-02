import type { MouseEvent, PointerEvent } from "react";
import type { ElementExtensions } from "../../types";

export interface ElementGeometryView {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Transient presentation state of a text block; everything persistent is read from its element. */
export interface TextBlockViewState {
  readonly layer: number;
  /**
   * Where the element is shown: its stored geometry, or the live preview while it is being moved
   * or resized (the document only changes when the gesture completes).
   */
  readonly geometry: ElementGeometryView;
  /** Installed extensions, from the retained extension projection. */
  readonly extensions: ElementExtensions | undefined;
  readonly selected: boolean;
  /** Part of a multi-element selection: presses move the group instead of selecting. */
  readonly multiSelected: boolean;
  readonly entering: boolean;
  readonly deleting: boolean;
  readonly pulsing: boolean;
  readonly moving: boolean;
  readonly shadowsUnderElements: boolean;
  readonly recentColors: readonly string[];
  readonly editing: boolean;
  readonly draft: string;
  readonly renaming: boolean;
  readonly renameDraft: string;
}

/** Text block actions by element id; callers pass one referentially stable object. */
export interface TextBlockActions {
  readonly onDraftChange: (value: string) => void;
  readonly onSave: (id: string) => void;
  readonly onCancel: () => void;
  readonly onRenameDraftChange: (value: string) => void;
  readonly onSaveRename: (id: string) => void;
  readonly onCancelRename: () => void;
  readonly onStartEdit: (id: string) => void;
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onStartMove: (event: PointerEvent<HTMLElement>, id: string) => void;
  readonly onStartResize: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
  readonly onToggleMenu: (event: MouseEvent<HTMLButtonElement>, id: string) => void;
  readonly onTogglePrivacy: (id: string) => void;
  readonly onToggleLock: (id: string) => void;
  readonly onUpdateAccent: (id: string, accent: string) => void;
  readonly onRememberRecentColor: (color?: string) => void;
  readonly onHeaderButtonsVisibleChange: (id: string, visible: boolean) => void;
}
