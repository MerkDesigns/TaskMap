import { DOCUMENT_LIMITS } from "./documentLimits";

export interface JsonSafetyIssue {
  readonly code: "json-limit-exceeded" | "json-unsafe-value";
  readonly path: string;
  readonly message: string;
}

const UNSAFE_PROPERTY_NAMES = new Set(["__proto__", "prototype", "constructor"]);

export function inspectJsonSafety(value: unknown): readonly JsonSafetyIssue[] {
  const issues: JsonSafetyIssue[] = [];
  const ancestors = new WeakSet<object>();
  let nodes = 0;
  let nodeLimitReached = false;

  function visit(current: unknown, path: string, depth: number): void {
    if (nodeLimitReached) return;
    nodes += 1;
    if (nodes > DOCUMENT_LIMITS.jsonNodes) {
      addLimit(path, `JSON value exceeds ${DOCUMENT_LIMITS.jsonNodes} nodes`);
      nodeLimitReached = true;
      return;
    }
    if (depth > DOCUMENT_LIMITS.jsonDepth) {
      addLimit(path, `JSON value exceeds ${DOCUMENT_LIMITS.jsonDepth} levels`);
      return;
    }
    if (current === null || typeof current === "boolean") return;
    if (typeof current === "string") {
      if (current.length > DOCUMENT_LIMITS.jsonStringLength) {
        addLimit(path, `String exceeds ${DOCUMENT_LIMITS.jsonStringLength} characters`);
      }
      return;
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) addUnsafe(path, "JSON numbers must be finite");
      return;
    }
    if (typeof current !== "object") {
      addUnsafe(path, `Values of type ${typeof current} are not JSON-safe`);
      return;
    }
    if (ancestors.has(current)) {
      addUnsafe(path, "Cyclic values are not JSON-safe");
      return;
    }
    ancestors.add(current);

    if (Array.isArray(current)) {
      inspectArray(current, path, depth);
    } else if (isPlainObject(current)) {
      inspectObject(current, path, depth);
    } else {
      addUnsafe(path, "Only plain objects and arrays are supported");
    }

    ancestors.delete(current);
  }

  function inspectArray(current: readonly unknown[], path: string, depth: number): void {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(current, "length");
    const length = lengthDescriptor?.value;
    if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
      addUnsafe(path, "Array length is not JSON-safe");
      return;
    }
    if (length > DOCUMENT_LIMITS.jsonArrayLength) {
      addLimit(path, `Array exceeds ${DOCUMENT_LIMITS.jsonArrayLength} entries`);
      return;
    }

    if (Object.getOwnPropertySymbols(current).length > 0) {
      addUnsafe(path, "Symbol-keyed properties are not JSON-safe");
    }
    for (const key of Object.getOwnPropertyNames(current)) {
      if (key === "length") continue;
      const propertyPath = joinPath(path, key);
      if (UNSAFE_PROPERTY_NAMES.has(key)) {
        addUnsafe(propertyPath, `Property name ${key} is not allowed`);
        continue;
      }
      if (!isCanonicalArrayIndex(key, length)) {
        addUnsafe(propertyPath, "Arrays may contain only indexed entries");
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor !== undefined && isAccessorDescriptor(descriptor)) {
        addUnsafe(propertyPath, "Accessor properties are not JSON-safe");
      }
    }

    for (let index = 0; index < length; index += 1) {
      const propertyPath = `${path}[${index}]`;
      const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
      if (descriptor === undefined) {
        addUnsafe(propertyPath, "Sparse arrays are not supported");
      } else if (!isAccessorDescriptor(descriptor)) {
        visit(descriptor.value, propertyPath, depth + 1);
      }
    }
  }

  function inspectObject(current: Record<string, unknown>, path: string, depth: number): void {
    const keys = Object.getOwnPropertyNames(current);
    if (keys.length > DOCUMENT_LIMITS.jsonObjectProperties) {
      addLimit(path, `Object exceeds ${DOCUMENT_LIMITS.jsonObjectProperties} properties`);
      return;
    }
    if (Object.getOwnPropertySymbols(current).length > 0) {
      addUnsafe(path, "Symbol-keyed properties are not JSON-safe");
    }
    for (const key of keys) {
      const propertyPath = joinPath(path, key);
      if (UNSAFE_PROPERTY_NAMES.has(key)) {
        addUnsafe(propertyPath, `Property name ${key} is not allowed`);
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor === undefined) continue;
      if (isAccessorDescriptor(descriptor)) {
        addUnsafe(propertyPath, "Accessor properties are not JSON-safe");
      } else if (!descriptor.enumerable) {
        addUnsafe(propertyPath, "Non-enumerable properties are not JSON-safe");
      } else {
        visit(descriptor.value, propertyPath, depth + 1);
      }
    }
  }

  function addLimit(path: string, message: string) {
    issues.push({ code: "json-limit-exceeded", path, message });
  }

  function addUnsafe(path: string, message: string) {
    issues.push({ code: "json-unsafe-value", path, message });
  }

  visit(value, "$", 0);
  return issues;
}

function isAccessorDescriptor(descriptor: PropertyDescriptor): boolean {
  return "get" in descriptor || "set" in descriptor;
}

function isCanonicalArrayIndex(key: string, length: number): boolean {
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < length && String(index) === key;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function joinPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}
