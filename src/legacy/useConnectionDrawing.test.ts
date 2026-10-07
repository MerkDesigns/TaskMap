import { act, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import { useConnectionDrawing, type ConnectionDrawingPorts } from "./useConnectionDrawing";

afterEach(() => {
  document.body.innerHTML = "";
});

const bounds = { x: 0, y: 0, width: 100, height: 50 };

function setup({ connected = false } = {}) {
  const completion = { complete: vi.fn(() => ({ ok: true })), cancel: vi.fn() };
  const ports: ConnectionDrawingPorts = {
    callbacks: {
      captureConnection: vi.fn(() => completion),
      subscribeInvalidation: () => () => undefined,
    } as unknown as RetainedActionCallbacks,
    boundsOf: (id) => (id === "missing" ? null : bounds),
    connected: () => connected,
    isMindmapNode: (id) => id === "node",
    canvasPoint: (x, y) => ({ x, y }),
    canvasSize: () => ({ width: 1000, height: 800 }),
    mindmapAccent: () => "#123",
    onNodeCreated: vi.fn(),
    closeContextMenus: vi.fn(),
  };
  const { result } = renderHook(() => useConnectionDrawing(ports));
  return { drawing: () => result.current, ports, completion };
}

const press = {
  button: 0,
  pointerId: 1,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  currentTarget: { closest: () => null },
} as unknown as PointerEvent<HTMLButtonElement>;

/** Puts a port of `owner` under the point (10, 10), where elementFromPoint finds it. */
function portUnderPointer(owner: string) {
  const port = document.body.appendChild(document.createElement("button"));
  port.dataset.connectionPort = "left";
  port.dataset.connectionPortOwner = owner;
  document.elementFromPoint = () => port;
}

describe("useConnectionDrawing", () => {
  it("draws only in connection mode", () => {
    const { drawing, ports } = setup();

    act(() => drawing().start(press, "box", "right"));
    expect(ports.callbacks.captureConnection).not.toHaveBeenCalled();

    act(() => drawing().setConnectionMode(true));
    act(() => drawing().start(press, "box", "right"));
    expect(drawing().draft).toMatchObject({ sourceId: "box", sourcePort: "right" });
  });

  it("connects to the port the pointer is released on", () => {
    const { drawing, completion } = setup();
    act(() => drawing().setConnectionMode(true));
    act(() => drawing().start(press, "box", "right"));
    portUnderPointer("other");

    act(() => void drawing().finish({ pointerId: 1, clientX: 10, clientY: 10 }));

    expect(completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({ target: { elementId: "other", portId: "left" } }),
    );
    expect(drawing().draft).toBeNull();
  });

  it("ignores ports already connected to the source", () => {
    const { drawing, completion } = setup({ connected: true });
    act(() => drawing().setConnectionMode(true));
    act(() => drawing().start(press, "box", "right"));
    portUnderPointer("other");

    act(() => void drawing().finish({ pointerId: 1, clientX: 10, clientY: 10 }));

    expect(completion.complete).not.toHaveBeenCalled();
    expect(completion.cancel).toHaveBeenCalled();
  });

  it("grows a mind map with a new node when released on empty canvas", () => {
    const { drawing, completion, ports } = setup();
    document.elementFromPoint = () => document.body;
    act(() => drawing().setConnectionMode(true));
    act(() => drawing().start(press, "node", "bottom"));

    act(() => void drawing().finish({ pointerId: 1, clientX: 1200, clientY: 300 }));

    expect(completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        newNode: expect.objectContaining({
          geometry: { x: 1000, y: 300, width: 1, height: 1 },
          data: { text: "Mindmap", accent: "#123" },
        }),
      }),
    );
    expect(ports.onNodeCreated).toHaveBeenCalled();
  });

  it("abandons the connection when C is released", () => {
    const { drawing, completion } = setup();
    act(() => drawing().setConnectionMode(true));
    act(() => drawing().start(press, "box", "right"));

    act(() => drawing().setConnectionMode(false));

    expect(completion.cancel).toHaveBeenCalled();
    expect(drawing().draft).toBeNull();
  });

  it("leaves other pointers alone", () => {
    const { drawing } = setup();
    act(() => drawing().setConnectionMode(true));
    act(() => drawing().start(press, "box", "right"));

    let handled = true;
    act(() => {
      handled = drawing().move({ pointerId: 2, clientX: 5, clientY: 5 });
    });

    expect(handled).toBe(false);
    expect(drawing().draft?.pointerId).toBe(1);
  });
});
