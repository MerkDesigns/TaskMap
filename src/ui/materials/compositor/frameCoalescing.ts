export interface ComposeFrameState<Value> {
  readonly disposed: boolean;
  readonly framePending: boolean;
  readonly latest: Value | null;
}

export interface ComposeDirtyTransition<Value> {
  readonly state: ComposeFrameState<Value>;
  readonly shouldScheduleFrame: boolean;
}

export interface ComposeFrameConsumption<Value> {
  readonly state: ComposeFrameState<Value>;
  readonly value: Value | null;
}

export function createComposeFrameState<Value>(): ComposeFrameState<Value> {
  return frameState<Value>(false, false, null);
}

export function notifyComposeDirty<Value>(
  current: ComposeFrameState<Value>,
  latest: Value,
): ComposeDirtyTransition<Value> {
  if (current.disposed) return dirtyTransition(current, false);
  return dirtyTransition(frameState(false, true, latest), !current.framePending);
}

export function consumeComposeFrame<Value>(
  current: ComposeFrameState<Value>,
): ComposeFrameConsumption<Value> {
  if (current.disposed || !current.framePending) {
    return Object.freeze({ state: current, value: null });
  }
  return Object.freeze({ state: frameState<Value>(false, false, null), value: current.latest });
}

export function disposeComposeFrames<Value>(
  current: ComposeFrameState<Value>,
): ComposeFrameState<Value> {
  if (current.disposed) return current;
  return frameState<Value>(true, false, null);
}

function frameState<Value>(
  disposed: boolean,
  framePending: boolean,
  latest: Value | null,
): ComposeFrameState<Value> {
  return Object.freeze({ disposed, framePending, latest });
}

function dirtyTransition<Value>(
  next: ComposeFrameState<Value>,
  shouldScheduleFrame: boolean,
): ComposeDirtyTransition<Value> {
  return Object.freeze({ state: next, shouldScheduleFrame });
}
