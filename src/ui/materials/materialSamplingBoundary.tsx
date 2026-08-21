import { createContext, useContext, type ReactNode, type RefObject } from "react";

export interface MaterialSamplingBoundary {
  readonly id: string;
  readonly elementRef: RefObject<HTMLElement | null>;
}

export interface MaterialRectangle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface MaterialOverscanInsets {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const MaterialSamplingBoundaryContext = createContext<MaterialSamplingBoundary | null>(null);

export function MaterialSamplingBoundaryProvider({
  boundary,
  children,
}: {
  readonly boundary: MaterialSamplingBoundary;
  readonly children: ReactNode;
}) {
  return (
    <MaterialSamplingBoundaryContext.Provider value={boundary}>
      {children}
    </MaterialSamplingBoundaryContext.Provider>
  );
}

export function useInheritedMaterialSamplingBoundary(): MaterialSamplingBoundary | null {
  return useContext(MaterialSamplingBoundaryContext);
}

export function calculateMaterialOverscan(
  surface: MaterialRectangle,
  boundary: MaterialRectangle,
  requestedPx: number,
): MaterialOverscanInsets {
  const requested = Math.max(0, finite(requestedPx));
  const surfaceRight = finite(surface.left) + Math.max(0, finite(surface.width));
  const surfaceBottom = finite(surface.top) + Math.max(0, finite(surface.height));
  const boundaryRight = finite(boundary.left) + Math.max(0, finite(boundary.width));
  const boundaryBottom = finite(boundary.top) + Math.max(0, finite(boundary.height));

  return Object.freeze({
    left: Math.min(requested, Math.max(0, finite(surface.left) - finite(boundary.left))),
    top: Math.min(requested, Math.max(0, finite(surface.top) - finite(boundary.top))),
    right: Math.min(requested, Math.max(0, boundaryRight - surfaceRight)),
    bottom: Math.min(requested, Math.max(0, boundaryBottom - surfaceBottom)),
  });
}

export function writeMaterialOverscan(
  surface: HTMLElement,
  boundary: MaterialRectangle,
  requestedPx: number,
): void {
  const insets = calculateMaterialOverscan(surface.getBoundingClientRect(), boundary, requestedPx);
  surface.style.setProperty("--taskmap-material-overscan-left", pixels(insets.left));
  surface.style.setProperty("--taskmap-material-overscan-top", pixels(insets.top));
  surface.style.setProperty("--taskmap-material-overscan-right", pixels(insets.right));
  surface.style.setProperty("--taskmap-material-overscan-bottom", pixels(insets.bottom));
}

export function viewportMaterialBoundary(): MaterialRectangle {
  return Object.freeze({
    left: 0,
    top: 0,
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  });
}

function pixels(value: number): string {
  return `${value.toFixed(2)}px`;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
