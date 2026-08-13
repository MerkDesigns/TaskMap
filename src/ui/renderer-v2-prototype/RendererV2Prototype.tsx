import { useCallback, useEffect, useRef, useState } from "react";
import { BenchmarkMetricsSampler } from "./benchmarkMetrics";
import type { BenchmarkLiquidCounts, BenchmarkPresentation } from "./benchmarkPresentation";
import { BenchmarkControls } from "./BenchmarkControls";
import { BenchmarkLiquidStage } from "./BenchmarkLiquidStage";
import { BenchmarkMetricsOverlay } from "./BenchmarkMetricsOverlay";
import { BenchmarkSceneStore, countBenchmarkScene } from "./benchmarkSceneStore";
import { BenchmarkSpawnMenu } from "./BenchmarkSpawnMenu";
import type { BenchmarkSpawnMenuRequest } from "./useBenchmarkCanvasInput";
import { BenchmarkViewportController } from "./benchmarkViewportController";
import "./RendererV2Prototype.css";
import "./BenchmarkOverlays.css";

const EMPTY_LIQUID_COUNTS: BenchmarkLiquidCounts = {
  html: 0,
  containers: 0,
  glassShapes: 0,
  cardGeometrySyncs: 0,
  scrollGroupTransformUpdates: 0,
  dragTransformUpdates: 0,
  captureAvailable: false,
};

export function RendererV2Prototype() {
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

  const moveCards = store.scene.animations.moveCards;
  useEffect(() => {
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
  }, [metricsEnabled, moveCards, sampler]);

  const counts = countBenchmarkScene(store.scene);
  const resetMetrics = () => {
    if (!metricsEnabled) return;
    sampler.reset();
    presentationRef.current?.resetLiquidCounts();
    setMetrics(sampler.snapshot(liquidCounts.captureAvailable));
  };
  const startSample = () => {
    if (!metricsEnabled) return;
    presentationRef.current?.resetLiquidCounts();
    sampler.startTimedSample(countBenchmarkScene(store.scene), liquidCounts.captureAvailable);
    setMetrics(sampler.snapshot(liquidCounts.captureAvailable));
  };

  return (
    <main className="taskmap-target-theme renderer-benchmark">
      <div className="renderer-benchmark__stage">
        <BenchmarkLiquidStage
          store={store}
          viewport={viewport}
          version={version}
          metricsEnabled={metricsEnabled}
          reportCapture={reportCapture}
          onPresentation={setPresentation}
          onSpawnMenu={setSpawnMenu}
        />
      </div>
      <BenchmarkControls
        store={store}
        viewport={viewport}
        metricsEnabled={metricsEnabled}
        onMetricsEnabledChange={(enabled) => {
          setMetricsEnabled(enabled);
          sampler.reset();
          presentationRef.current?.resetLiquidCounts();
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
