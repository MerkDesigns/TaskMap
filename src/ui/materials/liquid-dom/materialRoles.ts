export type LiquidMaterialRole = "large-panel" | "small-panel";

export interface LiquidMaterialOptics {
  readonly opacity: number;
  readonly spacing: number;
  readonly blur: number;
  readonly bezelWidth: number;
  readonly thickness: number;
  readonly displacementFactor: number;
  readonly displacementBlur: number;
  readonly ior: number;
  readonly contentIor: number;
  readonly contentDepth: number;
  readonly dispersion: number;
  readonly surfaceProfile: "convex";
  readonly lightDirection: number;
  readonly specularStrength: number;
  readonly specularWidth: number;
  readonly specularFalloff: number;
  readonly oppositeSpecularStrength: number;
  readonly specularSharpness: number;
  readonly specularOpacity: number;
  readonly reflectionOffset: number;
  readonly tint: Readonly<{ r: number; g: number; b: number; a: number }>;
  readonly shadowColor: Readonly<{ r: number; g: number; b: number; a: number }>;
  readonly shadowOffsetX: number;
  readonly shadowOffsetY: number;
  readonly shadowBlur: number;
  readonly shadowSpread: number;
  readonly debugDisplacement: boolean;
}

// Approved TaskMap optical presets. Geometry and layout deliberately do not belong to a role.
export const LIQUID_MATERIAL_OPTICS: Readonly<Record<LiquidMaterialRole, LiquidMaterialOptics>> =
  Object.freeze({
    "large-panel": Object.freeze({
      opacity: 1,
      spacing: 12,
      blur: 55.5,
      bezelWidth: 0,
      thickness: 21,
      displacementFactor: 1,
      displacementBlur: 6,
      ior: 1.5,
      contentIor: 1,
      contentDepth: 0,
      dispersion: 0,
      surfaceProfile: "convex",
      lightDirection: -0.5236,
      specularStrength: 0.81,
      specularWidth: 0.7,
      specularFalloff: 0,
      oppositeSpecularStrength: 0.5,
      specularSharpness: 3,
      specularOpacity: 0.7,
      reflectionOffset: 18,
      tint: Object.freeze({ r: 0.1373, g: 0.1412, b: 0.1412, a: 0.49 }),
      shadowColor: Object.freeze({ r: 0, g: 0, b: 0, a: 0.1 }),
      shadowOffsetX: 0,
      shadowOffsetY: 14,
      shadowBlur: 30,
      shadowSpread: 0,
      debugDisplacement: false,
    }),
    "small-panel": Object.freeze({
      opacity: 1,
      spacing: 12,
      blur: 60,
      bezelWidth: 4.5,
      thickness: 14,
      displacementFactor: 1,
      displacementBlur: 6,
      ior: 1.5,
      contentIor: 1,
      contentDepth: 0,
      dispersion: 0,
      surfaceProfile: "convex",
      lightDirection: -0.5236,
      specularStrength: 0.81,
      specularWidth: 0.7,
      specularFalloff: 0,
      oppositeSpecularStrength: 0.5,
      specularSharpness: 3,
      specularOpacity: 0.7,
      reflectionOffset: 18,
      tint: Object.freeze({ r: 0.1765, g: 0.1804, b: 0.1843, a: 0 }),
      shadowColor: Object.freeze({ r: 0, g: 0, b: 0, a: 0.42 }),
      shadowOffsetX: 0,
      shadowOffsetY: 5,
      shadowBlur: 11,
      shadowSpread: -2,
      debugDisplacement: false,
    }),
  });
