// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BENCHMARK_LIQUID_MAX_DPR,
  BENCHMARK_WORLD_HEIGHT,
  BENCHMARK_WORLD_WIDTH,
} from "./benchmarkWorld";
import { BenchmarkSceneStore } from "./benchmarkSceneStore";

const GUARANTEED_WEBGPU_MAX_TEXTURE_DIMENSION_2D = 8192;

describe("renderer benchmark world", () => {
  it("keeps Mode C's DPR-scaled Html backdrop inside WebGPU's guaranteed texture limit", () => {
    expect(BENCHMARK_WORLD_WIDTH * BENCHMARK_LIQUID_MAX_DPR).toBeLessThanOrEqual(
      GUARANTEED_WEBGPU_MAX_TEXTURE_DIMENSION_2D,
    );
    expect(BENCHMARK_WORLD_HEIGHT * BENCHMARK_LIQUID_MAX_DPR).toBeLessThanOrEqual(
      GUARANTEED_WEBGPU_MAX_TEXTURE_DIMENSION_2D,
    );
  });

  it("contains the deterministic 100-card and 10-container stress layout", () => {
    const store = new BenchmarkSceneStore();
    store.clearCanvas();
    store.addBulk("text-card", 100);
    store.addBulk("container", 10);

    expect(
      Math.max(...store.scene.elements.map((element) => element.x + element.width)),
    ).toBeLessThan(BENCHMARK_WORLD_WIDTH);
    expect(
      Math.max(...store.scene.elements.map((element) => element.y + element.height)),
    ).toBeLessThan(BENCHMARK_WORLD_HEIGHT);
  });
});
