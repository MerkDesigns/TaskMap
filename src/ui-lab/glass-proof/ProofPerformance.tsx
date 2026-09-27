import { useEffect, useRef, useState } from "react";
import { readMaterialGeometryRefreshesPerSecond } from "../../ui/materials/materialPerformanceDiagnostics";
import { Button } from "../../ui/primitives/Button";

const FILTERS = ".taskmap-native-glass-preblur, .taskmap-native-glass-backdrop";

/** Opt-in rAF diagnostics. Counts DOM filter nodes, not GPU passes or presented FPS. */
export function ProofPerformance() {
  const root = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState("Run the same motion/media settings on each backend.");
  useEffect(() => {
    if (!running) return;
    const scene = root.current?.parentElement?.querySelector("[data-glass-proof-scene]");
    if (!scene) return;
    const filters = [...scene.querySelectorAll<HTMLElement>(FILTERS)].filter(
      (node) => getComputedStyle(node).display !== "none" && node.getClientRects().length > 0,
    );
    const planes = scene.querySelectorAll(
      "[data-stable-glass-depth], [data-glass-batch-state='active']",
    ).length;
    let topologyChanges = 0;
    const observer = new MutationObserver((records) => {
      for (const record of records)
        for (const node of [...record.addedNodes, ...record.removedNodes]) {
          if (node instanceof Element)
            topologyChanges +=
              Number(node.matches(FILTERS)) + node.querySelectorAll(FILTERS).length;
        }
    });
    observer.observe(scene, { childList: true, subtree: true });
    let handle = 0;
    let previous: number | undefined;
    let start: number | undefined;
    let peakGeometry = 0;
    const samples: number[] = [];
    const sample = (now: number) => {
      if (document.hidden) {
        setReport("Sample cancelled: window became hidden. Repeat with the app visible.");
        setRunning(false);
        return;
      }
      start ??= now;
      if (previous !== undefined) samples.push(now - previous);
      previous = now;
      peakGeometry = Math.max(peakGeometry, readMaterialGeometryRefreshesPerSecond());
      if (now - start >= 10_000) {
        samples.sort((a, b) => a - b);
        const percentile = (p: number) => samples[Math.ceil(samples.length * p) - 1].toFixed(2);
        setReport(
          `${samples.length} intervals · ms median ${percentile(0.5)} / p95 ${percentile(0.95)} / p99 ${percentile(0.99)} · filters ${filters.length} · shared planes ${planes} · filter nodes added/removed ${topologyChanges} · peak geometry refreshes/s ${peakGeometry}`,
        );
        setRunning(false);
      } else handle = requestAnimationFrame(sample);
    };
    handle = requestAnimationFrame(sample);
    return () => {
      cancelAnimationFrame(handle);
      observer.disconnect();
    };
  }, [running]);
  return (
    <div ref={root} className="taskmap-glass-proof__performance">
      <Button size="compact" disabled={running} onClick={() => setRunning(true)}>
        {running ? "Sampling 10 seconds…" : "Measure 10 seconds"}
      </Button>
      <output>{report}</output>
      <p>
        Development rAF timing includes diagnostic overhead; it is not GPU or release acceptance.
        Keep geometry controls unchanged during a sample.
      </p>
    </div>
  );
}
