import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { ContainerElement, ImageElement } from "../types";
import { createContainerCardLayout, groupContainerCards } from "./containerCardLayout";
import { installRetainedViewExtension } from "./retainedViewExtensions";
import { useExtensionDrop, type ExtensionDropPorts } from "./useExtensionDrop";

vi.mock("./retainedViewExtensions", () => ({ installRetainedViewExtension: vi.fn(() => true) }));
const install = vi.mocked(installRetainedViewExtension);

const image: ImageElement = { id: "image", x: 0, y: 0, width: 100, height: 100, accent: "#fff" };
const box: ContainerElement = {
  id: "box",
  name: "Box",
  x: 500,
  y: 0,
  width: 200,
  height: 200,
  accent: "#fff",
};

function setup(selection: string[] = []) {
  const ports: ExtensionDropPorts = {
    callbacks: {} as RetainedActionCallbacks,
    document: () => null,
    canvasPoint: (x, y) => ({ x, y }),
    scene: () => ({ containers: [box], textBlocks: [], looseCards: [], images: [image] }),
    find: {
      container: (id) => (id === box.id ? box : undefined),
      textBlock: () => undefined,
      image: (id) => (id === image.id ? image : undefined),
      card: () => undefined,
    },
    cardLayout: () => createContainerCardLayout([], groupContainerCards([]), {}),
    cardBounds: () => null,
    looseCardEstimate: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    selection: () => selection,
    select: vi.fn(),
    closeContextMenus: vi.fn(),
  };
  const { result } = renderHook(() => useExtensionDrop(ports));
  return { result, ports };
}

beforeEach(() => install.mockClear().mockReturnValue(true));

describe("useExtensionDrop", () => {
  it("installs on the element under the pointer, selects it and ripples from the pointer", () => {
    const { result, ports } = setup();

    act(() => result.current.drop("lock", 30, 40));

    expect(install.mock.calls[0]?.slice(2, 4)).toEqual(["lock", ["image"]]);
    expect(ports.select).toHaveBeenCalledWith(["image"]);
    expect(result.current.ripples).toEqual([
      expect.objectContaining({ bounds: expect.objectContaining({ left: 0 }), offsetX: 30 }),
    ]);
  });

  it("installs on the whole selection the target is in, rippling each element", () => {
    const { result, ports } = setup(["image", "box"]);

    act(() => result.current.drop("lock", 30, 40));

    expect(install.mock.calls[0]?.[3]).toEqual(["image", "box"]);
    expect(ports.select).not.toHaveBeenCalled();
    // The other element ripples from its centre.
    expect(result.current.ripples.map(({ offsetX }) => offsetX)).toEqual([30, 100]);
  });

  it("does nothing on empty canvas or when the install is refused", () => {
    const { result, ports } = setup();

    act(() => result.current.drop("lock", 300, 300));
    install.mockReturnValue(false);
    act(() => result.current.drop("lock", 30, 40));

    expect(install).toHaveBeenCalledTimes(1);
    expect(ports.select).not.toHaveBeenCalled();
    expect(result.current.ripples).toEqual([]);
  });
});
