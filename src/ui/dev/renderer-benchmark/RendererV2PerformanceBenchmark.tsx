import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { BenchmarkMetricsSampler } from "./benchmarkMetrics";
import type { BenchmarkLiquidCounts, BenchmarkPresentation } from "./benchmarkPresentation";
import { BenchmarkControls } from "./BenchmarkControls";
import { BenchmarkDomStage } from "./BenchmarkDomStage";
import { BenchmarkMetricsOverlay } from "./BenchmarkMetricsOverlay";
import { BenchmarkSceneStore, countBenchmarkScene } from "./benchmarkSceneStore";
import { BenchmarkSpawnMenu } from "./BenchmarkSpawnMenu";
import type { BenchmarkSpawnMenuRequest } from "./useBenchmarkCanvasInput";
import { BenchmarkViewportController } from "./benchmarkViewportController";
import "./RendererV2PerformanceBenchmark.css";
import "./BenchmarkOverlays.css";

const EMPTY_LIQUID_COUNTS: BenchmarkLiquidCounts = {
  html: 0,
  containers: 0,
  captureAvailable: false,
};

const BenchmarkLiquidStage = lazy(() =>
  import("./BenchmarkLiquidStage").then(({ BenchmarkLiquidStage: Stage }) => ({ default: Stage })),
);

export function RendererV2PerformanceBenchmark() {
  const [store] = useState(() => new BenchmarkSceneStore());
  const [viewport] = useState(() => new BenchmarkViewportController(store));
  const [version, setVersion] = useState(store.getVersion());
  const [metricsEnabled, setMetricsEnabled] = useState(false);
  const [spawnMenu, setSpawnMenu] = useState<BenchmarkSpawnMenuRequest | null>(null);
  const presentationRef = useRef<BenchmarkPresentation | null>(null);
  const [sampler] = useState(() => new BenchmarkMetricsSampler());
  const [metrics, setMetrics] = useState(() => sampler.snapshot(false));
  const [liquidCounts, setLiquidCounts] = useState<BenchmarkLiquidCounts>(EMPTY_LIQUID_COUNTS);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setVersion(store.getVersion()));
    return () => {
      unsubscribe();
    };
  }, [store]);

  const setPresentation = useCallback((presentation: BenchmarkPresentation | null) => {
    presentationRef.current = presentation;
    setLiquidCounts(presentation?.getLiquidCounts() ?? EMPTY_LIQUID_COUNTS);
  }, []);
  const reportCapture = useCallback(
    (width: number | null, height: number | null) => {
      sampler.recordCapture(width, height);
    },
    [sampler],
  );

  useEffect(() => {
    setLiquidCounts(presentationRef.current?.getLiquidCounts() ?? EMPTY_LIQUID_COUNTS);
  }, [metricsEnabled, version]);

  useEffect(
    () => () => {
      viewport.dispose();
    },
    [viewport],
  );

  const architecture = store.scene.architecture;
  const moveCards = store.scene.animations.moveCards;
  useEffect(() => {
    const requiresPresentationLoop = architecture !== "A" || moveCards;
    if (!metricsEnabled && !requiresPresentationLoop) return;
    let frame = 0;
    let lastUiUpdate = 0;
    const sample = (now: number) => {
      const presentation = presentationRef.current;
      presentation?.tick(now);
      if (metricsEnabled) sampler.recordFrame(now);
      if (metricsEnabled && now - lastUiUpdate >= 200) {
        const counts = presentation?.getLiquidCounts() ?? EMPTY_LIQUID_COUNTS;
        setLiquidCounts(counts);
        setMetrics(sampler.snapshot(counts.captureAvailable, now));
        lastUiUpdate = now;
      }
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [architecture, metricsEnabled, moveCards, sampler]);

  const counts = countBenchmarkScene(store.scene);
  const resetMetrics = () => {
    if (!metricsEnabled) return;
    sampler.reset();
    setMetrics(sampler.snapshot(liquidCounts.captureAvailable));
  };
  const startSample = () => {
    if (!metricsEnabled) return;
    sampler.startTimedSample(
      store.scene.architecture,
      countBenchmarkScene(store.scene),
      liquidCounts.captureAvailable,
    );
    setMetrics(sampler.snapshot(liquidCounts.captureAvailable));
  };

  return (
    <main className="taskmap-target-theme renderer-benchmark">
      <div className="renderer-benchmark__stage">
        {store.scene.architecture === "A" ? (
          <BenchmarkDomStage
            store={store}
            viewport={viewport}
            version={version}
            onPresentation={setPresentation}
            onSpawnMenu={setSpawnMenu}
          />
        ) : (
          <Suspense fallback={null}>
            <BenchmarkLiquidStage
              mode={store.scene.architecture}
              store={store}
              viewport={viewport}
              version={version}
              metricsEnabled={metricsEnabled}
              reportCapture={reportCapture}
              onPresentation={setPresentation}
              onSpawnMenu={setSpawnMenu}
            />
          </Suspense>
        )}
      </div>
      <BenchmarkControls
        store={store}
        viewport={viewport}
        metricsEnabled={metricsEnabled}
        onMetricsEnabledChange={(enabled) => {
          setMetricsEnabled(enabled);
          sampler.reset();
          setMetrics(sampler.snapshot(false));
        }}
        onResetMetrics={resetMetrics}
        onStartSample={startSample}
      />
      <BenchmarkMetricsOverlay
        scene={store.scene}
        counts={counts}
        liquid={liquidCounts}
        metrics={metrics}
        metricsEnabled={metricsEnabled}
      />
      <BenchmarkSpawnMenu request={spawnMenu} store={store} onClose={() => setSpawnMenu(null)} />
      <div className="renderer-benchmark__interaction-hint">
        Left-drag empty · middle-drag · Ctrl+left-drag · wheel zoom · right-click empty to spawn
      </div>
    </main>
  );
}
