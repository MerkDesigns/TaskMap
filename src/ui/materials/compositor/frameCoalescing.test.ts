// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  consumeComposeFrame,
  createComposeFrameState,
  disposeComposeFrames,
  notifyComposeDirty,
} from "./frameCoalescing";

describe("compose-frame coalescing", () => {
  it("coalesces 120 transform samples into one logical scheduled frame and keeps the latest", () => {
    const stringify = vi.spyOn(JSON, "stringify");
    const parse = vi.spyOn(JSON, "parse");
    const clone = vi.spyOn(globalThis, "structuredClone");
    let state = createComposeFrameState<{ readonly sample: number }>();
    let scheduled = 0;
    for (let sample = 0; sample < 120; sample += 1) {
      const transition = notifyComposeDirty(state, { sample });
      state = transition.state;
      if (transition.shouldScheduleFrame) scheduled += 1;
    }
    const forbiddenCalls = [
      stringify.mock.calls.length,
      parse.mock.calls.length,
      clone.mock.calls.length,
    ];
    stringify.mockRestore();
    parse.mockRestore();
    clone.mockRestore();

    expect(scheduled).toBe(1);
    expect(state).toMatchObject({ framePending: true, latest: { sample: 119 } });
    expect(forbiddenCalls).toEqual([0, 0, 0]);
  });

  it("consumes the latest state and permits a subsequent frame", () => {
    let state = notifyComposeDirty(createComposeFrameState<number>(), 1).state;
    state = notifyComposeDirty(state, 2).state;
    const consumed = consumeComposeFrame(state);
    expect(consumed.value).toBe(2);
    expect(consumed.state.framePending).toBe(false);

    const next = notifyComposeDirty(consumed.state, 3);
    expect(next.shouldScheduleFrame).toBe(true);
    expect(consumeComposeFrame(next.state).value).toBe(3);
  });

  it("disposal cancels logical pending work and ignores future notifications", () => {
    const pending = notifyComposeDirty(createComposeFrameState<number>(), 1).state;
    const disposed = disposeComposeFrames(pending);
    expect(disposed).toEqual({ disposed: true, framePending: false, latest: null });
    expect(consumeComposeFrame(disposed).value).toBeNull();
    expect(notifyComposeDirty(disposed, 2)).toEqual({
      state: disposed,
      shouldScheduleFrame: false,
    });
  });
});
