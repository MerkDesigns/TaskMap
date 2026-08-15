// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BenchmarkSceneStore,
  clampCanvasCardCount,
  clampCanvasElementCount,
  deterministicElementPosition,
} from "./benchmarkSceneStore";
import { benchmarkCanvasId } from "./benchmarkCanvasIds";

describe("renderer benchmark scene store", () => {
  it("clamps Canvas Cards to integer values from 1 through 20", () => {
    expect(clampCanvasCardCount(-10)).toBe(1);
    expect(clampCanvasCardCount(4.6)).toBe(5);
    expect(clampCanvasCardCount(80)).toBe(20);
    const store = new BenchmarkSceneStore();
    store.setCanvasCardCount(99);
    expect(store.scene.canvasCardCount).toBe(20);
  });

  it("clamps Canvas Elements to integer values from 1 through 100", () => {
    expect(clampCanvasElementCount(0)).toBe(1);
    expect(clampCanvasElementCount(49.6)).toBe(50);
    expect(clampCanvasElementCount(999)).toBe(100);
    const store = new BenchmarkSceneStore();
    store.setCanvasElementCount(999);
    expect(store.scene.elements).toHaveLength(100);
    store.setCanvasElementCount(-1);
    expect(store.scene.elements).toHaveLength(1);
  });

  it("changes only the amount of existing deterministic canvas element models", () => {
    const store = new BenchmarkSceneStore();
    store.setCanvasElementCount(50);

    expect(store.scene.elements).toHaveLength(50);
    expect(store.scene.elements[0]).toMatchObject({
      kind: "text-card",
      ...deterministicElementPosition(0),
    });
    expect(store.scene.elements[6]).toMatchObject({
      kind: "container",
      ...deterministicElementPosition(6),
    });
  });

  it("commits a valid Canvas Card order once", () => {
    const store = new BenchmarkSceneStore();
    const version = store.getVersion();

    const reordered = [2, 0, 1, 3, 4].map(benchmarkCanvasId);
    expect(store.commitCanvasCardOrder(reordered)).toBe(true);

    expect(store.scene.canvasCardOrder).toEqual(reordered);
    expect(store.getVersion()).toBe(version + 1);
    expect(store.commitCanvasCardOrder([0, 0, 1, 2, 3].map(benchmarkCanvasId))).toBe(false);
  });

  it("tracks exactly one active Canvas Card and falls back when its card is removed", () => {
    const store = new BenchmarkSceneStore();
    expect(store.selectCanvasCard(benchmarkCanvasId(4))).toBe(true);
    expect(store.scene.activeCanvasCardId).toBe(benchmarkCanvasId(4));
    expect(store.selectCanvasCard(benchmarkCanvasId(30))).toBe(false);

    store.setCanvasCardCount(3);
    expect(store.scene.activeCanvasCardId).toBe(benchmarkCanvasId(0));
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

  it("changes actual model z values for elements", () => {
    const store = new BenchmarkSceneStore();
    const element = store.scene.elements[0];
    const elementZ = element.z;

    store.adjustElementZ(element.id, -1);

    expect(store.scene.elements.find(({ id }) => id === element.id)?.z).toBe(elementZ - 1);
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
