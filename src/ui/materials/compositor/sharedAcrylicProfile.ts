import { SHARED_ACRYLIC_CACHE_PROFILE } from "../materialDefinitions";

export const SHARED_ACRYLIC_PROFILE_REVISION = 1;

export interface SharedAcrylicRuntimeProfile {
  readonly id: "shared-acrylic";
  readonly revision: number;
  readonly blurRadiusCssPx: number;
  readonly saturation: number;
  readonly brightness: number;
}

export const SHARED_ACRYLIC_RUNTIME_PROFILE: SharedAcrylicRuntimeProfile = Object.freeze({
  id: SHARED_ACRYLIC_CACHE_PROFILE.id,
  revision: SHARED_ACRYLIC_PROFILE_REVISION,
  blurRadiusCssPx: SHARED_ACRYLIC_CACHE_PROFILE.blurRadiusPx,
  saturation: SHARED_ACRYLIC_CACHE_PROFILE.saturation,
  brightness: SHARED_ACRYLIC_CACHE_PROFILE.brightness,
});

export interface SharedAcrylicFilter {
  readonly logicalBlurRadiusCssPx: number;
  readonly backingBlurRadiusPx: number;
  readonly saturation: number;
  readonly brightness: number;
  readonly canvasFilter: string;
}

export function sharedAcrylicFilter(cacheScale: number): SharedAcrylicFilter {
  if (!Number.isFinite(cacheScale) || cacheScale <= 0) {
    throw new RangeError("cacheScale must be a positive finite number");
  }
  const backingBlurRadiusPx = SHARED_ACRYLIC_RUNTIME_PROFILE.blurRadiusCssPx * cacheScale;
  return Object.freeze({
    logicalBlurRadiusCssPx: SHARED_ACRYLIC_RUNTIME_PROFILE.blurRadiusCssPx,
    backingBlurRadiusPx,
    saturation: SHARED_ACRYLIC_RUNTIME_PROFILE.saturation,
    brightness: SHARED_ACRYLIC_RUNTIME_PROFILE.brightness,
    canvasFilter: `blur(${backingBlurRadiusPx}px) saturate(${SHARED_ACRYLIC_RUNTIME_PROFILE.saturation}) brightness(${SHARED_ACRYLIC_RUNTIME_PROFILE.brightness})`,
  });
}

export function isSharedAcrylicRuntimeProfile(
  value: unknown,
): value is SharedAcrylicRuntimeProfile {
  if (typeof value !== "object" || value === null) return false;
  const profile = value as Record<string, unknown>;
  return (
    profile.id === SHARED_ACRYLIC_RUNTIME_PROFILE.id &&
    profile.revision === SHARED_ACRYLIC_RUNTIME_PROFILE.revision &&
    profile.blurRadiusCssPx === SHARED_ACRYLIC_RUNTIME_PROFILE.blurRadiusCssPx &&
    profile.saturation === SHARED_ACRYLIC_RUNTIME_PROFILE.saturation &&
    profile.brightness === SHARED_ACRYLIC_RUNTIME_PROFILE.brightness
  );
}
