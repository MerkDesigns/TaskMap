import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskMapMantineProvider } from "../../mantine/TaskMapMantineProvider";
import { BenchmarkSceneStore } from "../benchmarkSceneStore";
import { BenchmarkViewportController } from "../benchmarkViewportController";
import { BenchmarkControls } from "./BenchmarkControls";
import { DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION } from "../benchmarkCanvasBrowserLayout";
import {
  createRendererV2MaterialControls,
  DEFAULT_RENDERER_V2_ACCENT,
} from "../rendererV2PanelMaterials";
import { createRendererV2PanelGeometry } from "../rendererV2PanelGeometry";

afterEach(cleanup);

describe("BenchmarkControls workload sliders", () => {
  it("exposes integer Canvas Card and Canvas Element ranges", () => {
    const store = new BenchmarkSceneStore();
    const viewport = new BenchmarkViewportController(store);
    render(
      <TaskMapMantineProvider>
        <BenchmarkControls
          store={store}
          viewport={viewport}
          metricsEnabled={false}
          onMetricsEnabledChange={vi.fn()}
          onResetMetrics={vi.fn()}
          onStartSample={vi.fn()}
          diagnosticMode="full"
          onDiagnosticModeChange={vi.fn()}
          materials={createRendererV2MaterialControls()}
          panelGeometry={createRendererV2PanelGeometry()}
          cardGap={10}
          accent={DEFAULT_RENDERER_V2_ACCENT}
          cardPresentation={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION}
          onMaterialsChange={vi.fn()}
          onPanelGeometryChange={vi.fn()}
          onCardGapChange={vi.fn()}
          onAccentChange={vi.fn()}
          onCardPresentationChange={vi.fn()}
        />
      </TaskMapMantineProvider>,
    );

    const cards = screen.getByRole("slider", { name: "Canvas Cards" });
    expect(cards).toHaveAttribute("aria-valuemin", "1");
    expect(cards).toHaveAttribute("aria-valuemax", "20");
    expect(cards).toHaveAttribute("aria-valuenow", "5");

    const elements = screen.getByRole("slider", { name: "Canvas Elements" });
    expect(elements).toHaveAttribute("aria-valuemin", "1");
    expect(elements).toHaveAttribute("aria-valuemax", "100");
    expect(elements).toHaveAttribute("aria-valuenow", "8");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
