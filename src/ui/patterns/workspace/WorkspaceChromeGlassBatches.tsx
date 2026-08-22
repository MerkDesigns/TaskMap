import { useLayoutEffect, useRef } from "react";
import {
  NativeGlassBatch,
  writeNativeGlassBatchShapes,
  type NativeGlassBatchShape,
} from "../../materials/NativeGlassBatch";
import { recordMaterialGeometryRefresh } from "../../materials/materialPerformanceDiagnostics";

export const LEFT_CHROME_GLASS_BATCH = "depth-1-left";
export const RIGHT_CHROME_GLASS_BATCH = "depth-1-right";
const BATCH_INVALIDATION_EVENT = "taskmap:glass-batch-invalidate";

export function WorkspaceChromeGlassBatches() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  useChromeBatchGeometry(leftRef, LEFT_CHROME_GLASS_BATCH);
  useChromeBatchGeometry(rightRef, RIGHT_CHROME_GLASS_BATCH);

  return (
    <div className="taskmap-workspace-chrome-glass-batches" aria-hidden="true">
      <NativeGlassBatch
        ref={leftRef}
        material="acrylic-large"
        depth={1}
        kind="large-left"
        batchId={LEFT_CHROME_GLASS_BATCH}
      />
      <NativeGlassBatch
        ref={rightRef}
        material="acrylic-large"
        depth={1}
        kind="large-right"
        batchId={RIGHT_CHROME_GLASS_BATCH}
      />
    </div>
  );
}

export function invalidateChromeGlassBatch(batchId: string): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(BATCH_INVALIDATION_EVENT, { detail: batchId }));
}

function useChromeBatchGeometry(
  batchRef: React.RefObject<HTMLDivElement | null>,
  batchId: string,
): void {
  useLayoutEffect(() => {
    const batch = batchRef.current;
    if (!batch) return;
    let disposed = false;
    let frame: number | null = null;
    let observedTargets: HTMLElement[] = [];
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => schedule());

    const observeTargets = () => {
      if (disposed || typeof document === "undefined") return;
      const nextTargets = [
        ...document.querySelectorAll<HTMLElement>(`[data-glass-batch-target="${batchId}"]`),
      ];
      if (
        nextTargets.length === observedTargets.length &&
        nextTargets.every((target, index) => target === observedTargets[index])
      ) {
        return;
      }
      resizeObserver?.disconnect();
      observedTargets = nextTargets;
      observedTargets.forEach((target) => resizeObserver?.observe(target));
    };
    const sync = () => {
      frame = null;
      if (disposed) return;
      observeTargets();
      recordMaterialGeometryRefresh();
      writeChromeBatchGeometry(batch, observedTargets);
    };
    const schedule = () => {
      if (
        disposed ||
        frame !== null ||
        typeof window === "undefined" ||
        typeof window.requestAnimationFrame !== "function"
      ) {
        return;
      }
      frame = window.requestAnimationFrame(sync);
    };
    const handleInvalidation = (event: Event) => {
      if ((event as CustomEvent<string>).detail === batchId) schedule();
    };
    observeTargets();
    sync();
    document.addEventListener(BATCH_INVALIDATION_EVENT, handleInvalidation);
    window.addEventListener("resize", schedule);
    return () => {
      disposed = true;
      if (frame !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver?.disconnect();
      document.removeEventListener(BATCH_INVALIDATION_EVENT, handleInvalidation);
      window.removeEventListener("resize", schedule);
    };
  }, [batchId, batchRef]);
}

function writeChromeBatchGeometry(batch: HTMLElement, targets: readonly HTMLElement[]): void {
  const entries = targets
    .map((target) => ({ target, rectangle: target.getBoundingClientRect() }))
    .filter(
      ({ rectangle }) =>
        rectangle.width > 0 &&
        rectangle.height > 0 &&
        rectangle.right > 0 &&
        rectangle.bottom > 0 &&
        rectangle.left < window.innerWidth &&
        rectangle.top < window.innerHeight,
    );
  if (entries.length === 0) {
    writeNativeGlassBatchShapes(batch, []);
    return;
  }
  const left = Math.min(...entries.map(({ rectangle }) => rectangle.left));
  const top = Math.min(...entries.map(({ rectangle }) => rectangle.top));
  const right = Math.max(...entries.map(({ rectangle }) => rectangle.right));
  const bottom = Math.max(...entries.map(({ rectangle }) => rectangle.bottom));
  batch.style.left = `${left}px`;
  batch.style.top = `${top}px`;
  batch.style.width = `${right - left}px`;
  batch.style.height = `${bottom - top}px`;
  writeNativeGlassBatchShapes(
    batch,
    entries.map(({ target, rectangle }): NativeGlassBatchShape => ({
      x: rectangle.left - left,
      y: rectangle.top - top,
      width: rectangle.width,
      height: rectangle.height,
      radius: Number.parseFloat(target.style.getPropertyValue("--taskmap-material-radius")) || 0,
    })),
  );
}
