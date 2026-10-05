import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useElementPresenceMarks } from "./useElementPresenceMarks";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useElementPresenceMarks", () => {
  it("marks an element as entering until its enter animation has played", () => {
    const { result } = renderHook(() => useElementPresenceMarks());

    act(() => result.current.animateIn("textCards", "card"));
    expect(result.current.entering.textCards).toEqual(["card"]);
    expect(result.current.entering.containers).toEqual([]);

    act(() => vi.advanceTimersByTime(180));
    expect(result.current.entering.textCards).toEqual([]);
  });

  it("restarts a pulse instead of stacking it", () => {
    const { result } = renderHook(() => useElementPresenceMarks());

    act(() => {
      result.current.pulse("textBlocks", "block");
      result.current.pulse("textBlocks", "block");
    });
    expect(result.current.pulsing.textBlocks).toEqual(["block"]);

    act(() => vi.advanceTimersByTime(260));
    expect(result.current.pulsing.textBlocks).toEqual([]);
  });

  it("keeps deletion marks until they are cleared", () => {
    const { result } = renderHook(() => useElementPresenceMarks());
    const ids = { containers: ["box"], textCards: ["card"], textBlocks: [], images: ["image"] };

    act(() => result.current.markDeleting(ids));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.deleting).toEqual(ids);

    act(() => result.current.clearDeleting());
    expect(result.current.deleting.images).toEqual([]);
  });

  it("stops its timers when the canvas unmounts", () => {
    const { result, unmount } = renderHook(() => useElementPresenceMarks());
    act(() => result.current.animateIn("images", "image"));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
