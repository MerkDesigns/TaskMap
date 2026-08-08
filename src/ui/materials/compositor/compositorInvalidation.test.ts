// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COMPOSITOR_INVALIDATION,
  classifyInvalidation,
  combineInvalidations,
} from "./compositorInvalidation";

describe("compositor invalidation metadata", () => {
  it("defines every normative semantic category plus explicit output sizing", () => {
    expect(COMPOSITOR_INVALIDATION).toEqual({
      BACKDROP_SCENE_DIRTY: "BACKDROP_SCENE_DIRTY",
      VIEWPORT_TRANSFORM_DIRTY: "VIEWPORT_TRANSFORM_DIRTY",
      SURFACE_GEOMETRY_DIRTY: "SURFACE_GEOMETRY_DIRTY",
      MATERIAL_OVERLAY_DIRTY: "MATERIAL_OVERLAY_DIRTY",
      SHARED_BLUR_PARAMETERS_DIRTY: "SHARED_BLUR_PARAMETERS_DIRTY",
      OUTPUT_SIZE_DIRTY: "OUTPUT_SIZE_DIRTY",
    });
  });

  it("classifies the expensive cache-build categories", () => {
    expect(classifyInvalidation(COMPOSITOR_INVALIDATION.BACKDROP_SCENE_DIRTY)).toMatchObject({
      expensiveCacheBuild: true,
      cheapCompose: false,
    });
    expect(
      classifyInvalidation(COMPOSITOR_INVALIDATION.SHARED_BLUR_PARAMETERS_DIRTY),
    ).toMatchObject({ expensiveCacheBuild: true, cheapCompose: false });
  });

  it("keeps viewport, surface, and overlay consequences independent", () => {
    expect(classifyInvalidation(COMPOSITOR_INVALIDATION.VIEWPORT_TRANSFORM_DIRTY)).toEqual({
      expensiveCacheBuild: false,
      cheapCompose: true,
      surfaceMaskWork: false,
      overlayWork: false,
      outputResize: false,
    });
    expect(classifyInvalidation(COMPOSITOR_INVALIDATION.SURFACE_GEOMETRY_DIRTY)).toMatchObject({
      expensiveCacheBuild: false,
      cheapCompose: true,
      surfaceMaskWork: true,
      overlayWork: false,
    });
    expect(classifyInvalidation(COMPOSITOR_INVALIDATION.MATERIAL_OVERLAY_DIRTY)).toMatchObject({
      expensiveCacheBuild: false,
      cheapCompose: false,
      surfaceMaskWork: false,
      overlayWork: true,
    });
  });

  it("makes output resize explicit instead of smuggling it into another category", () => {
    expect(classifyInvalidation(COMPOSITOR_INVALIDATION.OUTPUT_SIZE_DIRTY)).toEqual({
      expensiveCacheBuild: true,
      cheapCompose: true,
      surfaceMaskWork: true,
      overlayWork: false,
      outputResize: true,
    });
  });

  it("combines independent consequences without introducing extra work", () => {
    expect(
      combineInvalidations([
        COMPOSITOR_INVALIDATION.VIEWPORT_TRANSFORM_DIRTY,
        COMPOSITOR_INVALIDATION.MATERIAL_OVERLAY_DIRTY,
      ]),
    ).toEqual({
      expensiveCacheBuild: false,
      cheapCompose: true,
      surfaceMaskWork: false,
      overlayWork: true,
      outputResize: false,
    });
  });
});
