import { useCallback, useEffect, useRef, useState } from "react";
import { BenchmarkMetricsSampler } from "./benchmarkMetrics";
import type { BenchmarkLiquidCounts, BenchmarkPresentation } from "./benchmarkPresentation";
import {
  canvasBrowserNeedsContinuousFrames,
  canvasBrowserDiagnosticFeatures,
  DEFAULT_CANVAS_BROWSER_DIAGNOSTIC_MODE,
  type CanvasBrowserDiagnosticMode,
} from "./canvasBrowserDiagnostics";
import { BenchmarkControls } from "./BenchmarkControls";
import { BenchmarkLiquidStage } from "./BenchmarkLiquidStage";
import { BenchmarkMetricsOverlay } from "./BenchmarkMetricsOverlay";
import { BenchmarkSceneStore, countBenchmarkScene } from "./benchmarkSceneStore";
import { BenchmarkSpawnMenu } from "./BenchmarkSpawnMenu";
import type { BenchmarkSpawnMenuRequest } from "./useBenchmarkCanvasInput";
import { BenchmarkViewportController } from "./benchmarkViewportController";
import { PrototypeFrameSchedulerMetrics } from "./prototypeFrameSchedulerMetrics";
import "./RendererV2Prototype.css";
import "./BenchmarkOverlays.css";

const EMPTY_LIQUID_COUNTS: BenchmarkLiquidCounts = {
  html: 0,
  containers: 0,
  glassShapes: 0,
  cardGeometrySyncs: 0,
  scrollGroupTransformUpdates: 0,
  dragTransformUpdates: 0,
  visibleCanvasCards: 0,
  totalCanvasCards: 0,
  rendererRenderCallsPerSecond: 0,
  browserRuntimeTicksPerSecond: 0,
  scrollGroupTransformUpdatesPerSecond: 0,
  cardVisibilitySyncsPerSecond: 0,
  cardCaptureTotal: 0,
  browserCaptureTotal: 0,
  coarseCaptureTotal: 0,
  unknownCaptureTotal: 0,
  cardCapturesPerSecond: 0,
  browserCapturesPerSecond: 0,
  coarseCapturesPerSecond: 0,
  unknownCapturesPerSecond: 0,
  invalidationTotal: 0,
  coalescedInvalidationTotal: 0,
  captureCompletionWakeupTotal: 0,
  captureOnlyFrameTotal: 0,
  multiCaptureCompletionFrameTotal: 0,
  filteredTransformPaintTotal: 0,
  invalidationsPerSecond: 0,
  coalescedInvalidationsPerSecond: 0,
  captureCompletionWakeupsPerSecond: 0,
  captureOnlyFramesPerSecond: 0,
  filteredTransformPaintsPerSecond: 0,
  rafRequestTotal: 0,
  coalescedRafRequestTotal: 0,
  rafRequestsPerSecond: 0,
  coalescedRafRequestsPerSecond: 0,
  captureAvailable: false,
};

