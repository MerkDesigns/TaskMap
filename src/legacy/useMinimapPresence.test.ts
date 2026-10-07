import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MINIMAP_VISIBILITY_DURATION_MS } from "../ui/patterns/workspace";
import { useMinimapPresence } from "./useMinimapPresence";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const render = (enabled = true, panning = false) =>
  renderHook((props) => useMinimapPresence(props.enabled, props.panning), {
    initialProps: { enabled, panning },
  });

describe("useMinimapPresence", () => {
  it("shows, lingers, fades out and then unmounts", () => {
    const { result } = render();

    act(() => result.current.show());
    expect(result.current).toMatchObject({ mounted: true, visible: true });
    act(() => vi.advanceTimersByTime(2200));
    expect(result.current).toMatchObject({ mounted: true, visible: false });
    act(() => vi.advanceTimersByTime(MINIMAP_VISIBILITY_DURATION_MS));
    expect(result.current.mounted).toBe(false);
  });

  it("stays up while held or panning and fades once released", () => {
    const { result, rerender } = render();

    act(() => result.current.hold(true));
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.visible).toBe(true);

    act(() => result.current.hold(false));
    rerender({ enabled: true, panning: true });
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.visible).toBe(true);

    rerender({ enabled: true, panning: false });
    act(() => vi.advanceTimersByTime(2200));
    expect(result.current.visible).toBe(false);
  });

  it("hides at once when turned off and ignores camera changes while off", () => {
    const { result, rerender } = render();
    act(() => result.current.show());

    rerender({ enabled: false, panning: false });
    expect(result.current).toMatchObject({ mounted: false, visible: false });
    act(() => result.current.show());
    expect(result.current.mounted).toBe(false);
  });
});
