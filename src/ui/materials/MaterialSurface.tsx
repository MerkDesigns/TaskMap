import {
  createElement,
  forwardRef,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ForwardedRef,
  type HTMLAttributes,
  type RefObject,
} from "react";
import "./MaterialSurface.css";
import {
  MaterialSamplingBoundaryProvider,
  useInheritedMaterialSamplingBoundary,
  viewportMaterialBoundary,
  writeMaterialOverscan,
} from "./materialSamplingBoundary";
import { useMaterialPlane } from "./MaterialPlane";
import { materialRegistry } from "./materialRegistry";
import { useMaterialSurfaceGeometrySubscription } from "./MaterialSurfaceRegistration";
import { createMaterialSurfaceStyle } from "./materialSurfaceStyle";
import { drawNativeGlassRim } from "./nativeGlassRim";
import type {
  MaterialElevation,
  MaterialId,
  MaterialPlane,
  MaterialSurfaceEffect,
  NativeGlassMaterialDefinition,
} from "./materialTypes";

type MaterialSurfaceElement = "div" | "section" | "aside" | "nav";

export interface MaterialSurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly material: MaterialId;
  readonly plane?: MaterialPlane;
  readonly radius?: number;
  readonly elevation?: MaterialElevation;
  readonly effect?: MaterialSurfaceEffect;
  readonly as?: MaterialSurfaceElement;
}

export const MaterialSurface = forwardRef<HTMLElement, MaterialSurfaceProps>(
  function MaterialSurface(
    {
      as = "div",
      children,
      className,
      elevation = "default",
      effect,
      material,
      plane: planeOverride,
      radius: radiusOverride,
      style,
      ...props
    },
    forwardedRef,
  ) {
    const definition = materialRegistry.require(material);
    const nativeGlass = definition.strategy === "native-glass" ? definition : null;
    const plane = useMaterialPlane(planeOverride);
    const radius = requireMaterialRadius(material, radiusOverride ?? definition.defaultRadiusPx);
    const surfaceId = useId();
    const inheritedBoundary = useInheritedMaterialSamplingBoundary();
    const elementRef = useRef<HTMLElement | null>(null);
    const rimCanvasRef = useRef<HTMLCanvasElement>(null);
    const providedBoundary = useMemo(() => ({ id: surfaceId, elementRef }), [surfaceId]);

    const refreshNativeGeometry = useCallback(() => {
      const element = elementRef.current;
      if (!element || !nativeGlass) return;
      const samplingElement =
        nativeGlass.role === "small" ? inheritedBoundary?.elementRef.current : null;
      const samplingRectangle =
        samplingElement?.getBoundingClientRect() ?? viewportMaterialBoundary();
      const interactionPreblur =
        element.dataset.materialMotion === "active" ? nativeGlass.interactionPreblurPx : null;
      const requestedOverscan =
        (nativeGlass.blurPx + (nativeGlass.preblurPx ?? interactionPreblur ?? 0)) *
        nativeGlass.overscanRatio;
      writeMaterialOverscan(element, samplingRectangle, requestedOverscan);

      const rimCanvas = rimCanvasRef.current;
      if (!rimCanvas) return;
      const rectangle = element.getBoundingClientRect();
      drawNativeGlassRim(rimCanvas, {
        width: rectangle.width,
        height: rectangle.height,
        radiusPx: radius,
        devicePixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio,
        rim: nativeGlass.rim,
      });
    }, [inheritedBoundary, nativeGlass, radius]);

    useMaterialSurfaceGeometrySubscription(refreshNativeGeometry);
    useLayoutEffect(() => {
      if (!nativeGlass) return;
      refreshNativeGeometry();
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => refreshNativeGeometry());
      const element = elementRef.current;
      const inheritedElement = inheritedBoundary?.elementRef.current;
      if (element) observer?.observe(element);
      if (nativeGlass.role === "small" && inheritedElement && inheritedElement !== element) {
        observer?.observe(inheritedElement);
      }
      window.addEventListener("resize", refreshNativeGeometry);
      return () => {
        observer?.disconnect();
        window.removeEventListener("resize", refreshNativeGeometry);
      };
    }, [inheritedBoundary, nativeGlass, refreshNativeGeometry]);

    const composedRef = useCallback(
      (element: HTMLElement | null) => {
        elementRef.current = element;
        assignRef(forwardedRef, element);
      },
      [forwardedRef],
    );
    const materialStyle = createMaterialSurfaceStyle(definition, elevation, radius, style);
    const content =
      nativeGlass?.role === "large" ? (
        <MaterialSamplingBoundaryProvider boundary={providedBoundary}>
          {children}
        </MaterialSamplingBoundaryProvider>
      ) : (
        children
      );

    return createElement(
      as,
      {
        ...props,
        ref: composedRef,
        className: [
          "taskmap-material-surface",
          effect ? `taskmap-material-surface--${effect}` : null,
          className,
        ]
          .filter(Boolean)
          .join(" "),
        style: materialStyle,
        "data-material": definition.id,
        "data-material-strategy": definition.strategy,
        "data-material-role": nativeGlass?.role,
        "data-material-plane": plane,
        "data-material-elevation": elevation,
        "data-material-sampling-boundary": samplingBoundaryKind(nativeGlass, inheritedBoundary),
      },
      nativeGlass ? nativeGlassChrome(rimCanvasRef, nativeGlass) : null,
      content,
    );
  },
);

function nativeGlassChrome(
  rimCanvasRef: RefObject<HTMLCanvasElement>,
  definition: NativeGlassMaterialDefinition,
) {
  return (
    <>
      <span className="taskmap-material-native-glass__clip" aria-hidden="true">
        <span
          className="taskmap-material-native-glass__preblur"
          data-enabled={definition.preblurPx === null ? undefined : true}
          data-interaction-enabled={definition.interactionPreblurPx === null ? undefined : true}
        />
        <span className="taskmap-material-native-glass__backdrop" />
        <span className="taskmap-material-native-glass__highlight" />
      </span>
      <span className="taskmap-material-native-glass__rim" aria-hidden="true">
        <canvas ref={rimCanvasRef} className="taskmap-material-native-glass__rim-canvas" />
      </span>
    </>
  );
}

function samplingBoundaryKind(
  definition: NativeGlassMaterialDefinition | null,
  inheritedBoundary: ReturnType<typeof useInheritedMaterialSamplingBoundary>,
): "self" | "inherited" | "viewport" | undefined {
  if (!definition) return undefined;
  if (definition.role === "large") return "self";
  return inheritedBoundary ? "inherited" : "viewport";
}

function assignRef(ref: ForwardedRef<HTMLElement>, element: HTMLElement | null): void {
  if (typeof ref === "function") ref(element);
  else if (ref) ref.current = element;
}

function requireMaterialRadius(material: MaterialId, radius: number | null): number {
  if (radius === null || !Number.isFinite(radius) || radius < 0) {
    throw new RangeError(`${material} requires a finite non-negative radius`);
  }
  return radius;
}
