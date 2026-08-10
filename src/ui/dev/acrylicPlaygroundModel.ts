import type {
  CanvasPoint,
  CanvasRectangle,
  CanvasSize,
} from "../../canvas/geometry/canvasGeometry";
import { createViewport } from "../../canvas/geometry/viewportMath";
import type { BackdropPrimitive, BackdropScene } from "../materials/compositor/backdropScene";
import { parseBackdropScene } from "../materials/compositor/backdropSceneValidation";
import type { MaterialBackdropPresentation } from "../materials/materialCompositorPresentation";
import type { MaterialId } from "../materials/materialTypes";

export const PLAYGROUND_SCENE_KEY = "ui-lab-acrylic-playground";
export const PLAYGROUND_SCENE_REVISION = 1;
export const PLAYGROUND_WORLD_BOUNDS = Object.freeze({ x: 0, y: 0, width: 1200, height: 800 });
export const PLAYGROUND_MIN_ZOOM = 0.35;
export const PLAYGROUND_MAX_ZOOM = 2;

export interface AcrylicPlaygroundView {
  readonly pan: CanvasPoint;
  readonly zoom: number;
}

export type AcrylicPlaygroundSurfacePresetId =
  "large-panel" | "small-card" | "compact-card" | "liquid-selection" | "cutout";

export interface AcrylicPlaygroundSurfacePreset {
  readonly id: AcrylicPlaygroundSurfacePresetId;
  readonly label: string;
  readonly material: MaterialId;
  readonly radius: number;
  readonly className: string;
  readonly note?: string;
}

export const ACRYLIC_PLAYGROUND_SURFACE_PRESETS = Object.freeze([
  preset("large-panel", "Acrylic Large Panel", "acrylic-large", 12, "large"),
  preset("small-card", "Acrylic Small Card", "acrylic-small", 10, "small"),
  preset("compact-card", "Compact Acrylic Card", "acrylic-small", 7, "compact"),
  preset("liquid-selection", "Liquid Selection Surface", "acrylic-small", 7, "liquid"),
  preset("cutout", "Cutout", "cutout", 6, "cutout", "Cutout does not blur."),
] satisfies readonly AcrylicPlaygroundSurfacePreset[]);

export const ACRYLIC_PLAYGROUND_SCENE = createAcrylicPlaygroundScene();

export function findAcrylicPlaygroundSurfacePreset(
  id: AcrylicPlaygroundSurfacePresetId,
): AcrylicPlaygroundSurfacePreset {
  const presetDefinition = ACRYLIC_PLAYGROUND_SURFACE_PRESETS.find((item) => item.id === id);
  if (!presetDefinition) throw new RangeError(`Unknown acrylic playground preset: ${id}`);
  return presetDefinition;
}

export function resetAcrylicPlaygroundView(screen: CanvasSize): AcrylicPlaygroundView {
  const zoom = Math.min(0.72, screen.width / 980, screen.height / 620);
  return Object.freeze({
    zoom,
    pan: Object.freeze({
      x: (screen.width - PLAYGROUND_WORLD_BOUNDS.width * zoom) / 2,
      y: (screen.height - PLAYGROUND_WORLD_BOUNDS.height * zoom) / 2,
    }),
  });
}

export function panAcrylicPlaygroundView(
  view: AcrylicPlaygroundView,
  delta: CanvasPoint,
): AcrylicPlaygroundView {
  return Object.freeze({
    ...view,
    pan: Object.freeze({ x: view.pan.x + delta.x, y: view.pan.y + delta.y }),
  });
}

export function zoomAcrylicPlaygroundView(
  view: AcrylicPlaygroundView,
  anchor: CanvasPoint,
  deltaY: number,
): AcrylicPlaygroundView {
  const requested = view.zoom * Math.exp(-deltaY * 0.0015);
  const zoom = Math.min(PLAYGROUND_MAX_ZOOM, Math.max(PLAYGROUND_MIN_ZOOM, requested));
  const worldAnchor = {
    x: (anchor.x - view.pan.x) / view.zoom,
    y: (anchor.y - view.pan.y) / view.zoom,
  };
  return Object.freeze({
    zoom,
    pan: Object.freeze({
      x: anchor.x - worldAnchor.x * zoom,
      y: anchor.y - worldAnchor.y * zoom,
    }),
  });
}

