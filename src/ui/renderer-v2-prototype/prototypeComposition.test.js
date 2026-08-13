import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("canonical Renderer V2 prototype composition", () => {
  it("is the normal application entry with no alternate renderer gates", async () => {
    const source = await readFile("src/main.tsx", "utf8");
    const appShell = await readFile("src/app/AppShell.tsx", "utf8");

    expect(source).toContain("<AppShell />");
    expect(source).not.toContain("import(");
    expect(appShell).toContain(
      'import { RendererV2Prototype } from "../ui/renderer-v2-prototype/RendererV2Prototype"',
    );
    expect(appShell).toContain("<RendererV2Prototype />");
    expect(appShell).not.toContain("import(");
  });

  it("keeps direct Liquid imports in the canonical prototype runtime adapters", async () => {
    const component = await readFile(
      "src/ui/renderer-v2-prototype/RendererV2Prototype.tsx",
      "utf8",
    );
    const runtime = await readFile(
      "src/ui/renderer-v2-prototype/liquidSceneBenchmarkRuntime.ts",
      "utf8",
    );
    const browserRuntime = await readFile(
      "src/ui/renderer-v2-prototype/liquidCanvasBrowserRuntime.ts",
      "utf8",
    );

    expect(component).not.toContain("@liquid-dom/core");
    expect(runtime).toContain('from "@liquid-dom/core"');
    expect(browserRuntime).toContain('from "@liquid-dom/core"');
  });

  it("contains only the selected coarse architecture and no architecture selector", async () => {
    const root = await readFile("src/ui/renderer-v2-prototype/RendererV2Prototype.tsx", "utf8");
    const domCanvas = await readFile("src/ui/renderer-v2-prototype/BenchmarkDomCanvas.tsx", "utf8");
    const liquidStage = await readFile(
      "src/ui/renderer-v2-prototype/BenchmarkLiquidStage.tsx",
      "utf8",
    );
    const controls = await readFile("src/ui/renderer-v2-prototype/BenchmarkControls.tsx", "utf8");

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
      "src/ui/renderer-v2-prototype/liquidSceneBenchmarkRuntime.ts",
      "utf8",
    );
    const liquidStage = await readFile(
      "src/ui/renderer-v2-prototype/BenchmarkLiquidStage.tsx",
      "utf8",
    );

    expect(runtime).toContain("private probe: LiquidCaptureProbe | null = null");
    expect(runtime).toContain("setCaptureInstrumentation(enabled: boolean)");
    expect(liquidStage).toContain("runtime?.setCaptureInstrumentation(metricsEnabled)");
  });

  it("moves physical Canvas Card glass without clone or opacity presentation", async () => {
    const runtime = await readFile(
      "src/ui/renderer-v2-prototype/liquidCanvasBrowserRuntime.ts",
      "utf8",
    );

    expect(runtime).toContain("BENCHMARK_CARD_DRAG_THRESHOLD");
    expect(runtime).toContain("this.dragContainer.add(record.glass)");
    expect(runtime).toContain("record.glass.y = top");
    expect(runtime).toContain("reorderThroughCrossedCanvasCardSlots");
    expect(runtime).toContain("calculateCanvasCardAutoScroll");
    expect(runtime).toContain("this.positionCards(nextOrder, now, true)");
    expect(runtime).toContain("drag.snapStartedAt = now");
    expect(runtime).toContain("this.suppressedClickId = drag.id");
    expect(runtime).toContain("this.dragContainer.add(record.glass)");
    expect(runtime).toContain("record.group.add(record.glass)");
    expect(runtime).not.toContain("cloneNode");
    expect(runtime).not.toMatch(/style\.opacity|\.opacity\s*=/);
  });

  it("keeps Canvas Elements on the existing benchmark element renderer", async () => {
    const [domCanvas, liquidStage] = await Promise.all([
      readFile("src/ui/renderer-v2-prototype/BenchmarkDomCanvas.tsx", "utf8"),
      readFile("src/ui/renderer-v2-prototype/BenchmarkLiquidStage.tsx", "utf8"),
    ]);
    expect(domCanvas).toContain("<BenchmarkSceneElement");
    expect(liquidStage).toContain("<BenchmarkDomCanvas");
  });
});
