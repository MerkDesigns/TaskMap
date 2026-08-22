const refreshTimestamps: number[] = [];

export function recordMaterialGeometryRefresh(now = performanceNow()): void {
  refreshTimestamps.push(now);
  discardOldRefreshes(now);
}

export function readMaterialGeometryRefreshesPerSecond(now = performanceNow()): number {
  discardOldRefreshes(now);
  return refreshTimestamps.length;
}

function discardOldRefreshes(now: number): void {
  const cutoff = now - 1_000;
  let expired = 0;
  while (expired < refreshTimestamps.length && refreshTimestamps[expired] < cutoff) expired += 1;
  if (expired > 0) refreshTimestamps.splice(0, expired);
}

function performanceNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