export function createAcrylicPlaygroundPresentation(input: {
  readonly scene: BackdropScene;
  readonly view: AcrylicPlaygroundView;
  readonly hostBounds: CanvasRectangle;
  readonly windowSize: CanvasSize;
  readonly interactionActive: boolean;
}): MaterialBackdropPresentation {
  return Object.freeze({
    sceneKey: input.scene.identity.key,
    sceneRevision: input.scene.identity.revision,
    viewport: createViewport(
      {
        x: input.hostBounds.x + input.view.pan.x,
        y: input.hostBounds.y + input.view.pan.y,
      },
      input.view.zoom,
      input.windowSize,
    ),
    interactionActive: input.interactionActive,
    buildScene: () => input.scene,
  });
}

function createAcrylicPlaygroundScene(): BackdropScene {
  const primitives: BackdropPrimitive[] = [];
  for (let x = 80; x < 1200; x += 120) {
    primitives.push(rectangle(x, 0, x % 240 === 80 ? 2 : 1, 800, "#b9c7d91f"));
  }
  for (let y = 70; y < 800; y += 90) {
    primitives.push(rectangle(0, y, 1200, y % 180 === 70 ? 2 : 1, "#f4f7ff20"));
  }
  primitives.push(
    rounded(92, 96, 300, 178, 26, "#e36b55", "#ffd2ad", 2),
    rounded(310, 188, 330, 205, 18, "#182b42", "#73b7ff", 1),
    rounded(690, 74, 350, 154, 32, "#137b78", "#7fe4dd", 2),
    rectangle(760, 178, 265, 214, "#e7edf2", "#111317", 1),
    rounded(118, 438, 430, 212, 12, "#22252c", "#ffffff", 2),
    rounded(488, 512, 430, 176, 40, "#5b6473", "#d8e0eb", 1),
    rectangle(930, 420, 18, 220, "#e36b55"),
    rectangle(964, 420, 2, 220, "#ffffff"),
    rectangle(990, 420, 1, 220, "#0a0b0d"),
    rectangle(1040, 468, 92, 32, "#55a7e8", "#eaf6ff", 1),
    rectangle(1008, 526, 128, 18, "#44c3b8", "#081312", 2),
    rectangle(1024, 576, 72, 72, "#f3f5f7", "#0a0b0c", 1),
    rounded(42, 312, 145, 86, 18, "#eef2f6", "#1a1d22", 1),
    rectangle(166, 338, 198, 46, "#0b0c0e", "#ffffff", 2),
  );
  return parseBackdropScene({
    identity: { key: PLAYGROUND_SCENE_KEY, revision: PLAYGROUND_SCENE_REVISION },
    worldBounds: PLAYGROUND_WORLD_BOUNDS,
    background: { cacheFill: "#08090b", worldFill: "#101318", worldCornerRadius: 20 },
    grid: {
      kind: "dots",
      spacingWorld: 32,
      offsetWorld: { x: 0, y: 0 },
      color: "#8291a640",
      radiusWorld: 1.25,
    },
    primitives,
  });
}

function preset(
  id: AcrylicPlaygroundSurfacePresetId,
  label: string,
  material: MaterialId,
  radius: number,
  className: string,
  note?: string,
): AcrylicPlaygroundSurfacePreset {
  return Object.freeze({ id, label, material, radius, className, note });
}

function rectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  strokeColor?: string,
  strokeWidth = 1,
): BackdropPrimitive {
  return Object.freeze({
    kind: "filled-rectangle",
    bounds: Object.freeze({ x, y, width, height }),
    fill,
    stroke: strokeColor ? Object.freeze({ color: strokeColor, widthWorld: strokeWidth }) : null,
  });
}

function rounded(
  x: number,
  y: number,
  width: number,
  height: number,
  radiusWorld: number,
  fill: string,
  strokeColor: string,
  strokeWidth: number,
): BackdropPrimitive {
  return Object.freeze({
    kind: "filled-rounded-rectangle",
    bounds: Object.freeze({ x, y, width, height }),
    radiusWorld,
    fill,
    stroke: Object.freeze({ color: strokeColor, widthWorld: strokeWidth }),
  });
}
