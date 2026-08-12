// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BenchmarkSceneStore,
  clampBenchmarkGlassSize,
  deterministicElementPosition,
} from "./benchmarkSceneStore";

describe("renderer benchmark scene store", () => {
  it("preserves one scene and camera while switching architectures", () => {
    const store = new BenchmarkSceneStore();
    const elements = store.scene.elements;
    const glasses = store.scene.glasses;
    store.scene.camera = { ...store.scene.camera, pan: { x: 321, y: -78 }, zoom: 1.4 };

    store.setArchitecture("B");
    store.setArchitecture("C");

    expect(store.scene.elements).toBe(elements);
    expect(store.scene.glasses).toBe(glasses);
    expect(store.scene.camera).toMatchObject({ pan: { x: 321, y: -78 }, zoom: 1.4 });
  });

  it("uses deterministic bulk positions and resets that sequence when clearing", () => {
    const first = new BenchmarkSceneStore();
    const second = new BenchmarkSceneStore();
    first.addBulk("text-card", 50);
    second.addBulk("text-card", 50);

    expect(first.scene.elements.map(({ x, y }) => ({ x, y }))).toEqual(
      second.scene.elements.map(({ x, y }) => ({ x, y })),
    );
    first.clearCanvas();
    const item = first.addElement("text-card");
    expect({ x: item.x, y: item.y }).toEqual(deterministicElementPosition(0));
  });

  it("changes actual model z values for elements and glass", () => {
    const store = new BenchmarkSceneStore();
    const element = store.scene.elements[0];
    const glass = store.addGlass();
    const elementZ = element.z;
    const glassZ = glass.z;

    store.adjustElementZ(element.id, -1);
    store.adjustGlassZ(glass.id, 1);

    expect(store.scene.elements.find(({ id }) => id === element.id)?.z).toBe(elementZ - 1);
    expect(store.scene.glasses.find(({ id }) => id === glass.id)?.z).toBe(glassZ + 1);
  });

  it("keeps continuous glass resize state and enforces minimum geometry", () => {
    expect(clampBenchmarkGlassSize(420, 260)).toEqual({ width: 420, height: 260 });
    expect(clampBenchmarkGlassSize(20, 30)).toEqual({ width: 190, height: 120 });
  });

  it("publishes committed geometry once without mutating the previous element", () => {
    const store = new BenchmarkSceneStore();
    const previous = store.scene.elements[0];
    const version = store.getVersion();

    store.commitElementGeometry(previous.id, {
      x: 912,
      y: 604,
      width: previous.width,
      height: previous.height,
    });

    expect(previous).toMatchObject({ x: 120, y: 120 });
    expect(store.scene.elements[0]).not.toBe(previous);
    expect(store.scene.elements[0]).toMatchObject({ x: 912, y: 604 });
    expect(store.getVersion()).toBe(version + 1);
  });
});
