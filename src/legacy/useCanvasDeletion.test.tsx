import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { ContainerElement } from "../types";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { useCanvasDeletion, type CanvasDeletionPorts } from "./useCanvasDeletion";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const box = (id: string): ContainerElement => ({
  id,
  name: id,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  accent: "#fff",
});

function setup() {
  const completeDelete = vi.fn();
  const completeClear = vi.fn(() => ({ ok: true }));
  const ports: CanvasDeletionPorts = {
    callbacks: {
      captureDelete: vi.fn(() => ({ complete: completeDelete })),
      captureRemoveCanvas: vi.fn(() => ({ complete: completeClear })),
    } as unknown as RetainedActionCallbacks,
    activeCanvas: () => ({
      id: "canvas",
      containers: [box("open"), box("locked")],
      textCards: [],
      textBlocks: [],
      images: [],
    }),
    isDeletionLocked: (id) => id === "locked",
    markDeleting: vi.fn(),
    clearDeleting: vi.fn(),
    clearSelection: vi.fn(),
    closeContextMenus: vi.fn(),
    endEditing: vi.fn(),
  };
  const hook = renderHook(() => useCanvasDeletion(ports));
  return { ...hook, ports, completeDelete, completeClear };
}

describe("useCanvasDeletion", () => {
  it("plays the exit of unlocked elements and commits the deletion when it ends", () => {
    const { result, ports, completeDelete } = setup();

    act(() => result.current.remove(["open", "locked"]));

    expect(ports.markDeleting).toHaveBeenCalledWith(
      expect.objectContaining({ containers: ["open"] }),
    );
    expect(completeDelete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(180));
    expect(completeDelete).toHaveBeenCalledOnce();
    expect(ports.clearSelection).toHaveBeenCalled();
  });

  it("drops a deletion that has not landed when the canvas is left", () => {
    const { result, ports, completeDelete } = setup();

    act(() => result.current.remove(["open"]));
    act(() => result.current.cancelPending("canvas"));
    act(() => vi.advanceTimersByTime(500));

    expect(completeDelete).not.toHaveBeenCalled();
    expect(ports.clearDeleting).toHaveBeenCalledOnce();
  });

  it("clears the canvas only once the dialog confirms it", () => {
    const { result, ports, completeClear } = setup();

    act(() => result.current.requestClear());
    expect(result.current.clearDialogOpen).toBe(true);
    expect(completeClear).not.toHaveBeenCalled();

    act(() => result.current.clear());
    expect(completeClear).toHaveBeenCalledWith(true);
    expect(ports.endEditing).toHaveBeenCalled();
    expect(result.current.clearDialogOpen).toBe(false);
  });

  it("renders the confirmation dialog while a clear is pending", () => {
    const { result } = setup();
    act(() => result.current.requestClear());

    render(<ReducedMotionProvider override>{result.current.clearDialog}</ReducedMotionProvider>);

    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });
});
