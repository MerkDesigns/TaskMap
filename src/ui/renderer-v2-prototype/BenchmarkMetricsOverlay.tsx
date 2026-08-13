import { Paper, Text } from "@mantine/core";
import type { BenchmarkMetricsSampler } from "./benchmarkMetrics";
import type { BenchmarkLiquidCounts } from "./benchmarkPresentation";
import type { BenchmarkSceneCounts, BenchmarkSceneModel } from "./benchmarkTypes";

type MetricsSnapshot = ReturnType<BenchmarkMetricsSampler["snapshot"]>;

interface Props {
  scene: BenchmarkSceneModel;
  counts: BenchmarkSceneCounts;
  liquid: BenchmarkLiquidCounts;
  metrics: MetricsSnapshot;
  metricsEnabled: boolean;
}

const number = (value: number) => value.toFixed(1);
const integer = (value: number | null) =>
  value === null ? "n/a" : Math.round(value).toLocaleString();

export function BenchmarkMetricsOverlay({ scene, counts, liquid, metrics, metricsEnabled }: Props) {
  const result = metrics.timedResult;
  return (
    <Paper className="renderer-benchmark__metrics" p="sm" radius="md" shadow="md">
      <div className="renderer-benchmark__metric-grid">
        <strong>Metrics</strong>
        <span>{metricsEnabled ? "On" : "Off"}</span>
        {metricsEnabled ? (
          <>
            <strong>FPS current / avg</strong>
            <span>
              {number(metrics.frames.fps)} / {number(metrics.frames.averageFps)}
            </span>
            <strong>Frame current / avg</strong>
            <span>
              {number(metrics.frames.frameTime)} / {number(metrics.frames.averageFrameTime)} ms
            </span>
            <strong>p95 / worst</strong>
            <span>
              {number(metrics.frames.p95FrameTime)} / {number(metrics.frames.worstFrameTime)} ms
            </span>
            <strong>Samples</strong>
            <span>{metrics.frames.samples}</span>
          </>
        ) : null}
        <strong>Scene</strong>
        <span>
          {counts.elements} Canvas Elements · {scene.canvasCardCount} Canvas Cards
        </span>
        <strong>Zoom / DPR</strong>
        <span>
          {Math.round(scene.camera.zoom * 100)}% / {window.devicePixelRatio.toFixed(2)}
        </span>
        <strong>Liquid Html</strong>
        <span>{liquid.html}</span>
        <strong>Liquid Containers</strong>
        <span>{liquid.containers}</span>
        <strong>Liquid Glass shapes</strong>
        <span>{liquid.glassShapes}</span>
        <strong>Card geometry syncs</strong>
        <span>{liquid.cardGeometrySyncs}</span>
        <strong>Scroll Group updates</strong>
        <span>{liquid.scrollGroupTransformUpdates}</span>
        <strong>Drag transform updates</strong>
        <span>{liquid.dragTransformUpdates}</span>
        {metricsEnabled ? (
          <>
            <strong>Capture calls</strong>
            <span>
              {integer(metrics.captureCalls)} total · {integer(metrics.recentCaptureCalls)} interval
            </span>
            <strong>Capture rate</strong>
            <span>
              {metrics.captureCallsPerSecond === null
                ? "n/a"
                : `${number(metrics.captureCallsPerSecond)}/s`}
            </span>
            <strong>Copied texels</strong>
            <span>{integer(metrics.copiedTexels)}</span>
          </>
        ) : null}
      </div>
      {metricsEnabled && metrics.timedRunning ? (
        <Text size="xs" c="orange" mt={6}>
          10-second sample running…
        </Text>
      ) : null}
      {metricsEnabled && result ? (
        <Text size="xs" mt={6} className="renderer-benchmark__sample-result">
          10s sample: {number(result.averageFps)} FPS · {number(result.averageFrameTime)} ms avg ·{" "}
          {number(result.p95FrameTime)} ms p95 · {number(result.worstFrameTime)} ms worst ·{" "}
          {result.samples} frames · {integer(result.captureCalls)} captures ·{" "}
          {integer(result.copiedTexels)} texels · {result.counts.elements} Canvas Elements/
          {result.counts.canvasCards} Canvas Cards
        </Text>
      ) : null}
    </Paper>
  );
}
