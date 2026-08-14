import { useLayoutEffect, useRef, useState } from "react";
import type { BenchmarkPresentation } from "./benchmarkPresentation";
// DEV/PROTOTYPE ONLY — diagnostic mode wiring.
import type { CanvasBrowserDiagnosticMode } from "./dev/canvasBrowserDiagnostics";
import { BenchmarkCanvasBrowser } from "./BenchmarkCanvasBrowser";
import type { BenchmarkCanvasCardPresentation } from "./benchmarkCanvasBrowserLayout";
import { BenchmarkDomCanvas } from "./BenchmarkDomCanvas";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkViewportController } from "./benchmarkViewportController";
import { LiquidSceneBenchmarkRuntime } from "./liquidSceneBenchmarkRuntime";
import type { BenchmarkSpawnMenuRequest } from "./useBenchmarkCanvasInput";
import type { RendererV2MaterialControls } from "./rendererV2PanelMaterials";
import type { RendererV2PanelGeometry } from "./rendererV2PanelGeometry";

interface Props {
  store: BenchmarkSceneStore;
  viewport: BenchmarkViewportController;
  version: number;
  metricsEnabled: boolean;
  reportCapture: (width: number | null, height: number | null) => void;
  onPresentation: (presentation: BenchmarkPresentation | null) => void;
  onSpawnMenu: (request: BenchmarkSpawnMenuRequest | null) => void;
  diagnosticMode: CanvasBrowserDiagnosticMode;
  materials: RendererV2MaterialControls;
  panelGeometry: RendererV2PanelGeometry;
  cardGap: number;
  cardPresentation: BenchmarkCanvasCardPresentation;
}

export function BenchmarkLiquidStage({
  store,
  viewport,
  version,
  metricsEnabled,
  reportCapture,
  onPresentation,
  onSpawnMenu,
  diagnosticMode,
  materials,
  panelGeometry,
  cardGap,
  cardPresentation,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<LiquidSceneBenchmarkRuntime | null>(null);
  const [, setRuntimeRevision] = useState(0);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const next = new LiquidSceneBenchmarkRuntime(reportCapture);
    host.append(next.canvas);
    host.append(next.canvasBrowserPlaceholderOverlay);
    next.resize(host.clientWidth, host.clientHeight);
    setRuntime(next);
    const observer = new ResizeObserver(() => next.resize(host.clientWidth, host.clientHeight));
    observer.observe(host);
    return () => {
      observer.disconnect();
      setRuntime(null);
      next.destroy();
      next.canvas.remove();
      next.canvasBrowserPlaceholderOverlay.remove();
    };
  }, [reportCapture]);

  useLayoutEffect(() => {
    runtime?.setCaptureInstrumentation(metricsEnabled);
  }, [metricsEnabled, runtime]);

  useLayoutEffect(() => {
    runtime?.setCanvasBrowserDiagnosticMode(diagnosticMode);
  }, [diagnosticMode, runtime]);

  useLayoutEffect(() => {
    runtime?.setCanvasBrowserAppearance(materials, panelGeometry, cardGap);
  }, [cardGap, materials, panelGeometry, runtime]);

  useLayoutEffect(() => {
    if (!runtime) return;
    runtime.reconcile(store.scene);
    setRuntimeRevision((value) => value + 1);
  }, [runtime, store, version]);

  return (
    <div ref={hostRef} className="renderer-benchmark__liquid-stage">
      {runtime ? (
        <>
          <BenchmarkDomCanvas
            store={store}
            viewport={viewport}
            version={version}
            runtime={runtime}
            onPresentation={onPresentation}
            onSpawnMenu={onSpawnMenu}
          />
          <BenchmarkCanvasBrowser
            canvasCardCount={store.scene.canvasCardCount}
            canvasCardOrder={store.scene.canvasCardOrder}
            activeCanvasCardId={store.scene.activeCanvasCardId}
            cardPresentation={cardPresentation}
            runtime={runtime}
            onOrderCommit={(order) => store.commitCanvasCardOrder(order)}
            onSelect={(id) => viewport.selectCanvas(id)}
          />
        </>
      ) : null}
    </div>
  );
}
