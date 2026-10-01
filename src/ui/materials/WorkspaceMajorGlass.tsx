import { useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import {
  MajorGlassLayerContext,
  publishWorkspaceMajorOwner,
  useWorkspaceMajorOwner,
  type MajorGlassLayerOwner,
} from "./MajorGlassLayer";
import { registerMaterialGeometryWork } from "./materialGeometryScheduler";
import {
  readMaterialPresentation,
  subscribeMaterialPresentation,
  subscribeMaterialSurfaceGeometryInvalidation,
} from "./materialGeometryInvalidation";
import { NativeGlassPlane, outputMask, type NativeGlassShape } from "./NativeGlassPlane";
import { createLayeredMaskWriter, layeredOutputMask } from "./layeredOutputMask";
import { ACRYLIC_LARGE } from "./materialDefinitions";

/** Workspace Majors share L0; retained Minor rendering stays local. */
export function WorkspaceMajorGlass({ children }: PropsWithChildren) {
  const host = useRef<HTMLDivElement>(null);
  // The owner writes size/mask imperatively; props must stay constant so re-renders never reset them.
  const [initialSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const owner = useMemo(
    () => createWorkspaceMajorOwner(() => host.current?.firstElementChild as HTMLElement | null),
    [],
  );
  useLayoutEffect(() => {
    owner.refresh();
    return publishWorkspaceMajorOwner(owner);
  }, [owner]);
  return (
    <MajorGlassLayerContext.Provider value={owner}>
      <div
        ref={host}
        data-workspace-major-glass="true"
        style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none" }}
      >
        <NativeGlassPlane
          definition={ACRYLIC_LARGE}
          width={initialSize.width}
          height={initialSize.height}
          shapes={[]}
        />
      </div>
      {children}
    </MajorGlassLayerContext.Provider>
  );
}

/**
 * Lets base Majors rendered outside the workspace subtree (the app-level window chrome portal)
 * join the mounted workspace plane. Without a workspace they keep their local material.
 */
export function WorkspaceMajorGlassBridge({ children }: PropsWithChildren) {
  const owner = useWorkspaceMajorOwner();
  return (
    <MajorGlassLayerContext.Provider value={owner}>{children}</MajorGlassLayerContext.Provider>
  );
}

export function createWorkspaceMajorOwner(
  getPlane: () => HTMLElement | null,
): MajorGlassLayerOwner & { refresh(): void } {
  const shapes = new Map<HTMLElement, NativeGlassShape>();
  const refresh = () => {
    const plane = getPlane();
    if (!plane) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const visible = [...shapes].map(([element, shape]) => {
      const { translateX, translateY, scale, opacity } = readMaterialPresentation(element);
      const width = shape.width * scale;
      const height = shape.height * scale;
      return {
        ...shape,
        x: shape.x + translateX + (shape.width - width) / 2,
        y: shape.y + translateY + (shape.height - height) / 2,
        width,
        height,
        radius: shape.radius * scale,
        opacity,
      };
    });
    plane.style.width = `${width}px`;
    plane.style.height = `${height}px`;
    // Layered per-shape images: slides only move mask positions and fades reuse cached opacity
    // levels, so presence frames never re-encode a full-window SVG.
    planeMaskWriter(plane).write(
      layeredOutputMask(visible, 0, { width, height }) ?? {
        image: outputMask(width, height, visible, []),
        position: "0 0",
        size: "100% 100%",
        composite: "add",
      },
    );
    plane.dataset.planeShapeCount = String(visible.length);
    plane.dataset.majorGlassPlane = "true";
  };
  return {
    refresh,
    register(element, radius) {
      const work = registerMaterialGeometryWork(
        {
          read(frame) {
            // Measured bounds include the current presentation; store the resting shape.
            const rect = frame.rectangle(element);
            const { translateX, translateY, scale } = readMaterialPresentation(element);
            const width = rect.width / (scale || 1);
            const height = rect.height / (scale || 1);
            const shape = {
              x: rect.x + rect.width / 2 - translateX - width / 2,
              y: rect.y + rect.height / 2 - translateY - height / 2,
              width,
              height,
              radius,
            };
            return () => {
              shapes.set(element, shape);
              refresh();
            };
          },
        },
        [element],
      );
      const stopGeometry = subscribeMaterialSurfaceGeometryInvalidation(element, work.invalidate);
      const stopMotion = subscribeMaterialPresentation(element, refresh);
      return () => {
        stopMotion();
        stopGeometry();
        work.dispose();
        shapes.delete(element);
        refresh();
      };
    },
  };
}

const PLANE_MASK_PROPERTIES = {
  image: "--taskmap-plane-mask",
  position: "--taskmap-plane-mask-position",
  size: "--taskmap-plane-mask-size",
  composite: "--taskmap-plane-mask-composite",
} as const;
const planeMaskWriters = new WeakMap<HTMLElement, ReturnType<typeof createLayeredMaskWriter>>();

function planeMaskWriter(plane: HTMLElement) {
  let writer = planeMaskWriters.get(plane);
  if (!writer) {
    writer = createLayeredMaskWriter(plane, PLANE_MASK_PROPERTIES);
    planeMaskWriters.set(plane, writer);
  }
  return writer;
}
