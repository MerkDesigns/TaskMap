/** Projects canvas world rectangles into a Canvas Browser card preview. */
export interface CanvasPreviewCamera {
  readonly pan: { readonly x: number; readonly y: number };
  readonly zoom: number;
}

export interface CanvasPreviewProjection {
  readonly left: number;
  readonly top: number;
  readonly scale: number;
}

export function canvasPreviewProjection(
  camera: CanvasPreviewCamera,
  previewWidth: number,
  viewportWidth: number,
): CanvasPreviewProjection {
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  return {
    left: -camera.pan.x / zoom,
    top: -camera.pan.y / zoom,
    scale: previewWidth / (Math.max(1, viewportWidth) / zoom),
  };
}

/** Attribute carrying an item's world rectangle ("x y width height") for live presentation. */
export const PREVIEW_WORLD_ATTRIBUTE = "data-preview-world";
/** Attribute carrying a header's world height for live presentation. */
export const PREVIEW_HEADER_ATTRIBUTE = "data-preview-header";

export function previewItemStyle(
  projection: CanvasPreviewProjection,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return {
    left: (x - projection.left) * projection.scale,
    top: (y - projection.top) * projection.scale,
    width: Math.max(width * projection.scale, 3),
    height: Math.max(height * projection.scale, 3),
  };
}

export const previewHeaderHeight = (projection: CanvasPreviewProjection, height: number) =>
  Math.max(2, height * projection.scale);

/**
 * Camera-frame presentation for the active card: writes positions directly so pan/zoom frames
 * update the preview without rerendering React (AGENTS.md performance rules).
 */
export function presentCanvasPreview(preview: HTMLElement, projection: CanvasPreviewProjection) {
  for (const item of preview.querySelectorAll<HTMLElement>(`[${PREVIEW_WORLD_ATTRIBUTE}]`)) {
    const [x, y, width, height] = (item.getAttribute(PREVIEW_WORLD_ATTRIBUTE) ?? "")
      .split(" ")
      .map(Number);
    const style = previewItemStyle(projection, x, y, width, height);
    item.style.left = `${style.left}px`;
    item.style.top = `${style.top}px`;
    item.style.width = `${style.width}px`;
    item.style.height = `${style.height}px`;
    const header = item.querySelector<HTMLElement>(`[${PREVIEW_HEADER_ATTRIBUTE}]`);
    if (header) {
      const worldHeight = Number(header.getAttribute(PREVIEW_HEADER_ATTRIBUTE));
      header.style.height = `${previewHeaderHeight(projection, worldHeight)}px`;
    }
  }
}
