import { morphed, type NativeGlassShape } from "./NativeGlassPlane";
import type { MaterialRectangle } from "./materialSamplingBoundary";

/** CSS mask values for one filter plane: layered images positioned and sized per shape. */
export interface LayeredOutputMask {
  readonly image: string;
  readonly position: string;
  readonly size: string;
  readonly composite: string;
}

/**
 * Moving shapes only change layer positions; images are cached per rounded-rectangle size so
 * drag/slot frames never encode or decode a new mask. A shared viewport becomes one intersecting
 * layer. Morphing (scroll-edge) shapes are composed from cached corner caps, so a visible height
 * that changes every frame still reuses images. Returns null when the shapes cannot be expressed
 * exactly this way.
 */
export function layeredOutputMask(
  shapes: readonly NativeGlassShape[],
  overscan: number,
  bounds?: { readonly width: number; readonly height: number },
): LayeredOutputMask | null {
  if (!shapes.length) {
    return EMPTY_MASK;
  }
  const morphing = shapes.filter((shape) => shape.morph && shape.clip);
  const flat = shapes.filter((shape) => !(shape.morph && shape.clip));
  if (morphing.length && flat.some((shape) => shape.clip)) return null;
  const clips = flat.flatMap((shape) => (shape.clip ? [shape.clip] : []));
  if (clips.length && clips.length !== flat.length) return null;
  const viewport = clips.length ? boundingRectangle(clips) : null;
  if (viewport && !flat.every((shape) => sameRectangle(shape.clip!, clipTo(shape, viewport)))) {
    return null;
  }
  const shapeLayers: MaskLayer[] = [
    ...flat.flatMap(fullLayer),
    ...morphing.flatMap((shape) =>
      sameRectangle(shape.clip!, {
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
      })
        ? fullLayer(shape)
        : capLayers(morphed(shape)),
    ),
  ];
  // WebView2 treats a mask whose layers all lie outside the element as no mask and paints the
  // unmasked filter output over the whole plane (e.g. glass flying out past the window edge).
  const layers = bounds
    ? shapeLayers.filter((layer) => intersectsBounds(layer, overscan, bounds))
    : shapeLayers;
  if (!layers.length) {
    return EMPTY_MASK;
  }
  if (viewport) layers.unshift({ image: SOLID_LAYER, ...viewport, composite: "intersect" });
  return {
    image: layers.map((layer) => layer.image).join(", "),
    position: layers
      .map((layer) => `${layer.left + overscan}px ${layer.top + overscan}px`)
      .join(", "),
    size: layers.map((layer) => `${layer.width}px ${layer.height}px`).join(", "),
    composite: layers.map((layer) => layer.composite).join(", "),
  };
}

interface MaskLayer extends MaterialRectangle {
  readonly image: string;
  readonly composite: "add" | "intersect";
}

function fullLayer(shape: NativeGlassShape): MaskLayer[] {
  const alpha = quantizedOpacity(shape.opacity);
  if (alpha === 0) return [];
  // Fading shapes are pure gradients: a frame must never reference a mask image that is still
  // loading, because WebView2 then paints the unmasked filter output across the whole plane.
  if (alpha < 1) return gradientRoundedLayers(shape, alpha);
  return [
    {
      image: roundedRectangleImage(shape.width, shape.height, shape.radius, alpha),
      left: shape.x,
      top: shape.y,
      width: shape.width,
      height: shape.height,
      composite: "add",
    },
  ];
}

/**
 * A translucent rounded rectangle from generated layers only: four quarter-disc corners and three
 * edge-to-edge bands. Nothing overlaps, so additive alpha stays uniform.
 */
function gradientRoundedLayers(
  { x, y, width, height, radius }: NativeGlassShape,
  alpha: number,
): MaskLayer[] {
  if (width <= 0 || height <= 0) return [];
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const fill = solidLayer(alpha);
  const layer = (image: string, left: number, top: number, w: number, h: number): MaskLayer => ({
    image,
    left,
    top,
    width: w,
    height: h,
    composite: "add",
  });
  if (r === 0) return [layer(fill, x, y, width, height)];
  const corner = (at: string) =>
    `radial-gradient(circle at ${at}, rgb(0 0 0 / ${alpha}) ${Math.max(0, r - 0.5)}px, transparent ${r}px)`;
  const layers = [
    layer(corner("100% 100%"), x, y, r, r),
    layer(corner("0 100%"), x + width - r, y, r, r),
    layer(corner("100% 0"), x, y + height - r, r, r),
    layer(corner("0 0"), x + width - r, y + height - r, r, r),
  ];
  if (width > 2 * r) {
    layers.push(layer(fill, x + r, y, width - 2 * r, r));
    layers.push(layer(fill, x + r, y + height - r, width - 2 * r, r));
  }
  if (height > 2 * r) layers.push(layer(fill, x, y + r, width, height - 2 * r));
  return layers;
}

/** Rounded top cap, solid middle and rounded bottom cap; only sizes change as height changes. */
function capLayers({ x, y, width, height, radius, opacity }: NativeGlassShape): MaskLayer[] {
  const alpha = quantizedOpacity(opacity);
  const r = Math.max(0, Math.min(radius, width / 2));
  const cap = Math.min(r, height / 2);
  if (cap <= 0 || width <= 0 || alpha === 0) return [];
  const layer = (image: string, top: number, layerHeight: number): MaskLayer => ({
    image,
    left: x,
    top,
    width,
    height: layerHeight,
    composite: "add",
  });
  // Opaque layers overlap by 1px to hide seams; translucent ones must not (additive alpha).
  const overlap = alpha === 1 ? 1 : 0;
  const middleTop = y + cap - overlap;
  const middleHeight = height - 2 * cap + 2 * overlap;
  return [
    layer(cornerCapImage(width, r, "top", alpha), y, cap),
    ...(height - 2 * cap > 0 ? [layer(solidLayer(alpha), middleTop, middleHeight)] : []),
    layer(cornerCapImage(width, r, "bottom", alpha), y + height - cap, cap),
  ];
}

