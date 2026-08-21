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

  it("defaults mask opacity to one and clamps opacity-only plane updates", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const element = new FakeSurfaceElement();
    registry.register(registration("surface", element));
    const initial = registry.getSnapshot();

    expect(initial.surfaces[0].maskOpacity).toBe(1);
    registry.updateMaskOpacity(element, -0.5);
    const transparent = registry.getSnapshot();
    expect(transparent.surfaces[0].maskOpacity).toBe(0);
    expect(transparent.planeRevisions.base).toBe(initial.planeRevisions.base + 1);
    expect(transparent.planeRevisions.modal).toBe(initial.planeRevisions.modal);

    registry.updateMaskOpacity(element, 1.5);
    expect(registry.getSnapshot().surfaces[0].maskOpacity).toBe(1);
    registry.updateMaskOpacity(element, Number.NaN);
    expect(registry.getSnapshot().surfaces[0].maskOpacity).toBe(1);
  });

  it("batches group mask opacity into one cheap revision per affected plane", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const first = new FakeSurfaceElement();
    const second = new FakeSurfaceElement();
    const unrelated = new FakeSurfaceElement();
    registry.register(registration("first", first));
    registry.register(registration("second", second));
    registry.register({ ...registration("unrelated", unrelated), plane: "modal" });
    const before = registry.getSnapshot();

    registry.updateMaskOpacityBatch([first, second], 0.4);
    const after = registry.getSnapshot();
    expect(after.planeRevisions.base).toBe(before.planeRevisions.base + 1);
    expect(after.planeRevisions.modal).toBe(before.planeRevisions.modal);
    expect(after.surfaces.map(({ maskOpacity }) => maskOpacity)).toEqual([0.4, 0.4, 1]);
  });

  it("batches distinct effective group opacities without touching unrelated surfaces", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const root = new FakeSurfaceElement();
    const nested = new FakeSurfaceElement();
    const unrelated = new FakeSurfaceElement();
    registry.register({ ...registration("root", root), plane: "modal" });
    registry.register({ ...registration("nested", nested), plane: "modal" });
    registry.register(registration("unrelated", unrelated));
    const before = registry.getSnapshot();

    registry.updateMaskOpacitiesBatch([
      { element: root, maskOpacity: 0.5 },
      { element: nested, maskOpacity: 0.2 },
    ]);
    const after = registry.getSnapshot();
    expect(after.planeRevisions.modal).toBe(before.planeRevisions.modal + 1);
    expect(after.planeRevisions.base).toBe(before.planeRevisions.base);
    expect(after.surfaces.map(({ maskOpacity }) => maskOpacity)).toEqual([0.5, 0.2, 1]);
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
