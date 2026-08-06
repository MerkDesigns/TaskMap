export function areJsonValuesDeepEqual(left: unknown, right: unknown): boolean {
  return compareValues(left, right, {
    leftAncestors: new WeakSet(),
    rightAncestors: new WeakSet(),
  });
}

interface ComparisonState {
  readonly leftAncestors: WeakSet<object>;
  readonly rightAncestors: WeakSet<object>;
}

function compareValues(left: unknown, right: unknown, state: ComparisonState): boolean {
  if (typeof left === "function" || typeof right === "function") return false;
  const leftIsObject = left !== null && typeof left === "object";
  const rightIsObject = right !== null && typeof right === "object";
  if (!leftIsObject || !rightIsObject) return Object.is(left, right);
  if (state.leftAncestors.has(left) || state.rightAncestors.has(right)) return false;

  state.leftAncestors.add(left);
  state.rightAncestors.add(right);
  try {
    if (Array.isArray(left) || Array.isArray(right)) {
      return Array.isArray(left) && Array.isArray(right) && arraysEqual(left, right, state);
    }
    if (!isPlainObject(left) || !isPlainObject(right)) return false;
    return objectsEqual(left, right, state);
  } finally {
    state.leftAncestors.delete(left);
    state.rightAncestors.delete(right);
  }
}

function arraysEqual(
  left: readonly unknown[],
  right: readonly unknown[],
  state: ComparisonState,
): boolean {
  if (left.length !== right.length) return false;
  if (Object.getOwnPropertySymbols(left).length > 0) return false;
  if (Object.getOwnPropertySymbols(right).length > 0) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftDescriptor = Object.getOwnPropertyDescriptor(left, String(index));
    const rightDescriptor = Object.getOwnPropertyDescriptor(right, String(index));
    if (!dataDescriptorsEqual(leftDescriptor, rightDescriptor, state)) return false;
  }
  return (
    Object.getOwnPropertyNames(left).length === left.length + 1 &&
    Object.getOwnPropertyNames(right).length === right.length + 1
  );
}

function objectsEqual(left: object, right: object, state: ComparisonState): boolean {
  if (Object.getOwnPropertySymbols(left).length > 0) return false;
  if (Object.getOwnPropertySymbols(right).length > 0) return false;
  const leftKeys = Object.getOwnPropertyNames(left);
  const rightKeys = Object.getOwnPropertyNames(right);
  if (leftKeys.length !== rightKeys.length) return false;
  const rightKeySet = new Set(rightKeys);
  for (const key of leftKeys) {
    if (!rightKeySet.has(key)) return false;
    const leftDescriptor = Object.getOwnPropertyDescriptor(left, key);
    const rightDescriptor = Object.getOwnPropertyDescriptor(right, key);
    if (!dataDescriptorsEqual(leftDescriptor, rightDescriptor, state)) return false;
  }
  return true;
}

function dataDescriptorsEqual(
  left: PropertyDescriptor | undefined,
  right: PropertyDescriptor | undefined,
  state: ComparisonState,
): boolean {
  if (left === undefined || right === undefined) return false;
  if (!("value" in left) || !("value" in right)) return false;
  if (!left.enumerable || !right.enumerable) return false;
  return compareValues(left.value, right.value, state);
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