const SOLID_LAYER = "linear-gradient(#000, #000)";
const EMPTY_LAYER = "linear-gradient(transparent, transparent)";
/**
 * Hides the whole output. The layer must cover the element: WebView2 ignores a zero-size mask
 * layer and would paint the unmasked filter output (a blurred rectangle over the plane).
 */
const EMPTY_MASK: LayeredOutputMask = Object.freeze({
  image: EMPTY_LAYER,
  position: "0 0",
  size: "100% 100%",
  composite: "add",
});
/** Sizes x opacity levels (fades); cleared wholesale when exceeded. */
const MAX_CACHED_IMAGES = 512;
/** Fade opacity is quantised so a fading surface reuses a bounded set of decoded images. */
const OPACITY_LEVELS = 64;

function quantizedOpacity(opacity = 1): number {
  return Math.round(Math.max(0, Math.min(1, opacity)) * OPACITY_LEVELS) / OPACITY_LEVELS;
}

function solidLayer(alpha: number): string {
  return alpha === 1
    ? SOLID_LAYER
    : `linear-gradient(rgb(0 0 0 / ${alpha}), rgb(0 0 0 / ${alpha}))`;
}
const roundedRectangleImages = new Map<string, string>();
/** Keeps cached mask images decoded so a returning shape never references a loading image. */
const decodedImages = new Map<string, HTMLImageElement>();

function cacheMaskImage(key: string, svg: string): string {
  if (roundedRectangleImages.size >= MAX_CACHED_IMAGES) {
    roundedRectangleImages.clear();
    decodedImages.clear();
  }
  const source = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const image = `url("${source}")`;
  roundedRectangleImages.set(key, image);
  if (typeof Image !== "undefined") {
    const element = new Image();
    element.src = source;
    element.decode?.().catch(() => undefined);
    decodedImages.set(key, element);
  }
  return image;
}

function roundedRectangleImage(
  width: number,
  height: number,
  radius: number,
  alpha: number,
): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const key = `${width}x${height}r${r}a${alpha}`;
  const image = roundedRectangleImages.get(key);
  if (image) return image;
  return cacheMaskImage(
    key,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><rect width="${width}" height="${height}" rx="${r}" fill="white" fill-opacity="${alpha}"/></svg>`,
  );
}

function cornerCapImage(
  width: number,
  radius: number,
  edge: "top" | "bottom",
  alpha: number,
): string {
  const key = `${width}r${radius}${edge}a${alpha}`;
  const image = roundedRectangleImages.get(key);
  if (image) return image;
  const y = edge === "top" ? 0 : -radius;
  return cacheMaskImage(
    key,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${radius}" viewBox="0 0 ${width} ${radius}" preserveAspectRatio="none"><rect y="${y}" width="${width}" height="${radius * 2}" rx="${radius}" fill="white" fill-opacity="${alpha}"/></svg>`,
  );
}

function intersectsBounds(
  layer: MaskLayer,
  overscan: number,
  bounds: { readonly width: number; readonly height: number },
): boolean {
  const left = layer.left + overscan;
  const top = layer.top + overscan;
  return (
    left < bounds.width && top < bounds.height && left + layer.width > 0 && top + layer.height > 0
  );
}

function boundingRectangle(rectangles: readonly MaterialRectangle[]): MaterialRectangle {
  const left = Math.min(...rectangles.map((rectangle) => rectangle.left));
  const top = Math.min(...rectangles.map((rectangle) => rectangle.top));
  const right = Math.max(...rectangles.map((rectangle) => rectangle.left + rectangle.width));
  const bottom = Math.max(...rectangles.map((rectangle) => rectangle.top + rectangle.height));
  return { left, top, width: right - left, height: bottom - top };
}

function clipTo(shape: NativeGlassShape, viewport: MaterialRectangle): MaterialRectangle {
  const left = Math.max(shape.x, viewport.left);
  const top = Math.max(shape.y, viewport.top);
  const right = Math.min(shape.x + shape.width, viewport.left + viewport.width);
  const bottom = Math.min(shape.y + shape.height, viewport.top + viewport.height);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function sameRectangle(a: MaterialRectangle, b: MaterialRectangle): boolean {
  const close = (x: number, y: number) => Math.abs(x - y) < 0.01;
  return (
    close(a.left, b.left) &&
    close(a.top, b.top) &&
    close(a.width, b.width) &&
    close(a.height, b.height)
  );
}

export type LayeredMaskProperties = Readonly<Record<keyof LayeredOutputMask, string>>;

/** Writes mask values to custom properties, skipping unchanged ones (no redundant invalidation). */
export function createLayeredMaskWriter(
  element: HTMLElement,
  properties: LayeredMaskProperties,
): { write(mask: LayeredOutputMask): void; clear(): void } {
  const written: Partial<Record<keyof LayeredOutputMask, string>> = {};
  const keys = Object.keys(properties) as (keyof LayeredOutputMask)[];
  return {
    write(mask) {
      for (const key of keys) {
        if (written[key] === mask[key]) continue;
        written[key] = mask[key];
        element.style.setProperty(properties[key], mask[key]);
      }
    },
    clear() {
      for (const key of keys) {
        delete written[key];
        element.style.removeProperty(properties[key]);
      }
    },
  };
}
