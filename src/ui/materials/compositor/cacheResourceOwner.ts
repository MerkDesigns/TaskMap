import type { CacheBuildDescriptor, DisposableCacheResource } from "./compositorTypes";

export interface AcceptedCacheResource<Resource extends DisposableCacheResource> {
  readonly descriptor: CacheBuildDescriptor;
  readonly resource: Resource;
}

export interface CacheResourceOwner<Resource extends DisposableCacheResource> {
  readonly getAccepted: () => AcceptedCacheResource<Resource> | null;
  readonly accept: (descriptor: CacheBuildDescriptor, resource: Resource) => boolean;
  readonly reject: (resource: Resource) => void;
  readonly dispose: () => void;
}

export function createCacheResourceOwner<
  Resource extends DisposableCacheResource,
>(): CacheResourceOwner<Resource> {
  let disposed = false;
  let accepted: AcceptedCacheResource<Resource> | null = null;
  const closed = new WeakSet<Resource>();

  const closeOnce = (resource: Resource) => {
    if (closed.has(resource)) return;
    closed.add(resource);
    resource.close();
  };

  return Object.freeze({
    getAccepted: () => accepted,
    accept: (descriptor: CacheBuildDescriptor, resource: Resource) => {
      if (accepted?.resource === resource) return true;
      if (disposed || isOlderThanAccepted(descriptor, accepted?.descriptor ?? null)) {
        closeOnce(resource);
        return false;
      }
      if (accepted?.resource !== resource) closeAccepted(accepted, closeOnce);
      accepted = Object.freeze({ descriptor, resource });
      return true;
    },
    reject: closeOnce,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      closeAccepted(accepted, closeOnce);
      accepted = null;
    },
  });
}

function isOlderThanAccepted(
  candidate: CacheBuildDescriptor,
  accepted: CacheBuildDescriptor | null,
): boolean {
  if (!accepted) return false;
  if (candidate.request.lifecycleEpoch !== accepted.request.lifecycleEpoch) {
    return candidate.request.lifecycleEpoch < accepted.request.lifecycleEpoch;
  }
  return candidate.request.buildSerial <= accepted.request.buildSerial;
}

function closeAccepted<Resource extends DisposableCacheResource>(
  accepted: AcceptedCacheResource<Resource> | null,
  closeOnce: (resource: Resource) => void,
): void {
  if (accepted) closeOnce(accepted.resource);
}
