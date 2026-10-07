import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import { DEFAULT_ELEMENT_COLORS } from "../constants";
import type { ContainerElement, TextCardElement } from "../types";
import { createContainerCardLayout, groupContainerCards } from "./containerCardLayout";
import {
  useCanvasElementCreation,
  type CanvasElementCreationPorts,
} from "./useCanvasElementCreation";

const box: ContainerElement = {
  id: "box",
  name: "Box",
  x: 100,
  y: 0,
  width: 300,
  height: 120,
  accent: "#fff",
  extensions: { autoCheckbox: { enabled: true } },
};
const cards: TextCardElement[] = [0, 1, 2].map((order) => ({
  id: `card-${order}`,
  text: `Card ${order}`,
  x: 0,
  y: 0,
  accent: "#fff",
  containerId: "box",
  order,
}));

function setup({ ok = true } = {}) {
  const created: unknown[] = [];
  const complete = vi.fn((input: unknown) => {
    created.push(input);
    return ok ? { ok: true } : { ok: false };
  });
  const callbacks = {
    captureCreateElement: () => ({ complete, cancel: vi.fn() }),
    captureNewContainerCard: vi.fn(() => ({ complete })),
  } as unknown as RetainedActionCallbacks;
  const edit = () => ({ begin: vi.fn(), end: vi.fn() });
  const ports: CanvasElementCreationPorts = {
    callbacks,
    activeCanvasId: () => "canvas-00000000-0000-4000-8000-000000000001",
    canvasPoint: (x, y) => ({ x, y }),
    canvasSize: () => ({ width: 3000, height: 3000 }),
    colors: () => DEFAULT_ELEMENT_COLORS,
    containers: () => [box],
    textBlocks: () => [],
    textCards: () => cards,
    cardLayout: () => createContainerCardLayout(cards, groupContainerCards(cards), {}),
    scrollContainer: vi.fn(),
    select: vi.fn(),
    animateIn: vi.fn(),
    closeContextMenus: vi.fn(),
    rename: edit(),
    cardEdit: edit(),
    blockEdit: edit(),
  };
  const { result } = renderHook(() => useCanvasElementCreation(ports));
  return { create: result.current, ports, created, callbacks };
}

describe("useCanvasElementCreation", () => {
  it("creates a container that is selected and opens for renaming", () => {
    const { create, ports, created } = setup();

    create.container(500, 400);

    expect(created[0]).toMatchObject({ type: "container", data: { name: "Container 2" } });
    const id = (created[0] as { id: string }).id;
    expect(ports.select).toHaveBeenCalledWith([id]);
    expect(ports.animateIn).toHaveBeenCalledWith("containers", id);
    expect(ports.rename.begin).toHaveBeenCalledWith(id, "Container 2");
    expect(ports.closeContextMenus).toHaveBeenCalled();
  });

  it("starts a new card in text editing without selecting it", () => {
    const { create, ports, created } = setup();

    create.mindmapNode(500, 400);

    expect(created[0]).toMatchObject({ type: "mind-map-node", data: { text: "Mindmap" } });
    const id = (created[0] as { id: string }).id;
    expect(ports.select).toHaveBeenCalledWith([]);
    expect(ports.cardEdit.begin).toHaveBeenCalledWith(id, "Mindmap");
    expect(ports.rename.end).toHaveBeenCalled();
  });

  it("leaves the canvas untouched when the creation is refused", () => {
    const { create, ports } = setup({ ok: false });

    create.textBlock(500, 400);

    expect(ports.animateIn).not.toHaveBeenCalled();
    expect(ports.select).not.toHaveBeenCalled();
  });

  it("inserts a container card at the row under the pointer and scrolls it into view", () => {
    const { create, ports, created, callbacks } = setup();

    // Below the last row: the card goes to the end of the box.
    create.containerCard("box", 200, 400);

    expect(callbacks.captureNewContainerCard).toHaveBeenCalledWith("box", 3);
    expect(created[0]).toMatchObject({
      data: { text: "Text card", accent: DEFAULT_ELEMENT_COLORS.textCard },
      checkboxInstallationId: expect.stringMatching(/^extension-instance-/),
    });
    // Four rows need 17 + 4·43 + 3·8 + 17 = 230 px; the box shows 120 − 48 = 72.
    expect(ports.scrollContainer).toHaveBeenCalledWith("box", 158);
    expect(ports.cardEdit.begin).toHaveBeenCalledWith(
      (created[0] as { id: string }).id,
      "Text card",
    );
  });
});
