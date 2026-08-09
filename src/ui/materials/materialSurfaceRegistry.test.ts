// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  createMaterialSurfaceRegistry,
  type MaterialSurfaceElement,
  type SharedSurfaceResizeObserver,
} from "./materialSurfaceRegistry";

class FakeSurfaceElement implements MaterialSurfaceElement {
  isConnected = true;
  rectangle = { left: 10, top: 20, width: 100, height: 60 };
  getBoundingClientRect() {
    return this.rectangle;
  }
}

describe("central material surface registry", () => {
  it("uses one shared observer for every mounted surface and disconnects once", () => {
    const observer = observerHarness();
    const registry = createMaterialSurfaceRegistry(observer.create);
    const first = new FakeSurfaceElement();
    const second = new FakeSurfaceElement();
    const unregisterFirst = registry.register(registration("first", first));
    registry.register(registration("second", second));
    expect(observer.create).toHaveBeenCalledOnce();
    expect(observer.instance.observe).toHaveBeenCalledTimes(2);
    unregisterFirst();
    expect(observer.instance.unobserve).toHaveBeenCalledWith(first);
    registry.dispose();
    expect(observer.instance.disconnect).toHaveBeenCalledOnce();
  });

  it("does not dirty masks for 120 unchanged measurements", () => {
    const registry = createMaterialSurfaceRegistry(null);
    registry.register(registration("surface", new FakeSurfaceElement()));
    const initial = registry.getSnapshot().planeRevisions;
    for (let sample = 0; sample < 120; sample += 1) registry.refreshMeasurements();
    expect(registry.getSnapshot().planeRevisions).toEqual(initial);
  });

  it("marks only geometry masks for resize and radius changes", () => {
    const observer = observerHarness();
    const registry = createMaterialSurfaceRegistry(observer.create);
    const element = new FakeSurfaceElement();
    registry.register(registration("surface", element));
    const before = registry.getSnapshot().planeRevisions;
    element.rectangle = { ...element.rectangle, width: 140 };
    observer.resize(element);
    const resized = registry.getSnapshot().planeRevisions;
    expect(resized.base).toBe(before.base + 1);
    expect(resized.modal).toBe(before.modal);
    registry.update({ ...registration("surface", element), radiusPx: 20 });
    expect(registry.getSnapshot().planeRevisions.base).toBe(resized.base + 1);
  });

  it("dirties old and new masks when explicit plane membership changes", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const element = new FakeSurfaceElement();
    registry.register(registration("surface", element));
    const before = registry.getSnapshot().planeRevisions;
    registry.update({ ...registration("surface", element), plane: "modal" });
    const after = registry.getSnapshot();
    expect(after.planeRevisions.base).toBe(before.base + 1);
    expect(after.planeRevisions.modal).toBe(before.modal + 1);
    expect(after.surfaces[0].plane).toBe("modal");
  });
});

function registration(id: string, element: FakeSurfaceElement) {
  return {
    id,
    element,
    material: "acrylic-large" as const,
    plane: "base" as const,
    radiusPx: 12,
  };
}

function observerHarness() {
  let onResize: (elements: readonly MaterialSurfaceElement[]) => void = () => undefined;
  const instance: SharedSurfaceResizeObserver = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    instance,
    create: vi.fn((callback: typeof onResize) => {
      onResize = callback;
      return instance;
    }),
    resize: (...elements: readonly MaterialSurfaceElement[]) => onResize(elements),
  };
}
