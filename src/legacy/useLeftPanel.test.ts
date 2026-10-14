import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeftPanel, useLeftPanelPresence } from "./useLeftPanel";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const EXIT_MS = 200;

function renderLeftPanel() {
  return renderHook(() => {
    const panel = useLeftPanel(EXIT_MS);
    return { ...useLeftPanelPresence(panel), panel };
  });
}

describe("useLeftPanel", () => {
  it("switches between panels instantly and shows only one", () => {
    const { result } = renderLeftPanel();

    act(() => result.current.panel.show("canvases"));
    act(() => result.current.panel.show("extensions"));

    expect(result.current.extensionsOpen).toBe(true);
    expect(result.current.canvasManagerOpen).toBe(false);
    expect(result.current.panel.current()).toBe("extensions");
  });

  it("plays the exit before the panel unmounts", () => {
    const { result } = renderLeftPanel();
    act(() => result.current.panel.show("canvases"));

    act(() => result.current.panel.close("canvases"));
    expect(result.current.canvasManagerOpen).toBe(true);
    expect(result.current.canvasManagerClosing).toBe(true);
    expect(result.current.panel.current()).toBe("closed");

    act(() => vi.advanceTimersByTime(EXIT_MS));
    expect(result.current.canvasManagerOpen).toBe(false);
  });

  it("ignores closing a panel that is not shown", () => {
    const { result } = renderLeftPanel();
    act(() => result.current.panel.show("extensions"));

    act(() => result.current.panel.close("canvases"));

    expect(result.current.extensionsOpen).toBe(true);
    expect(result.current.extensionsClosing).toBe(false);
  });

  it("reopening during the exit keeps the panel", () => {
    const { result } = renderLeftPanel();
    act(() => result.current.panel.show("canvases"));
    act(() => result.current.panel.close("canvases"));

    act(() => result.current.panel.show("canvases"));
    act(() => vi.advanceTimersByTime(EXIT_MS));

    expect(result.current.canvasManagerOpen).toBe(true);
    expect(result.current.canvasManagerClosing).toBe(false);
  });

  it("toggles a panel closed when shown and open in place of the other one", () => {
    const { result } = renderLeftPanel();
    act(() => result.current.panel.show("extensions"));

    act(() => result.current.panel.toggle("canvases"));
    expect(result.current.panel.current()).toBe("canvases");
    act(() => result.current.panel.toggle("canvases"));
    expect(result.current.canvasManagerClosing).toBe(true);
    act(() => result.current.panel.toggle("canvases"));
    expect(result.current.panel.current()).toBe("canvases");
  });

  it("does not re-render the component that owns the controller", () => {
    let ownerRenders = 0;
    const { result } = renderHook(() => {
      ownerRenders += 1;
      return useLeftPanel(EXIT_MS);
    });
    const presence = renderHook(() => useLeftPanelPresence(result.current));
    const controller = result.current;

    act(() => controller.toggle("canvases"));
    act(() => controller.toggle("canvases"));
    act(() => vi.advanceTimersByTime(EXIT_MS));

    expect(ownerRenders).toBe(1);
    expect(result.current).toBe(controller);
    expect(presence.result.current.canvasManagerOpen).toBe(false);
  });

  it("restores a remembered state", () => {
    const { result } = renderLeftPanel();
    act(() => result.current.panel.show("canvases"));

    act(() => result.current.panel.restore("extensions"));
    expect(result.current.panel.current()).toBe("extensions");

    act(() => result.current.panel.restore("closed"));
    expect(result.current.extensionsOpen).toBe(false);
  });
});
