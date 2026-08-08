export const COMPOSITOR_INVALIDATION = Object.freeze({
  BACKDROP_SCENE_DIRTY: "BACKDROP_SCENE_DIRTY",
  VIEWPORT_TRANSFORM_DIRTY: "VIEWPORT_TRANSFORM_DIRTY",
  SURFACE_GEOMETRY_DIRTY: "SURFACE_GEOMETRY_DIRTY",
  MATERIAL_OVERLAY_DIRTY: "MATERIAL_OVERLAY_DIRTY",
  SHARED_BLUR_PARAMETERS_DIRTY: "SHARED_BLUR_PARAMETERS_DIRTY",
  // Explicit output-buffer resize work for B2.
  OUTPUT_SIZE_DIRTY: "OUTPUT_SIZE_DIRTY",
} as const);

export type CompositorInvalidation =
  (typeof COMPOSITOR_INVALIDATION)[keyof typeof COMPOSITOR_INVALIDATION];

export interface InvalidationConsequences {
  readonly expensiveCacheBuild: boolean;
  readonly cheapCompose: boolean;
  readonly surfaceMaskWork: boolean;
  readonly overlayWork: boolean;
  readonly outputResize: boolean;
}

const NONE: InvalidationConsequences = Object.freeze({
  expensiveCacheBuild: false,
  cheapCompose: false,
  surfaceMaskWork: false,
  overlayWork: false,
  outputResize: false,
});

const CONSEQUENCES: Readonly<Record<CompositorInvalidation, InvalidationConsequences>> =
  Object.freeze({
    BACKDROP_SCENE_DIRTY: consequence({ expensiveCacheBuild: true }),
    VIEWPORT_TRANSFORM_DIRTY: consequence({ cheapCompose: true }),
    SURFACE_GEOMETRY_DIRTY: consequence({ cheapCompose: true, surfaceMaskWork: true }),
    MATERIAL_OVERLAY_DIRTY: consequence({ overlayWork: true }),
    SHARED_BLUR_PARAMETERS_DIRTY: consequence({ expensiveCacheBuild: true }),
    OUTPUT_SIZE_DIRTY: consequence({
      expensiveCacheBuild: true,
      cheapCompose: true,
      surfaceMaskWork: true,
      outputResize: true,
    }),
  });

export function classifyInvalidation(
  invalidation: CompositorInvalidation,
): InvalidationConsequences {
  return CONSEQUENCES[invalidation];
}

export function combineInvalidations(
  invalidations: Iterable<CompositorInvalidation>,
): InvalidationConsequences {
  let combined = NONE;
  for (const invalidation of invalidations) {
    const next = classifyInvalidation(invalidation);
    combined = consequence({
      expensiveCacheBuild: combined.expensiveCacheBuild || next.expensiveCacheBuild,
      cheapCompose: combined.cheapCompose || next.cheapCompose,
      surfaceMaskWork: combined.surfaceMaskWork || next.surfaceMaskWork,
      overlayWork: combined.overlayWork || next.overlayWork,
      outputResize: combined.outputResize || next.outputResize,
    });
  }
  return combined;
}

function consequence(values: Partial<InvalidationConsequences>): InvalidationConsequences {
  return Object.freeze({ ...NONE, ...values });
}
