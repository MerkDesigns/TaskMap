import { useEffect, useState } from "react";

export type FrameStats = {
  fps: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
  samples: number;
};

const DEFAULT_FRAME_STATS: FrameStats = {
  fps: 0,
  averageMs: 0,
  p95Ms: 0,
  maxMs: 0,
  samples: 0,
};

export function useFrameStats() {
  const [frameStats, setFrameStats] = useState<FrameStats>(DEFAULT_FRAME_STATS);

  useEffect(() => {
    let frameId = 0;
    let lastFrameTime = window.performance.now();
    let lastPublishTime = lastFrameTime;
    const samples: number[] = [];

    const tick = (time: number) => {
      const delta = time - lastFrameTime;
      lastFrameTime = time;

      if (delta > 0 && delta < 1000) {
        samples.push(delta);
        if (samples.length > 180) {
          samples.shift();
        }
      }

      if (time - lastPublishTime >= 500 && samples.length > 0) {
        const sorted = [...samples].sort((left, right) => left - right);
        const total = samples.reduce((sum, sample) => sum + sample, 0);
        const averageMs = total / samples.length;
        const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
        const maxMs = sorted[sorted.length - 1];

        setFrameStats({
          fps: 1000 / averageMs,
          averageMs,
          p95Ms,
          maxMs,
          samples: samples.length,
        });
        lastPublishTime = time;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return frameStats;
}
