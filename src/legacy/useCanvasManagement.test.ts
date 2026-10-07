import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { LeftPanelState } from "./useLeftPanel";
import { useCanvasManagement, type CanvasManagementPorts } from "./useCanvasManagement";

function setup({ panel = "closed" as LeftPanelState, ids = ["one", "two", "three"] } = {}) {
  let active = "one";
  const completed: unknown[] = [];
  const capture = () => ({
    complete: vi.fn((input: unknown) => {
      completed.push(input);
      return { ok: true };
    }),
  });
  const callbacks = {
    switchCanvas: vi.fn((id: string) => {
      active = id;
      return { ok: true };
    }),
    captureCreateCanvas: vi.fn(capture),
    captureCanvasDetails: vi.fn(capture),
    captureRemoveCanvas: vi.fn(capture),
    captureCanvasOrder: vi.fn(capture),
  } as unknown as RetainedActionCallbacks;
  const ports: CanvasManagementPorts = {
    callbacks,
    activeCanvasId: () => active,
    canvasIds: () => ids,
    resetPresentation: vi.fn(),
    leftPanel: { show: vi.fn(), current: () => panel, restore: vi.fn() },
    closeQuickExtensions: vi.fn(),
  };
  const { result } = renderHook(() => useCanvasManagement(ports));
  return { result, ports, callbacks, completed, active: () => active };
}

afterEach(() => vi.useRealTimers());

describe("useCanvasManagement", () => {
  it("creates a canvas with a trimmed name and a size within bounds", () => {
    const { result, completed, ports } = setup();

    result.current.create({ name: "  ", width: 50, height: Number.NaN });

    expect(completed[0]).toMatchObject({
      name: "Untitled canvas",
      settings: { width: 600, height: 3000 },
      elementOrder: [],
    });
    expect(completed[0]).toHaveProperty("id", expect.stringMatching(/^canvas-/));
    expect(ports.resetPresentation).toHaveBeenCalledTimes(1);
  });

  it("switches canvas and drops the old canvas's presentation, unless it is already open", () => {
    const { result, callbacks, ports } = setup();

    result.current.select("one");
    result.current.select("two");

    expect(callbacks.switchCanvas).toHaveBeenCalledTimes(1);
    expect(ports.resetPresentation).toHaveBeenCalledTimes(1);
  });

  it("resets the presentation only when the open canvas is deleted", () => {
    const { result, ports } = setup();

    result.current.remove("two");
    result.current.remove("one");

    expect(ports.resetPresentation).toHaveBeenCalledTimes(1);
  });

  it("cycles in the order it started with, wrapping around, with the browser shown", () => {
    const { result, ports, active } = setup();

    act(() => result.current.cycle(-1));

    expect(active()).toBe("three");
    expect(result.current.cycleHighlightId).toBe("three");
    expect(result.current.cycling()).toBe(true);
    expect(ports.leftPanel.show).toHaveBeenCalledWith("canvases");
    expect(ports.closeQuickExtensions).toHaveBeenCalled();
  });

  it("puts the side panel back as it was shortly after the cycle ends", () => {
    vi.useFakeTimers();
    const { result, ports } = setup({ panel: "extensions" });

    act(() => result.current.cycle(1));
    act(() => result.current.cycle(1));
    act(() => result.current.finishCycle());

    expect(result.current.cycleHighlightId).toBeNull();
    expect(ports.leftPanel.restore).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(ports.leftPanel.restore).toHaveBeenCalledWith("extensions");
  });

  it("does not cycle with a single canvas", () => {
    const { result, callbacks } = setup({ ids: ["one"] });

    act(() => result.current.cycle(1));

    expect(callbacks.switchCanvas).not.toHaveBeenCalled();
    expect(result.current.cycling()).toBe(false);
  });
});
