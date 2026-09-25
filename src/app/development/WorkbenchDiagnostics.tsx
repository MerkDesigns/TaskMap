import { useEffect, useState } from "react";
import { readNativeGlassDiagnostics } from "../../ui/materials/SharedSmallGlassPlane";

/** Opt-in diagnostic sampling, never a render or persistence loop for the workspace. */
export function WorkbenchDiagnostics() {
  const [report, setReport] = useState("Collecting visible frame intervals…");
  useEffect(() => {
    let handle = 0;
    let previous: number | undefined;
    let published = performance.now();
    let samples: number[] = [];
    const sample = (now: number) => {
      if (document.hidden) {
        previous = undefined;
        samples = [];
        published = now;
      } else {
        if (previous !== undefined) samples.push(now - previous);
        previous = now;
        if (now - published >= 1000 && samples.length) {
          const sorted = samples.sort((a, b) => a - b);
          const percentile = (p: number) => sorted[Math.ceil(sorted.length * p) - 1].toFixed(1);
          const glass = readNativeGlassDiagnostics();
          setReport(
            `Frame ms: median ${percentile(0.5)} · p95 ${percentile(0.95)} · p99 ${percentile(0.99)}\n` +
              `Glass batches ${glass.activeGlassBatchCount} · depths ${glass.activeDepthCount} · local filters ${glass.localMaterialBackdropFilterCount}\n` +
              `Geometry refreshes/s ${glass.materialGeometryRefreshesPerSecond}`,
          );
          samples = [];
          published = now;
        }
      }
      handle = requestAnimationFrame(sample);
    };
    handle = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(handle);
  }, []);
  return (
    <output className="taskmap-workbench__diagnostics">
      {report}
      <br />
      Development sample; not performance acceptance.
    </output>
  );
}
