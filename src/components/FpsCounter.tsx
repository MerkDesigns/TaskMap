import { useFrameStats } from "../hooks/useFrameStats";
import { readNativeGlassDiagnostics } from "../ui/materials/SharedSmallGlassPlane";

export function FpsCounter() {
  const frameStats = useFrameStats();
  const glass = readNativeGlassDiagnostics();

  return (
    <div
      data-fps-counter
      className="pointer-events-none fixed right-4 top-4 z-50 rounded-lg border border-white/[0.14] bg-[#111216] px-4 py-3 font-mono text-[22px] leading-8 text-white/78 shadow-[0_12px_32px_rgba(0,0,0,0.34)]"
    >
      <div className="text-white/92">
        {frameStats.samples ? `${Math.round(frameStats.fps)} fps` : "-- fps"}
      </div>
      <div>avg {frameStats.averageMs.toFixed(2)} ms</div>
      <div>p95 {frameStats.p95Ms.toFixed(2)} ms</div>
      <div>max {frameStats.maxMs.toFixed(2)} ms</div>
      <div className="text-[12px] leading-5">
        depth {glass.activeDepthCount} · batches {glass.activeGlassBatchCount} · filters{" "}
        {glass.nativeBackdropFilterLayerCount}
      </div>
      <div className="text-[12px] leading-5">
        Small {glass.sharedSmallBatchCount} · drag {glass.temporaryDragBatchActive ? "on" : "off"}
        {" · local "}
        {glass.localMaterialBackdropFilterCount}
      </div>
      <div className="text-[12px] leading-5">
        geometry {glass.materialGeometryRefreshesPerSecond}/s
      </div>
    </div>
  );
}
