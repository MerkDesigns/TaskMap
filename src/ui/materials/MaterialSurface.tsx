import {
  createContext,
  createElement,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ForwardedRef,
  type HTMLAttributes,
  type RefObject,
} from "react";
import "./MaterialSurface.css";
import "./nativeGlassRecipe.css";
import {
  MaterialSamplingBoundaryProvider,
  useInheritedMaterialSamplingBoundary,
} from "./materialSamplingBoundary";
import { useMaterialPlane } from "./MaterialPlane";
import { materialRegistry } from "./materialRegistry";
import { registerNativeGlassGeometry } from "./nativeGlassGeometry";
import { createMaterialSurfaceStyle } from "./materialSurfaceStyle";
import { MajorGlassLayerContext } from "./MajorGlassLayer";
import type {
  MaterialElevation,
  MaterialId,
  MaterialBackdropSource,
  MaterialPlane,
  MaterialSurfaceEffect,
  NativeGlassMaterialDefinition,
} from "./materialTypes";

type MaterialSurfaceElement = "div" | "section" | "aside" | "nav";

/** Minor glass nested on another Minor defaults to a shell (contract: first Minor depth blurs). */
const InsideMinorGlass = createContext(false);

export interface MaterialSurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly material: MaterialId;
  readonly backdropSource?: MaterialBackdropSource;
  readonly plane?: MaterialPlane;
  readonly radius?: number;
  readonly elevation?: MaterialElevation;
  readonly effect?: MaterialSurfaceEffect;
  readonly geometryActive?: boolean;
  /** An existing list/layout owner supplies local dimensions instead of observing this surface. */
  readonly geometrySource?: "layout" | "owner";
  readonly as?: MaterialSurfaceElement;
}

export const MaterialSurface = forwardRef<HTMLElement, MaterialSurfaceProps>(
  function MaterialSurface(
    {
      as = "div",
      backdropSource: backdropSourceProp,
      children,
      className,
      elevation = "default",
      effect,
      geometryActive = true,
      geometrySource = "layout",
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
    const insideMinor = useContext(InsideMinorGlass);
    const backdropSourceOverride: MaterialBackdropSource =
      backdropSourceProp ?? (insideMinor && nativeGlass?.role === "small" ? "shell" : "self");
    if (backdropSourceOverride !== "self" && nativeGlass?.role !== "small") {
      throw new RangeError("Only Acrylic Small surfaces may use a shared or shell backdrop source");
    }
    const plane = useMaterialPlane(planeOverride);
    const radius = requireMaterialRadius(material, radiusOverride ?? definition.defaultRadiusPx);
    const surfaceId = useId();
    const inheritedBoundary = useInheritedMaterialSamplingBoundary();
    const majorLayer = useContext(MajorGlassLayerContext);
    const sharedMajor =
      nativeGlass?.role === "large" && plane === "base" && !inheritedBoundary ? majorLayer : null;
    const elementRef = useRef<HTMLElement | null>(null);
    const rimCanvasRef = useRef<HTMLCanvasElement>(null);
    const providedBoundary = useMemo(() => ({ id: surfaceId, elementRef }), [surfaceId]);

    useLayoutEffect(() => {
      if (sharedMajor && elementRef.current && geometryActive)
        return sharedMajor.register(elementRef.current, radius);
    }, [sharedMajor, radius, geometryActive]);

    useLayoutEffect(() => {
      const element = elementRef.current;
      if (!nativeGlass || !geometryActive || !element) return;
      return registerNativeGlassGeometry({
        element,
        canvas: rimCanvasRef.current,
        definition: nativeGlass,
        radius,
        shared: !!sharedMajor || backdropSourceOverride !== "self",
        owned: geometrySource === "owner",
        samplingElement: () =>
          backdropSourceOverride === "self" && nativeGlass.role === "small"
            ? (inheritedBoundary?.elementRef.current ?? null)
            : null,
      });
    }, [
      backdropSourceOverride,
      geometryActive,
      geometrySource,
      inheritedBoundary,
      nativeGlass,
      radius,
      sharedMajor,
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
      ) : nativeGlass?.role === "small" && !insideMinor ? (
        <InsideMinorGlass.Provider value>{children}</InsideMinorGlass.Provider>
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
          nativeGlass ? "taskmap-native-glass-recipe" : null,
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
        "data-material-backdrop-source": nativeGlass
          ? sharedMajor
            ? "plane"
            : backdropSourceOverride
          : undefined,
        "data-material-sampling-boundary": samplingBoundaryKind(nativeGlass, inheritedBoundary),
      },
      nativeGlass
        ? nativeGlassChrome(
            rimCanvasRef,
            nativeGlass,
            !sharedMajor && backdropSourceOverride !== "shell",
          )
        : null,
      content,
    );
  },
);

function nativeGlassChrome(
  rimCanvasRef: RefObject<HTMLCanvasElement | null>,
  definition: NativeGlassMaterialDefinition,
  ownFilters: boolean,
) {
  return (
    <>
      <span className="taskmap-material-native-glass__clip" aria-hidden="true">
        {ownFilters && (
          <span
            className="taskmap-material-native-glass__preblur taskmap-native-glass-preblur"
            data-enabled={definition.preblurPx === null ? undefined : true}
          />
        )}
        {ownFilters && (
          <span className="taskmap-material-native-glass__backdrop taskmap-native-glass-backdrop" />
        )}
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
