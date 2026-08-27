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
import {
  subscribeMaterialSurfaceGeometryInvalidation,
  subscribeMaterialTuningChanged,
} from "./materialGeometryInvalidation";
import { createMaterialSurfaceStyle } from "./materialSurfaceStyle";
import { recordMaterialGeometryRefresh } from "./materialPerformanceDiagnostics";
import { drawNativeGlassRim } from "./nativeGlassRim";
import type {
  MaterialElevation,
  MaterialId,
  MaterialBackdropSource,
  MaterialPlane,
  MaterialSurfaceEffect,
  NativeGlassMaterialDefinition,
} from "./materialTypes";

type MaterialSurfaceElement = "div" | "section" | "aside" | "nav";

export interface MaterialSurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly material: MaterialId;
  readonly backdropSource?: MaterialBackdropSource;
  readonly plane?: MaterialPlane;
  readonly radius?: number;
  readonly elevation?: MaterialElevation;
  readonly effect?: MaterialSurfaceEffect;
  readonly geometryActive?: boolean;
  readonly as?: MaterialSurfaceElement;
}

export const MaterialSurface = forwardRef<HTMLElement, MaterialSurfaceProps>(
  function MaterialSurface(
    {
      as = "div",
      backdropSource: backdropSourceOverride = "self",
      children,
      className,
      elevation = "default",
      effect,
      geometryActive = true,
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
    if (backdropSourceOverride === "shared" && nativeGlass?.role !== "small") {
      throw new RangeError("Only Acrylic Small surfaces may use a shared backdrop source");
    }
    const plane = useMaterialPlane(planeOverride);
    const radius = requireMaterialRadius(material, radiusOverride ?? definition.defaultRadiusPx);
    const surfaceId = useId();
    const inheritedBoundary = useInheritedMaterialSamplingBoundary();
    const elementRef = useRef<HTMLElement | null>(null);
    const rimCanvasRef = useRef<HTMLCanvasElement>(null);
    const rimGeometryRef = useRef("");
    const providedBoundary = useMemo(() => ({ id: surfaceId, elementRef }), [surfaceId]);

    const refreshNativeGeometry = useCallback(() => {
      const element = elementRef.current;
      if (!element || !nativeGlass) return;
      recordMaterialGeometryRefresh();
      if (backdropSourceOverride === "self") {
        const samplingElement =
          nativeGlass.role === "small" ? inheritedBoundary?.elementRef.current : null;
        const samplingRectangle =
          samplingElement?.getBoundingClientRect() ?? viewportMaterialBoundary();
        const interactionPreblur =
          element.dataset.materialMotion === "active" ? nativeGlass.interactionPreblurPx : null;
        const computedBlur = Number.parseFloat(
          getComputedStyle(element).getPropertyValue("--taskmap-material-effective-blur"),
        );
        const effectiveBlur = Number.isFinite(computedBlur) ? computedBlur : nativeGlass.blurPx;
        const requestedOverscan =
          (effectiveBlur + (nativeGlass.preblurPx ?? interactionPreblur ?? 0)) *
          nativeGlass.overscanRatio;
        writeMaterialOverscan(element, samplingRectangle, requestedOverscan);
      }

      const rimCanvas = rimCanvasRef.current;
      if (!rimCanvas) return;
      const rectangle = element.getBoundingClientRect();
      const devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio;
      const computedBorderBrightness = Number.parseFloat(
        getComputedStyle(element).getPropertyValue(
          "--taskmap-material-effective-border-brightness",
        ),
      );
      const borderBrightness = Number.isFinite(computedBorderBrightness)
        ? Math.max(0, computedBorderBrightness)
        : 1;
      const rimGeometry = `${rectangle.width}:${rectangle.height}:${radius}:${devicePixelRatio}:${borderBrightness}`;
      if (rimGeometryRef.current === rimGeometry) return;
      rimGeometryRef.current = rimGeometry;
      drawNativeGlassRim(rimCanvas, {
        width: rectangle.width,
        height: rectangle.height,
        radiusPx: radius,
        devicePixelRatio,
        rim: {
          ...nativeGlass.rim,
          exposure: nativeGlass.rim.exposure * borderBrightness,
        },
      });
    }, [backdropSourceOverride, inheritedBoundary, nativeGlass, radius]);

    useLayoutEffect(() => {
      if (!nativeGlass || !geometryActive) return;
      refreshNativeGeometry();
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => refreshNativeGeometry());
      const element = elementRef.current;
      const inheritedElement = inheritedBoundary?.elementRef.current;
      if (element) observer?.observe(element);
      if (
        backdropSourceOverride === "self" &&
        nativeGlass.role === "small" &&
        inheritedElement &&
        inheritedElement !== element
      ) {
        observer?.observe(inheritedElement);
      }
      const unsubscribeInvalidation = element
        ? subscribeMaterialSurfaceGeometryInvalidation(element, refreshNativeGeometry)
        : null;
      const unsubscribeTuning = import.meta.env.DEV
        ? subscribeMaterialTuningChanged(refreshNativeGeometry)
        : null;
      let scrollRefreshFrame: number | null = null;
      const refreshAfterScroll = () => {
        if (scrollRefreshFrame !== null) return;
        scrollRefreshFrame = requestAnimationFrame(() => {
          scrollRefreshFrame = null;
          refreshNativeGeometry();
        });
      };
      window.addEventListener("resize", refreshNativeGeometry);
      if (backdropSourceOverride === "self") {
        window.addEventListener("scroll", refreshAfterScroll, true);
      }
      return () => {
        if (scrollRefreshFrame !== null) cancelAnimationFrame(scrollRefreshFrame);
        observer?.disconnect();
        unsubscribeInvalidation?.();
        unsubscribeTuning?.();
        window.removeEventListener("resize", refreshNativeGeometry);
        if (backdropSourceOverride === "self") {
          window.removeEventListener("scroll", refreshAfterScroll, true);
        }
      };
    }, [
      backdropSourceOverride,
      geometryActive,
      inheritedBoundary,
      nativeGlass,
      refreshNativeGeometry,
    ]);

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
        "data-material-backdrop-source": nativeGlass ? backdropSourceOverride : undefined,
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
