import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { TaskMapDocument } from "../domain/document/documentTypes";
import { captureRetainedViewCopy, pasteRetainedViewCopy } from "./retainedViewClipboard";
import { useRetainedClipboard, type RetainedClipboardPorts } from "./useRetainedClipboard";

vi.mock("./retainedViewClipboard", () => ({
  captureRetainedViewCopy: vi.fn(),
  pasteRetainedViewCopy: vi.fn(),
}));
const capture = vi.mocked(captureRetainedViewCopy);
const paste = vi.mocked(pasteRetainedViewCopy);

let active = true;
const copy = () =>
  ({ captured: { isActive: () => active, cancel: vi.fn() } }) as unknown as ReturnType<
    typeof captureRetainedViewCopy
  >;

beforeEach(() => {
  vi.clearAllMocks();
  active = true;
  capture.mockImplementation(copy);
});

function setup(selection: string[] = [], locked: string[] = []) {
  const invalidations = new Set<() => void>();
  const ports: RetainedClipboardPorts = {
    callbacks: {
      subscribeInvalidation: (listener: () => void) => {
        invalidations.add(listener);
        return () => invalidations.delete(listener);
      },
    } as unknown as RetainedActionCallbacks,
    document: () => ({}) as TaskMapDocument,
    selection: () => selection,
    isDeletionLocked: (id) => locked.includes(id),
    cardPosition: () => undefined,
    canvasPoint: (x, y) => ({ x, y }),
    containerCardIndex: (id) => (id === "box" ? 2 : undefined),
    deleteElements: vi.fn(),
    closeContextMenus: vi.fn(),
    onPasted: vi.fn(),
    onPasteFailed: vi.fn(),
  };
  const { result } = renderHook(() => useRetainedClipboard(ports));
  const invalidate = () => act(() => invalidations.forEach((listener) => listener()));
  return { clipboard: () => result.current, ports, invalidate };
}

const copiedIds = () => capture.mock.calls[capture.mock.calls.length - 1]?.[2];

describe("useRetainedClipboard", () => {
  it("copies the element, or its whole multi-selection", () => {
    const { clipboard } = setup(["a", "b"]);

    act(() => clipboard().copy("c"));
    expect(copiedIds()).toEqual(["c"]);
    act(() => clipboard().copy("a"));
    expect(copiedIds()).toEqual(["a", "b"]);
    expect(clipboard().hasCopy).toBe(true);
  });

  it("cuts only the unlocked elements, and nothing when all are locked", () => {
    const { clipboard, ports } = setup(["a", "b"], ["b", "c"]);

    act(() => clipboard().cut("a"));
    expect(copiedIds()).toEqual(["a"]);
    expect(ports.deleteElements).toHaveBeenCalledWith(["a"]);

    act(() => clipboard().cut("c"));
    expect(ports.deleteElements).toHaveBeenCalledOnce();
  });

  it("pastes a copy once, into a container when it still exists", () => {
    paste.mockReturnValue({ result: { ok: true }, inserted: [] } as never);
    const { clipboard, ports } = setup(["a"]);
    act(() => void clipboard().copySelection());

    act(() => clipboard().paste(10, 20, "box"));
    act(() => clipboard().paste(10, 20));

    expect(paste).toHaveBeenCalledOnce();
    expect(paste.mock.calls[0][4]).toEqual({ containerId: "box", cardIndex: 2 });
    expect(ports.onPasted).toHaveBeenCalledOnce();
    expect(clipboard().hasCopy).toBe(false);
  });

  it("reports a paste the document no longer accepts", () => {
    paste.mockReturnValue({ result: { ok: false }, inserted: [] } as never);
    const { clipboard, ports } = setup(["a"]);
    act(() => void clipboard().copySelection());

    act(() => clipboard().paste(0, 0, "gone"));

    expect(paste.mock.calls[0][4]).toBeUndefined();
    expect(ports.onPasteFailed).toHaveBeenCalledOnce();
  });

  it("drops a copy the document invalidated, and keeps one that is still active", () => {
    const { clipboard, invalidate } = setup(["a"]);
    act(() => void clipboard().copySelection());

    invalidate();
    expect(clipboard().hasCopy).toBe(true);

    active = false;
    invalidate();
    expect(clipboard().hasCopy).toBe(false);
  });

  it("copies nothing on Ctrl+C without a selection", () => {
    const { clipboard } = setup();

    let copied = true;
    act(() => {
      copied = clipboard().copySelection();
    });

    expect(copied).toBe(false);
    expect(capture).not.toHaveBeenCalled();
  });
});
