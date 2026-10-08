import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import { useRetainedInlineEdit, useRetainedInlineEdits } from "./useRetainedInlineEdit";

function fakeCallbacks() {
  const captured = { complete: vi.fn(() => true), cancel: vi.fn() };
  const invalidations = new Set<() => void>();
  const callbacks = {
    captureContent: vi.fn(() => captured),
    subscribeInvalidation: (listener: () => void) => {
      invalidations.add(listener);
      return () => invalidations.delete(listener);
    },
  } as unknown as RetainedActionCallbacks;
  const invalidate = () => invalidations.forEach((listener) => listener());
  return { callbacks, captured, invalidate };
}

describe("useRetainedInlineEdit", () => {
  it("commits the typed draft as one edit of the field", () => {
    const { callbacks, captured } = fakeCallbacks();
    const { result } = renderHook(() => useRetainedInlineEdit(callbacks, "text"));

    act(() => result.current.begin("card", "Old"));
    act(() => result.current.setDraft("  New text "));
    act(() => result.current.complete());

    expect(callbacks.captureContent).toHaveBeenCalledWith([
      { elementId: "card", fields: ["text"] },
    ]);
    expect(captured.complete).toHaveBeenCalledWith([
      { elementId: "card", to: { text: "New text" } },
    ]);
    expect(result.current.editingId).toBeNull();
    expect(result.current.draft).toBe("");
  });

  it("ends without committing anything", () => {
    const { callbacks, captured } = fakeCallbacks();
    const { result } = renderHook(() => useRetainedInlineEdit(callbacks, "text"));

    act(() => result.current.begin("card", "Old"));
    act(() => result.current.setDraft("Discarded"));
    act(() => result.current.end());

    expect(captured.complete).not.toHaveBeenCalled();
    expect(captured.cancel).toHaveBeenCalledOnce();
    expect(result.current.editingId).toBeNull();
  });

  it("drops the draft when the document changes underneath", () => {
    const { callbacks, invalidate } = fakeCallbacks();
    const { result } = renderHook(() => useRetainedInlineEdit(callbacks, "text"));

    act(() => result.current.begin("card", "Old"));
    act(() => invalidate());

    expect(result.current.draft).toBe("");
  });
});

describe("useRetainedInlineEdits", () => {
  it("ends every open edit at once without committing", () => {
    const { callbacks, captured } = fakeCallbacks();
    const { result } = renderHook(() => useRetainedInlineEdits(callbacks));

    act(() => result.current.rename.begin("box", "Box"));
    act(() => result.current.card.begin("card", "Card"));
    act(() => result.current.endAll());

    expect(result.current.rename.editingId).toBeNull();
    expect(result.current.card.editingId).toBeNull();
    expect(captured.complete).not.toHaveBeenCalled();
  });
});
