import {
  cacheBuildDescriptorsEqual,
  compareCacheBuildRequestIdentity,
  sameCacheBuildRequestIdentity,
  type CacheBuildDescriptor,
} from "./compositorTypes";

export interface CacheSchedulerState {
  readonly disposed: boolean;
  readonly active: CacheBuildDescriptor | null;
  readonly queued: CacheBuildDescriptor | null;
  readonly desired: CacheBuildDescriptor | null;
}

export interface CacheScheduleTransition {
  readonly state: CacheSchedulerState;
  readonly buildToStart: CacheBuildDescriptor | null;
}

export type CacheCompletionDecision = "accept" | "reject";

export interface CacheCompletionTransition extends CacheScheduleTransition {
  readonly decision: CacheCompletionDecision;
}

export function createCacheSchedulerState(): CacheSchedulerState {
  return state(false, null, null, null);
}

/** Newer request identity replaces the single queued slot; duplicates and stale requests do not. */
export function requestCacheBuild(
  current: CacheSchedulerState,
  descriptor: CacheBuildDescriptor,
): CacheScheduleTransition {
  if (current.disposed) return transition(current, null);

  assertRequestIdentityIsUnique(current, descriptor);
  if (current.desired) {
    const order = compareCacheBuildRequestIdentity(descriptor.request, current.desired.request);
    if (order <= 0) return transition(current, null);
  }

  if (!current.active) {
    const next = state(false, descriptor, null, descriptor);
    return transition(next, descriptor);
  }
  return transition(state(false, current.active, descriptor, descriptor), null);
}

/**
 * Only the active request can complete, and only the descriptor that is still desired is accepted.
 * A late completion for an older identity leaves current scheduling state untouched.
 */
export function completeCacheBuild(
  current: CacheSchedulerState,
  completed: CacheBuildDescriptor,
): CacheCompletionTransition {
  if (
    current.disposed ||
    !current.active ||
    !sameCacheBuildRequestIdentity(current.active, completed)
  ) {
    return completion(current, "reject", null);
  }

  const decision: CacheCompletionDecision =
    current.desired && cacheBuildDescriptorsEqual(completed, current.desired) ? "accept" : "reject";
  const nextActive = current.queued;
  const next = state(false, nextActive, null, current.desired);
  return completion(next, decision, nextActive);
}

export function disposeCacheScheduler(current: CacheSchedulerState): CacheSchedulerState {
  if (current.disposed) return current;
  return state(true, null, null, null);
}

function assertRequestIdentityIsUnique(
  current: CacheSchedulerState,
  incoming: CacheBuildDescriptor,
): void {
  for (const existing of [current.active, current.queued, current.desired]) {
    if (
      existing &&
      sameCacheBuildRequestIdentity(existing, incoming) &&
      !cacheBuildDescriptorsEqual(existing, incoming)
    ) {
      throw new Error("Cache build request identity must uniquely identify one descriptor");
    }
  }
}

function state(
  disposed: boolean,
  active: CacheBuildDescriptor | null,
  queued: CacheBuildDescriptor | null,
  desired: CacheBuildDescriptor | null,
): CacheSchedulerState {
  return Object.freeze({ disposed, active, queued, desired });
}

function transition(
  next: CacheSchedulerState,
  buildToStart: CacheBuildDescriptor | null,
): CacheScheduleTransition {
  return Object.freeze({ state: next, buildToStart });
}

function completion(
  next: CacheSchedulerState,
  decision: CacheCompletionDecision,
  buildToStart: CacheBuildDescriptor | null,
): CacheCompletionTransition {
  return Object.freeze({ state: next, decision, buildToStart });
}
