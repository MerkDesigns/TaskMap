import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClosingMenu } from "./useClosingMenu";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useClosingMenu", () => {
  it("keeps a closed menu for its exit animation", () => {
    const { result } = renderHook(() => useClosingMenu<{ id: string }>());
    const menu = { id: "card" };

    act(() => result.current.open(menu));
    expect(result.current.menu).toBe(menu);

    act(() => result.current.close());
    expect(result.current.menu).toBeNull();
    expect(result.current.closing).toBe(menu);

    act(() => vi.advanceTimersByTime(110));
    expect(result.current.closing).toBeNull();
  });

  it("replaces an open menu in one handler without leaving the old one closing", () => {
    const { result } = renderHook(() => useClosingMenu<{ id: string }>());
    act(() => result.current.open({ id: "first" }));

    act(() => {
      result.current.close();
      result.current.open({ id: "second" });
    });

    expect(result.current.menu).toEqual({ id: "second" });
    expect(result.current.closing).toBeNull();
  });

  it("does nothing when closing a menu that is not open", () => {
    const { result } = renderHook(() => useClosingMenu<{ id: string }>());

    act(() => result.current.close());

    expect(result.current.closing).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
