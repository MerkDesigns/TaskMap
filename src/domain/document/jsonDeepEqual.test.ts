// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { areJsonValuesDeepEqual } from "./jsonDeepEqual";

describe("JSON-compatible deep equality", () => {
  it("compares primitives, arrays, plain-object keys, and nested values", () => {
    expect(
      areJsonValuesDeepEqual({ a: [1, null, { b: true }] }, { a: [1, null, { b: true }] }),
    ).toBe(true);
    expect(areJsonValuesDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(areJsonValuesDeepEqual([1, 2], [2, 1])).toBe(false);
  });

  it("uses Object.is deliberately for primitives", () => {
    expect(areJsonValuesDeepEqual("value", "value")).toBe(true);
    expect(areJsonValuesDeepEqual(Number.NaN, Number.NaN)).toBe(true);
    expect(areJsonValuesDeepEqual(0, -0)).toBe(false);
    expect(areJsonValuesDeepEqual(undefined, undefined)).toBe(true);
  });

  it("inspects the same valid object reference before accepting it", () => {
    const shared = { nested: [1, { valid: true }] };
    expect(areJsonValuesDeepEqual(shared, shared)).toBe(true);
  });

  it("rejects the same Date and accessor-bearing references without invoking accessors", () => {
    const date = new Date(0);
    const getter = vi.fn(() => 1);
    const value = {};
    Object.defineProperty(value, "private", { enumerable: true, get: getter });

    expect(areJsonValuesDeepEqual(date, date)).toBe(false);
    expect(areJsonValuesDeepEqual(value, value)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects the same cyclic object without recursion failure", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(areJsonValuesDeepEqual(cyclic, cyclic)).toBe(false);
  });

  it("rejects symbol-keyed and non-enumerable properties", () => {
    const symbolKeyed = { visible: true, [Symbol("private")]: true };
    const nonEnumerable = { visible: true };
    Object.defineProperty(nonEnumerable, "private", { value: true, enumerable: false });

    expect(areJsonValuesDeepEqual(symbolKeyed, symbolKeyed)).toBe(false);
    expect(areJsonValuesDeepEqual(nonEnumerable, nonEnumerable)).toBe(false);
  });

  it("rejects sparse arrays and arrays with extra named properties", () => {
    const sparse: unknown[] = [];
    sparse.length = 2;
    sparse[1] = "present";
    const extra = [1, 2] as unknown[] & { extra?: boolean };
    extra.extra = true;

    expect(areJsonValuesDeepEqual(sparse, sparse)).toBe(false);
    expect(areJsonValuesDeepEqual(extra, extra)).toBe(false);
  });

  it("allows shared non-cyclic subobjects and does not serialize", () => {
    const shared = { value: 1 };
    const left = { first: shared, second: shared };
    const rightShared = { value: 1 };
    const right = { first: rightShared, second: rightShared };
    const stringify = vi.spyOn(JSON, "stringify");

    expect(areJsonValuesDeepEqual(left, right)).toBe(true);
    expect(stringify).not.toHaveBeenCalled();
    stringify.mockRestore();
  });
});
