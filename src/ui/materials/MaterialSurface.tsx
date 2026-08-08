import { createElement, forwardRef, type HTMLAttributes } from "react";
import "./MaterialSurface.css";
import { useMaterialPlane } from "./MaterialPlane";
import { materialRegistry } from "./materialRegistry";
import type {
  MaterialElevation,
  MaterialId,
  MaterialPlane,
  MaterialSurfaceStyle,
} from "./materialTypes";

type MaterialSurfaceElement = "div" | "section" | "aside" | "nav";

export interface MaterialSurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly material: MaterialId;
  readonly plane?: MaterialPlane;
  readonly radius?: number;
  readonly elevation?: MaterialElevation;
  readonly as?: MaterialSurfaceElement;
}

export const MaterialSurface = forwardRef<HTMLElement, MaterialSurfaceProps>(
  function MaterialSurface(
    {
      as = "div",
      className,
      elevation = "default",
      material,
      plane: planeOverride,
      radius: radiusOverride,
      style,
      ...props
    },
    forwardedRef,
  ) {
    const definition = materialRegistry.require(material);
    const plane = useMaterialPlane(planeOverride);
    const radius = radiusOverride ?? definition.defaultRadiusPx;

    if (radius === null || !Number.isFinite(radius) || radius < 0) {
      throw new RangeError(`${material} requires a finite non-negative radius`);
    }

    const materialStyle: MaterialSurfaceStyle = {
      ...style,
      "--taskmap-material-radius": `${radius}px`,
    };

    if (definition.strategy === "cached-acrylic") {
      const [highlightStart, highlightMiddle, highlightEnd] = definition.highlight.stops;
      materialStyle["--taskmap-material-tint-rgb"] = definition.tint.rgb.join(" ");
      materialStyle["--taskmap-material-tint-opacity"] = definition.tint.opacity;
      materialStyle["--taskmap-material-highlight"] = definition.highlight.opacity;
      materialStyle["--taskmap-material-highlight-radius"] = definition.highlight.radiusMultiplier;
      materialStyle["--taskmap-material-highlight-start-offset"] =
        `${highlightStart.offset * 100}%`;
      materialStyle["--taskmap-material-highlight-start-multiplier"] =
        highlightStart.opacityMultiplier;
      materialStyle["--taskmap-material-highlight-middle-offset"] =
        `${highlightMiddle.offset * 100}%`;
      materialStyle["--taskmap-material-highlight-middle-multiplier"] =
        highlightMiddle.opacityMultiplier;
      materialStyle["--taskmap-material-highlight-end-offset"] = `${highlightEnd.offset * 100}%`;
      materialStyle["--taskmap-material-highlight-end-multiplier"] = highlightEnd.opacityMultiplier;
      materialStyle["--taskmap-material-border-width"] = `${definition.border.widthPx}px`;
      materialStyle["--taskmap-material-border-top"] = definition.border.topWhiteAlpha;
      materialStyle["--taskmap-material-border-bottom"] = definition.border.bottomWhiteAlpha;
      materialStyle["--taskmap-material-shadow"] =
        elevation === "none"
          ? "none"
          : `${definition.shadow.xPx}px ${definition.shadow.yPx}px ${definition.shadow.blurPx}px rgb(0 0 0 / ${definition.shadow.opacity})`;
    } else {
      materialStyle["--taskmap-material-fill-rgb"] = definition.fillRgb.join(" ");
      materialStyle["--taskmap-material-border-width"] = `${definition.border.widthPx}px`;
      materialStyle["--taskmap-material-border-rgb"] = definition.border.rgb.join(" ");
      materialStyle["--taskmap-material-border-alpha"] = definition.border.alpha;
      materialStyle["--taskmap-material-shadow"] =
        `${definition.insetShadow.xPx}px ${definition.insetShadow.yPx}px ${definition.insetShadow.blurPx}px rgb(0 0 0 / ${definition.insetShadow.opacity}) inset`;
    }

    return createElement(as, {
      ...props,
      ref: forwardedRef,
      className: className ? `taskmap-material-surface ${className}` : "taskmap-material-surface",
      style: materialStyle,
      "data-material": definition.id,
      "data-material-strategy": definition.strategy,
      "data-material-plane": plane,
      "data-material-elevation": elevation,
    });
  },
);
