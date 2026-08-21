import type { NativeGlassRimDefinition } from "./materialTypes";

export const NATIVE_GLASS_SPECULAR_EXPOSURE = 0.3;

export interface NativeGlassRimGeometry {
  readonly width: number;
  readonly height: number;
  readonly radiusPx: number;
  readonly devicePixelRatio: number;
  readonly rim: NativeGlassRimDefinition;
}

export function drawNativeGlassRim(
  canvas: HTMLCanvasElement,
  geometry: NativeGlassRimGeometry,
): void {
  const width = Math.max(1, finite(geometry.width));
  const height = Math.max(1, finite(geometry.height));
  const dpr = Math.max(1, finite(geometry.devicePixelRatio));
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  if (typeof CanvasRenderingContext2D === "undefined") return;
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext("2d");
  } catch {
    return;
  }
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const rimWidth = geometry.rim.widthPx;
  const half = Math.max(0.35, rimWidth / 2);
  const x = half;
  const y = half;
  const pathWidth = Math.max(0, width - rimWidth);
  const pathHeight = Math.max(0, height - rimWidth);
  const radius = Math.max(0, Math.min(geometry.radiusPx - half, pathWidth / 2, pathHeight / 2));
  const baseAlpha = Math.min(1, geometry.rim.baseAlpha * geometry.rim.exposure);

  if (baseAlpha > 0.0005 && pathWidth > 0 && pathHeight > 0) {
    context.lineWidth = rimWidth;
    context.strokeStyle = `rgba(255,255,255,${baseAlpha})`;
    roundedRectPath(context, x, y, pathWidth, pathHeight, radius);
    context.stroke();
  }

  strokeSegment(context, x + radius, y, x + pathWidth - radius, y, 0, -1, geometry.rim);
  strokeSegment(
    context,
    x + pathWidth,
    y + radius,
    x + pathWidth,
    y + pathHeight - radius,
    1,
    0,
    geometry.rim,
  );
  strokeSegment(
    context,
    x + pathWidth - radius,
    y + pathHeight,
    x + radius,
    y + pathHeight,
    0,
    1,
    geometry.rim,
  );
  strokeSegment(context, x, y + pathHeight - radius, x, y + radius, -1, 0, geometry.rim);

  if (radius <= 0.01) return;
  const corners = [
    { cx: x + pathWidth - radius, cy: y + radius, start: -Math.PI / 2, end: 0 },
    { cx: x + pathWidth - radius, cy: y + pathHeight - radius, start: 0, end: Math.PI / 2 },
    { cx: x + radius, cy: y + pathHeight - radius, start: Math.PI / 2, end: Math.PI },
    { cx: x + radius, cy: y + radius, start: Math.PI, end: Math.PI * 1.5 },
  ];
  const cornerSegments = 28;
  for (const corner of corners) {
    for (let index = 0; index < cornerSegments; index += 1) {
      const start = corner.start + (corner.end - corner.start) * (index / cornerSegments);
      const end = corner.start + (corner.end - corner.start) * ((index + 1) / cornerSegments);
      const middle = (start + end) / 2;
      strokeSegment(
        context,
        corner.cx + Math.cos(start) * radius,
        corner.cy + Math.sin(start) * radius,
        corner.cx + Math.cos(end) * radius,
        corner.cy + Math.sin(end) * radius,
        Math.cos(middle),
        Math.sin(middle),
        geometry.rim,
      );
    }
  }
}

export function nativeGlassSpecularAlpha(
  rim: NativeGlassRimDefinition,
  normalX: number,
  normalY: number,
): number {
  const direction = (rim.lightDirectionDegrees * Math.PI) / 180;
  const dot = normalX * Math.sin(direction) + normalY * -Math.cos(direction);
  const primary = Math.pow(Math.max(dot, 0), rim.sharpness) * rim.primaryStrength;
  const opposite = Math.pow(Math.max(-dot, 0), rim.sharpness) * rim.oppositeStrength;
  return Math.min(
    1,
    (primary + opposite) * rim.specularOpacity * NATIVE_GLASS_SPECULAR_EXPOSURE * rim.exposure,
  );
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.arcTo(x + width, y, x + width, y + radius, radius);
  context.lineTo(x + width, y + height - radius);
  context.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  context.lineTo(x + radius, y + height);
  context.arcTo(x, y + height, x, y + height - radius, radius);
  context.lineTo(x, y + radius);
  context.arcTo(x, y, x + radius, y, radius);
  context.closePath();
}

function strokeSegment(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  normalX: number,
  normalY: number,
  rim: NativeGlassRimDefinition,
): void {
  const alpha = nativeGlassSpecularAlpha(rim, normalX, normalY);
  if (alpha <= 0.0005 || rim.widthPx <= 0) return;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.lineWidth = rim.widthPx;
  context.lineCap = "round";
  context.strokeStyle = `rgba(255,255,255,${alpha})`;
  context.stroke();
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