export function RendererV2Prototype() {
  const [store] = useState(() => new BenchmarkSceneStore());
  const [viewport] = useState(() => new BenchmarkViewportController(store));
  const [version, setVersion] = useState(store.getVersion());
  const [metricsEnabled, setMetricsEnabled] = useState(false);
  const [diagnosticMode, setDiagnosticMode] = useState<CanvasBrowserDiagnosticMode>(
    DEFAULT_CANVAS_BROWSER_DIAGNOSTIC_MODE,
  );
  const [presentationRevision, setPresentationRevision] = useState(0);
  const [spawnMenu, setSpawnMenu] = useState<BenchmarkSpawnMenuRequest | null>(null);
  const presentationRef = useRef<BenchmarkPresentation | null>(null);
  const [sampler] = useState(() => new BenchmarkMetricsSampler());
  const [frameSchedulerMetrics] = useState(() => new PrototypeFrameSchedulerMetrics());
  const [metrics, setMetrics] = useState(() => sampler.snapshot(false));
  const [liquidCounts, setLiquidCounts] = useState<BenchmarkLiquidCounts>(EMPTY_LIQUID_COUNTS);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setVersion(store.getVersion()));
    return () => {
      unsubscribe();
    };
  }, [store]);

  const readLiquidCounts = useCallback(
    (now = performance.now()) => ({
      ...(presentationRef.current?.getLiquidCounts() ?? EMPTY_LIQUID_COUNTS),
      ...frameSchedulerMetrics.snapshot(now),
    }),
    [frameSchedulerMetrics],
  );
  const setPresentation = useCallback(
    (presentation: BenchmarkPresentation | null) => {
      presentationRef.current = presentation;
      setLiquidCounts(readLiquidCounts());
      setPresentationRevision((value) => value + 1);
    },
    [readLiquidCounts],
  );
  const reportCapture = useCallback(
    (width: number | null, height: number | null) => {
      sampler.recordCapture(width, height);
    },
    [sampler],
  );

  useEffect(() => {
    setLiquidCounts(readLiquidCounts());
  }, [metricsEnabled, readLiquidCounts, version]);

  useEffect(
    () => () => {
      viewport.dispose();
    },
    [viewport],
  );

  const animationsActive = Object.values(store.scene.animations).some(Boolean);
  const renderOnDemand = canvasBrowserDiagnosticFeatures(diagnosticMode).renderOnDemand;
  const timedSampleRunning = metrics.timedRunning;
  useEffect(() => {
    let frame = 0;
    let lastUiUpdate = 0;
    let metricsInterval = 0;
    const continuous = canvasBrowserNeedsContinuousFrames(
      diagnosticMode,
      animationsActive,
      timedSampleRunning,
    );
    const updateUi = (now: number) => {
      if (!metricsEnabled) return;
      const counts = readLiquidCounts(now);
      setLiquidCounts(counts);
      setMetrics(sampler.snapshot(counts.captureAvailable, now));
    };
    const schedule = () => {
      if (!frameSchedulerMetrics.recordRequest(frame !== 0)) return false;
      frame = requestAnimationFrame(sample);
      return true;
    };
    const sample = (now: number) => {
      frame = 0;
      const presentation = presentationRef.current;
      presentation?.tick(now);
      if (metricsEnabled) sampler.recordFrame(now);
      if (metricsEnabled && now - lastUiUpdate >= 200) {
        updateUi(now);
        lastUiUpdate = now;
      }
      if (continuous || presentation?.needsFrame()) schedule();
    };
    const presentation = presentationRef.current;
    presentation?.setFrameRequestListener(renderOnDemand ? schedule : null);
    schedule();
    if (renderOnDemand && metricsEnabled) {
      metricsInterval = window.setInterval(() => updateUi(performance.now()), 200);
    }
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      if (metricsInterval !== 0) window.clearInterval(metricsInterval);
      presentation?.setFrameRequestListener(null);
    };
  }, [
    animationsActive,
    diagnosticMode,
    metricsEnabled,
    presentationRevision,
    readLiquidCounts,
    renderOnDemand,
    sampler,
    frameSchedulerMetrics,
    timedSampleRunning,
  ]);

  const counts = countBenchmarkScene(store.scene);
  const resetMetrics = () => {
    if (!metricsEnabled) return;
    sampler.reset();
    frameSchedulerMetrics.reset();
    presentationRef.current?.resetLiquidCounts();
    setMetrics(sampler.snapshot(liquidCounts.captureAvailable));
  };
  const startSample = () => {
    if (!metricsEnabled) return;
    presentationRef.current?.resetLiquidCounts();
    frameSchedulerMetrics.reset();
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
          diagnosticMode={diagnosticMode}
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
          frameSchedulerMetrics.reset();
          presentationRef.current?.resetLiquidCounts();
          setMetrics(sampler.snapshot(false));
        }}
        onResetMetrics={resetMetrics}
        onStartSample={startSample}
        diagnosticMode={diagnosticMode}
        onDiagnosticModeChange={setDiagnosticMode}
      />
      <BenchmarkMetricsOverlay
        scene={store.scene}
        counts={counts}
        liquid={liquidCounts}
        metrics={metrics}
        metricsEnabled={metricsEnabled}
        diagnosticMode={diagnosticMode}
      />
      <BenchmarkSpawnMenu request={spawnMenu} store={store} onClose={() => setSpawnMenu(null)} />
      <div className="renderer-benchmark__interaction-hint">
        Left-drag empty · middle-drag · Ctrl+left-drag · wheel zoom · right-click empty to spawn
      </div>
    </main>
  );
}
