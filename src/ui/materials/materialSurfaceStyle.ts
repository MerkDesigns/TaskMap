import type { CSSProperties } from "react";
import type { MaterialDefinition, MaterialElevation, MaterialSurfaceStyle } from "./materialTypes";

export function createMaterialSurfaceStyle(
  definition: MaterialDefinition,
  elevation: MaterialElevation,
  radius: number,
  style: CSSProperties | undefined,
): MaterialSurfaceStyle {
  const materialStyle: MaterialSurfaceStyle = {
    ...style,
    "--taskmap-material-radius": `${radius}px`,
  };

  if (definition.strategy === "native-glass") {
    // A filter-output mask avoids making an ancestor a new backdrop root. The SVG viewport
    // follows mask-size; vmin clamps both corner axes together like CSS border-radius.
    const corner = `min(${radius}px,50vmin)`;
    const mask = `<svg xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="${radius}" fill="white" style="rx:${corner};ry:${corner}"/></svg>`;
    materialStyle["--taskmap-material-output-mask"] =
      `url("data:image/svg+xml,${encodeURIComponent(mask)}")`;
    materialStyle["--taskmap-material-blur"] = `${definition.blurPx}px`;
    materialStyle["--taskmap-material-preblur"] = `${definition.preblurPx ?? 0}px`;
    materialStyle["--taskmap-material-interaction-preblur"] =
      `${definition.interactionPreblurPx ?? 0}px`;
    materialStyle["--taskmap-material-saturation"] = definition.saturation;
    materialStyle["--taskmap-material-brightness"] = definition.brightness;
    materialStyle["--taskmap-material-contrast"] = definition.contrast;
    materialStyle["--taskmap-material-tint-rgb"] = definition.tint.rgb.join(" ");
    materialStyle["--taskmap-material-tint-opacity"] = definition.tint.opacity;
    materialStyle["--taskmap-material-tone-rgb"] = definition.tone.rgb.join(" ");
    materialStyle["--taskmap-material-tone-opacity"] = definition.tone.opacity;
    materialStyle["--taskmap-material-rim-softness"] = `${definition.rim.softnessPx}px`;
    materialStyle["--taskmap-material-border-brightness"] = 1;
    materialStyle["--taskmap-material-content-clip-inset"] =
      `${definition.rim.widthPx + definition.rim.softnessPx}px`;
    materialStyle["--taskmap-material-shadow"] =
      elevation === "none" ? "none" : nativeGlassShadow(definition.shadow);
    return materialStyle;
  }

  if (definition.strategy === "opaque") {
    const [highlightStart, highlightMiddle, highlightEnd] = definition.highlight.stops;
    materialStyle["--taskmap-material-tint-rgb"] = definition.tint.rgb.join(" ");
    materialStyle["--taskmap-material-tint-opacity"] = definition.tint.opacity;
    materialStyle["--taskmap-material-highlight"] = definition.highlight.opacity;
    materialStyle["--taskmap-material-highlight-radius"] = definition.highlight.radiusMultiplier;
    materialStyle["--taskmap-material-highlight-start-offset"] = `${highlightStart.offset * 100}%`;
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
    materialStyle["--taskmap-material-content-clip-inset"] = `${definition.border.widthPx}px`;
    materialStyle["--taskmap-material-shadow"] =
      elevation === "none"
        ? "none"
        : `${definition.shadow.xPx}px ${definition.shadow.yPx}px ${definition.shadow.blurPx}px rgb(0 0 0 / ${definition.shadow.opacity})`;
    return materialStyle;
  }

  materialStyle["--taskmap-material-fill-rgb"] = definition.fillRgb.join(" ");
  materialStyle["--taskmap-material-fill-opacity"] = definition.fillOpacity ?? 1;
  materialStyle["--taskmap-material-css-backdrop"] =
    definition.backdropBlurPx === undefined ? "none" : `blur(${definition.backdropBlurPx}px)`;
  materialStyle["--taskmap-material-border-width"] = `${definition.border.widthPx}px`;
  materialStyle["--taskmap-material-border-rgb"] = definition.border.rgb.join(" ");
  materialStyle["--taskmap-material-border-alpha"] = definition.border.alpha;
  materialStyle["--taskmap-material-content-clip-inset"] = `${definition.border.widthPx}px`;
  materialStyle["--taskmap-material-shadow"] =
    `${definition.insetShadow.xPx}px ${definition.insetShadow.yPx}px ${definition.insetShadow.blurPx}px rgb(0 0 0 / ${definition.insetShadow.opacity}) inset`;
  if (definition.outerShadow) {
    const shadow = definition.outerShadow;
    materialStyle["--taskmap-material-shadow"] =
      `${shadow.xPx}px ${shadow.yPx}px ${shadow.blurPx}px rgb(0 0 0 / ${shadow.opacity})`;
  }
  return materialStyle;
}

function nativeGlassShadow(shadow: {
  readonly xPx: number;
  readonly yPx: number;
  readonly blurPx: number;
  readonly spreadPx: number;
  readonly opacity: number;
}): string {
  return [
    `${shadow.xPx}px ${shadow.yPx}px ${Math.max(0, shadow.blurPx - 4)}px ${shadow.spreadPx}px color-mix(in srgb, rgb(0 0 0 / ${shadow.opacity}) calc(58% * var(--taskmap-material-presence-progress, 1)), transparent)`,
    `${shadow.xPx}px ${shadow.yPx + 1}px ${shadow.blurPx}px ${Math.max(-4, shadow.spreadPx - 1)}px color-mix(in srgb, rgb(0 0 0 / ${shadow.opacity}) calc(42% * var(--taskmap-material-presence-progress, 1)), transparent)`,
  ].join(", ");
}
