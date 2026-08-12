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

  it("keeps the only benchmark direct Liquid import in its runtime adapter", async () => {
    const component = await readFile(
      "src/ui/dev/renderer-benchmark/RendererV2PerformanceBenchmark.tsx",
      "utf8",
    );
    const runtime = await readFile(
      "src/ui/dev/renderer-benchmark/liquidSceneBenchmarkRuntime.ts",
      "utf8",
    );

    expect(component).not.toContain("@liquid-dom/core");
    expect(runtime).toContain('from "@liquid-dom/core"');
  });

  it("keeps Mode A free of a mounted or eagerly loaded Liquid runtime", async () => {
    const root = await readFile(
      "src/ui/dev/renderer-benchmark/RendererV2PerformanceBenchmark.tsx",
      "utf8",
    );
    const domStage = await readFile("src/ui/dev/renderer-benchmark/BenchmarkDomStage.tsx", "utf8");
    const domCanvas = await readFile(
      "src/ui/dev/renderer-benchmark/BenchmarkDomCanvas.tsx",
      "utf8",
    );
    const liquidStage = await readFile(
      "src/ui/dev/renderer-benchmark/BenchmarkLiquidStage.tsx",
      "utf8",
    );

    expect(root).toContain('lazy(() =>\n  import("./BenchmarkLiquidStage")');
    expect(root).toContain('store.scene.architecture === "A"');
    expect(domStage).toContain('<BenchmarkDomCanvas\n      mode="A"');
    expect(domCanvas).toContain("import type { LiquidSceneBenchmarkRuntime }");
    expect(domCanvas).not.toContain('from "@liquid-dom/core"');
    expect(liquidStage).toContain('<BenchmarkDomCanvas\n          mode="B"');
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
});
