import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "./useAutosave";

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves the latest ref value after the debounce", async () => {
    const dataRef = { current: { value: 1 } };
    const save = vi.fn(async () => undefined);

    renderHook(() =>
      useAutosave({
        enabled: true,
        dataRef,
        dependencies: [dataRef.current.value],
        save,
        onError: vi.fn(),
      }),
    );

    dataRef.current = { value: 2 };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ value: 2 });
  });

  it("flushes immediately and cancels the pending debounce", async () => {
    const dataRef = { current: { value: 1 } };
    const save = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useAutosave({
        enabled: true,
        dataRef,
        dependencies: [dataRef.current.value],
        save,
        onError: vi.fn(),
      }),
    );

    dataRef.current = { value: 3 };
    await act(async () => {
      await result.current.flushAutosave();
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ value: 3 });
  });

  it("reports and rethrows flush failures so closing can be cancelled", async () => {
    const error = new Error("disk full");
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAutosave({
        enabled: true,
        dataRef: { current: { value: 1 } },
        dependencies: [],
        save: vi.fn().mockRejectedValue(error),
        onError,
      }),
    );

    await expect(result.current.flushAutosave()).rejects.toBe(error);
    expect(onError).toHaveBeenCalledWith(error);
  });
});
