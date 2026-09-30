import { createContext } from "react";
import { outputMask, type NativeGlassShape } from "./NativeGlassPlane";
import { createLayeredMaskWriter, layeredOutputMask } from "./layeredOutputMask";

export { layeredOutputMask };
import { registerMaterialGeometryWork } from "./materialGeometryScheduler";

/** Default Minor rendering; Dev can switch back to the legacy root clip for comparison. */
export const SmallGlassOutputMaskEnabled = createContext(true);
const latest = new WeakMap<HTMLElement, readonly NativeGlassShape[]>();
const writers = new WeakMap<HTMLElement, () => void>();
const MASK_PROPERTIES = {
  image: "--taskmap-small-output-mask",
  position: "--taskmap-small-output-mask-position",
  size: "--taskmap-small-output-mask-size",
  composite: "--taskmap-small-output-mask-composite",
} as const;

export function writeSmallOutputShapes(
  plane: HTMLElement,
  shapes: readonly NativeGlassShape[],
): boolean {
  latest.set(plane, shapes);
  const write = writers.get(plane);
  write?.();
  return !!write;
}
export function readSmallOutputShapes(plane: HTMLElement): readonly NativeGlassShape[] {
  return latest.get(plane) ?? [];
}

/** List owners keep their coordinate system; only filter outputs receive the viewport mask. */
export function registerSmallOutputMask(plane: HTMLElement): () => void {
  let width = 0;
  let height = 0;
  let overscan = 0;
  const maskWriter = createLayeredMaskWriter(plane, MASK_PROPERTIES);
  const write = () => {
    const shapes = readSmallOutputShapes(plane);
    const mask = layeredOutputMask(shapes, overscan) ?? {
      image: outputMask(width + overscan * 2, height + overscan * 2, shapes, [], {
        x: -overscan,
        y: -overscan,
      }),
      position: "0 0",
      size: "100% 100%",
      composite: "add",
    };
    maskWriter.write(mask);
  };
  const geometry = registerMaterialGeometryWork(
    {
      read(frame) {
        const size = frame.size(plane);
        const margin =
          Number.parseFloat(
            frame.style(plane).getPropertyValue("--taskmap-shared-small-overscan"),
          ) || 0;
        return () => {
          width = size.width;
          height = size.height;
          overscan = margin;
          write();
        };
      },
    },
    plane.parentElement ? [plane, plane.parentElement] : [plane],
  );
  writers.set(plane, () => {
    write();
    // A previously inactive batch may have become visible. Never reschedule from a
    // geometry write: a hidden parent can legitimately keep its dimensions zero.
    if ((!width || !height) && readSmallOutputShapes(plane).length) geometry.invalidate();
  });
  write();
  return () => {
    writers.delete(plane);
    geometry.dispose();
    maskWriter.clear();
  };
}
