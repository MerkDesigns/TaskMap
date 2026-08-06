export type TransientInteractionKind = "pointer" | "drag" | "resize" | "selection-box" | "viewport";

export interface TransientInteractionSnapshot {
  readonly activeInteraction: {
    readonly kind: TransientInteractionKind;
  } | null;
}

export type TransientInteractionListener = () => void;
export type UnsubscribeTransientInteraction = () => void;

/**
 * Read-only application boundary for frame-frequency interaction previews.
 * The Phase 4 controller will own writes and commit persistent results through
 * application commands rather than through this service or Redux.
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
