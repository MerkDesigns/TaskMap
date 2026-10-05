import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToastQueue } from "./useToastQueue";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useToastQueue", () => {
  it("shows a toast, then plays its exit before removing it", () => {
    const { result } = renderHook(() => useToastQueue());

    act(() => result.current.showToast({ tone: "info", title: "Saved", duration: 1000 }));
    expect(result.current.toasts).toMatchObject([{ title: "Saved", exiting: false }]);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.toasts).toMatchObject([{ title: "Saved", exiting: true }]);

    act(() => vi.advanceTimersByTime(260));
    expect(result.current.toasts).toEqual([]);
  });

  it("keeps the four newest toasts", () => {
    const { result } = renderHook(() => useToastQueue());

    act(() => {
      for (const title of ["1", "2", "3", "4", "5"])
        result.current.showToast({ tone: "info", title });
    });

    expect(result.current.toasts.map((toast) => toast.title)).toEqual(["5", "4", "3", "2"]);
  });

  it("stops its timers when unmounted", () => {
    const { result, unmount } = renderHook(() => useToastQueue());
    act(() => result.current.showToast({ tone: "error", title: "Failed" }));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
