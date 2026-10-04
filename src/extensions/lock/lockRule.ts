/** Anything that may carry the Lock extension's projected state. */
export interface Lockable {
  readonly extensions?: { readonly lock?: { readonly enabled: boolean } };
}

/** An element with its container, as far as deletion protection is concerned. */
export interface LockableMember extends Lockable {
  readonly id: string;
  readonly containerId?: string | null;
}

/** An engaged lock keeps the element from moving, resizing and being deleted. */
export const isLocked = (element: Lockable | undefined): boolean =>
  element?.extensions?.lock?.enabled === true;

/**
 * The elements a deletion must keep: every locked element, and every container holding a locked
 * child, since deleting a container deletes its children. The document's "allow deleting locked
 * elements" setting lifts the protection entirely.
 */
export function deletionProtectedIds(
  elements: Iterable<LockableMember>,
  allowLockedDeletion: boolean,
): ReadonlySet<string> {
  const protectedIds = new Set<string>();
  if (allowLockedDeletion) return protectedIds;
  for (const element of elements) {
    if (!isLocked(element)) continue;
    protectedIds.add(element.id);
    if (element.containerId) protectedIds.add(element.containerId);
  }
  return protectedIds;
}
