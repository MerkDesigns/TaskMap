import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeftPanel } from "./useLeftPanel";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const EXIT_MS = 200;

describe("useLeftPanel", () => {
  it("switches between panels instantly and shows only one", () => {
    const { result } = renderHook(() => useLeftPanel(EXIT_MS));

    act(() => result.current.show("canvases"));
    act(() => result.current.show("extensions"));

    expect(result.current.extensionsOpen).toBe(true);
    expect(result.current.canvasManagerOpen).toBe(false);
    expect(result.current.current()).toBe("extensions");
  });

  it("plays the exit before the panel unmounts", () => {
    const { result } = renderHook(() => useLeftPanel(EXIT_MS));
    act(() => result.current.show("canvases"));

    act(() => result.current.close("canvases"));
    expect(result.current.canvasManagerOpen).toBe(true);
    expect(result.current.canvasManagerClosing).toBe(true);
    expect(result.current.current()).toBe("closed");

    act(() => vi.advanceTimersByTime(EXIT_MS));
    expect(result.current.canvasManagerOpen).toBe(false);
  });

  it("ignores closing a panel that is not shown", () => {
    const { result } = renderHook(() => useLeftPanel(EXIT_MS));
    act(() => result.current.show("extensions"));

    act(() => result.current.close("canvases"));

    expect(result.current.extensionsOpen).toBe(true);
    expect(result.current.extensionsClosing).toBe(false);
  });

  it("reopening during the exit keeps the panel", () => {
    const { result } = renderHook(() => useLeftPanel(EXIT_MS));
    act(() => result.current.show("canvases"));
    act(() => result.current.close("canvases"));

    act(() => result.current.show("canvases"));
    act(() => vi.advanceTimersByTime(EXIT_MS));

    expect(result.current.canvasManagerOpen).toBe(true);
    expect(result.current.canvasManagerClosing).toBe(false);
  });

  it("restores a remembered state", () => {
    const { result } = renderHook(() => useLeftPanel(EXIT_MS));
    act(() => result.current.show("canvases"));

    act(() => result.current.restore("extensions"));
    expect(result.current.current()).toBe("extensions");

    act(() => result.current.restore("closed"));
    expect(result.current.extensionsOpen).toBe(false);
  });
});
