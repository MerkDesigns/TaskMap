import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Renderer V2 performance benchmark entry", () => {
  it("is lazy, development-only, and selected without changing AppShell", async () => {
    const source = await readFile("src/main.tsx", "utf8");
    const appShell = await readFile("src/app/AppShell.tsx", "utf8");

    expect(source).toContain("import.meta.env.DEV");
    expect(source).toContain('import.meta.env.VITE_TASKMAP_RENDERER_BENCHMARK === "1"');
    expect(source).toContain(
      'import("./ui/dev/renderer-benchmark/RendererV2PerformanceBenchmark")',
    );
    expect(source).toContain("DevelopmentRendererBenchmark ?");
    expect(appShell).not.toContain("RendererV2PerformanceBenchmark");
  });

  it("keeps benchmark direct Liquid imports in its runtime adapters", async () => {
    const component = await readFile(
      "src/ui/dev/renderer-benchmark/RendererV2PerformanceBenchmark.tsx",
      "utf8",
    );
    const runtime = await readFile(
      "src/ui/dev/renderer-benchmark/liquidSceneBenchmarkRuntime.ts",
      "utf8",
    );
    const browserRuntime = await readFile(
      "src/ui/dev/renderer-benchmark/liquidCanvasBrowserRuntime.ts",
      "utf8",
    );

    expect(component).not.toContain("@liquid-dom/core");
    expect(runtime).toContain('from "@liquid-dom/core"');
    expect(browserRuntime).toContain('from "@liquid-dom/core"');
  });

  it("contains only the selected coarse architecture and no architecture selector", async () => {
    const root = await readFile(
      "src/ui/dev/renderer-benchmark/RendererV2PerformanceBenchmark.tsx",
      "utf8",
    );
    const domCanvas = await readFile(
      "src/ui/dev/renderer-benchmark/BenchmarkDomCanvas.tsx",
      "utf8",
    );
    const liquidStage = await readFile(
      "src/ui/dev/renderer-benchmark/BenchmarkLiquidStage.tsx",
      "utf8",
    );
    const controls = await readFile("src/ui/dev/renderer-benchmark/BenchmarkControls.tsx", "utf8");

    expect(root).toContain("<BenchmarkLiquidStage");
    expect(root).not.toContain("architecture");
    expect(controls).not.toContain("SegmentedControl");
    expect(domCanvas).toContain("import type { LiquidSceneBenchmarkRuntime }");
    expect(domCanvas).not.toContain('from "@liquid-dom/core"');
    expect(liquidStage).toContain("<BenchmarkDomCanvas");
    expect(liquidStage).not.toMatch(/mode=/);
  });

  it("installs capture instrumentation only when metrics are enabled", async () => {
    const runtime = await readFile(
      "src/ui/dev/renderer-benchmark/liquidSceneBenchmarkRuntime.ts",
      "utf8",
    );
    const liquidStage = await readFile(
      "src/ui/dev/renderer-benchmark/BenchmarkLiquidStage.tsx",
      "utf8",
    );

    expect(runtime).toContain("private probe: LiquidCaptureProbe | null = null");
    expect(runtime).toContain("setCaptureInstrumentation(enabled: boolean)");
    expect(liquidStage).toContain("runtime?.setCaptureInstrumentation(metricsEnabled)");
  });

  it("moves physical Canvas Card glass without clone or opacity presentation", async () => {
    const runtime = await readFile(
      "src/ui/dev/renderer-benchmark/liquidCanvasBrowserRuntime.ts",
      "utf8",
    );

    expect(runtime).toContain("this.dragContainer.add(record.glass)");
    expect(runtime).toContain("record.group.add(record.glass)");
    expect(runtime).not.toContain("cloneNode");
    expect(runtime).not.toMatch(/style\.opacity|\.opacity\s*=/);
  });

  it("keeps Canvas Elements on the existing benchmark element renderer", async () => {
    const [domCanvas, liquidStage] = await Promise.all([
      readFile("src/ui/dev/renderer-benchmark/BenchmarkDomCanvas.tsx", "utf8"),
      readFile("src/ui/dev/renderer-benchmark/BenchmarkLiquidStage.tsx", "utf8"),
    ]);
    expect(domCanvas).toContain("<BenchmarkSceneElement");
    expect(liquidStage).toContain("<BenchmarkDomCanvas");
  });
});
