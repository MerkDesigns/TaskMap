export type TransientInteractionKind =
  "pointer" | "drag" | "move" | "resize" | "selection-box" | "pan" | "viewport";

export interface TransientInteractionSnapshot {
  readonly activeInteraction: {
    readonly kind: TransientInteractionKind;
    readonly pointerId?: number;
    readonly targetIds?: readonly string[];
  } | null;
}

export type TransientInteractionListener = () => void;
export type UnsubscribeTransientInteraction = () => void;

/**
 * Read-only application boundary for frame-frequency interaction previews.
 * The Phase 4 controller owns writes and commits persistent results through a
 * narrow completion port rather than through this service or Redux.
 */
export interface TransientInteractionService {
  readonly getSnapshot: () => TransientInteractionSnapshot;
  readonly subscribe: (listener: TransientInteractionListener) => UnsubscribeTransientInteraction;
}

const idleSnapshot: TransientInteractionSnapshot = Object.freeze({
  activeInteraction: null,
});

export function createDefaultTransientInteractionService(): TransientInteractionService {
  return {
    getSnapshot: () => idleSnapshot,
    subscribe: () => () => undefined,
  };
}
