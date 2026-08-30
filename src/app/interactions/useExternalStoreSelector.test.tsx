import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useExternalStoreSelector } from "./useExternalStoreSelector";

describe("useExternalStoreSelector", () => {
  it("does not rerender when the selected snapshot remains equal", () => {
    let snapshot = { selected: "stable", noise: 0 };
    const listeners = new Set<() => void>();
    const store = {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useExternalStoreSelector(store, (current) => current.selected);
    });

    act(() => {
      snapshot = { selected: "stable", noise: 1 };
      listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe("stable");
    expect(renders).toBe(1);

    act(() => {
      snapshot = { selected: "changed", noise: 1 };
      listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe("changed");
    expect(renders).toBe(2);
  });
});
