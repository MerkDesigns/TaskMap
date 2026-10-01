export interface HalftoneSettings {
  /** Opacity of the whole layer, dots and haze together. */
  readonly opacity: number;
  /** CSS pixels between dot centres. */
  readonly cellSize: number;
  /** Largest dot radius as a fraction of the cell size. */
  readonly maxDotSize: number;
  /** Smallest dot radius in CSS pixels; above zero, quiet areas keep a faint texture. */
  readonly minDotSize: number;
  /** Noise features per CSS pixel; lower values give larger, broader flows. */
  readonly noiseScale: number;
  /** How far the second noise field pushes the pattern around; 0 disables the flowing curls. */
  readonly warp: number;
  /** Noise time units per second. */
  readonly speed: number;
  /** Noise values mapped to the smallest and largest dots; a narrower range adds contrast. */
  readonly rangeLow: number;
  readonly rangeHigh: number;
  /** Opacity of the smallest dots; the largest are fully opaque. */
  readonly minOpacity: number;
  /** Saturation and brightness boost applied to the accent so the dots read as lit pixels. */
  readonly vibrance: number;
  readonly brightness: number;
  /**
   * How strongly a dot's height in the noise field picks its colour: low dots shift towards the
   * shadow colour, high dots ("exposed" hills) towards the highlight colour; 0 keeps the accent.
   */
  readonly heatAmount: number;
  /** Exponent on the height before colouring; above 1 keeps highlights to the highest peaks. */
  readonly heatCurve: number;
  readonly shadowColor: string;
  readonly highlightColor: string;
  /** Grayscale noise drawn under the dots. */
  readonly hazeEnabled: boolean;
  readonly hazeOpacity: number;
  /** Haze noise features per CSS pixel. */
  readonly hazeScale: number;
  /** Haze speed relative to the dot field. */
  readonly hazeSpeed: number;
  readonly hazeContrast: number;
  /** Raises the field around the pointer and along its fading trail. */
  readonly pointerEnabled: boolean;
  /** Reach of the pointer's influence in CSS pixels. */
  readonly pointerRadius: number;
  /** How much the pointer raises the field at its centre (the field spans 0–1). */
  readonly pointerStrength: number;
  /** Extra dot size under the pointer, as a multiple of the normal size; lets dots exceed the max. */
  readonly pointerGrowth: number;
  /** Seconds the trail takes to fade out. */
  readonly trailDuration: number;
  /** How much travelling waves replace the plain noise field (0 = noise only, 1 = waves only). */
  readonly waveAmount: number;
  /** Direction the wave fronts travel, in degrees (0 = left to right, 90 = bottom to top). */
  readonly waveAngle: number;
  /** Distance between wave crests in CSS pixels. */
  readonly waveLength: number;
  /** Wave crests passing a point per second. */
  readonly waveSpeed: number;
  /** How much the flow noise bends the wave fronts; 0 gives straight stripes. */
  readonly waveBend: number;
}

export const DEFAULT_HALFTONE_SETTINGS: HalftoneSettings = Object.freeze({
  opacity: 1,
  cellSize: 9,
  maxDotSize: 0.2,
  minDotSize: 0,
  noiseScale: 0.0018,
  warp: 2.25,
  speed: 0.135,
  rangeLow: 0.48,
  rangeHigh: 0.81,
  minOpacity: 0,
  vibrance: 1,
  brightness: 1,
  heatAmount: 1,
  heatCurve: 2.35,
  shadowColor: "#ff4d4d",
  highlightColor: "#fe9258",
  hazeEnabled: false,
  hazeOpacity: 0.04,
  hazeScale: 0.0017,
  hazeSpeed: 2,
  hazeContrast: 4,
  pointerEnabled: false,
  pointerRadius: 165,
  pointerStrength: 0.44,
  pointerGrowth: 1.15,
  trailDuration: 0,
  waveAmount: 0.4,
  waveAngle: 45,
  waveLength: 470,
  waveSpeed: 0.2,
  waveBend: 1.13,
});

// Live settings: production only ever uses the defaults; the development tuner replaces them.
let currentSettings = DEFAULT_HALFTONE_SETTINGS;
const settingsListeners = new Set<() => void>();

export function getHalftoneSettings() {
  return currentSettings;
}

export function subscribeHalftoneSettings(listener: () => void) {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

export function setHalftoneSettings(settings: HalftoneSettings) {
  currentSettings = settings;
  settingsListeners.forEach((listener) => listener());
}
