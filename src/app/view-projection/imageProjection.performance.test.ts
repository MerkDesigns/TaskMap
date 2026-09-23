// @vitest-environment node
import { produce } from "immer";
import { describe, expect, it, vi } from "vitest";
import { createRetainedCanvasProjection } from "./createRetainedCanvasProjection";
import { createImageInput, IMAGE_TEST_IDS as ids } from "../../elements/image/imageTestFixtures";
import { imageElementSchema, imageMediaReferenceSchema } from "../../elements/image/imageModel";
import { TEST_IDS, validated } from "../../elements/cardContainerTestFixtures";
import type { RetainedCanvasProjectionResult } from "./retainedCanvasProjectionTypes";
import { createCanvasInteractionController } from "../interactions/canvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";

function view(result: RetainedCanvasProjectionResult) {
  if (!result.ok) throw new Error("Expected projection");
  return result;
}

describe("image projection cache dependencies", () => {
  it("reuses image and media projections across actual camera frames with no parsing or serialization", () => {
    const document = validated(createImageInput());
    const projection = createRetainedCanvasProjection();
    const first = projection.project(document);
    const controller = createCanvasInteractionController({
      canvasKey: TEST_IDS.canvasA,
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
      commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder: vi.fn() },
    });
    const spies = [
      vi.spyOn(imageElementSchema, "parse"),
      vi.spyOn(imageMediaReferenceSchema, "safeParse"),
      vi.spyOn(JSON, "stringify"),
    ];
    try {
      controller.beginPan(1, { x: 0, y: 0 });
      for (let frame = 1; frame <= 100; frame++) {
        controller.updatePointer({ pointerId: 1, screen: { x: frame, y: frame }, snapping: false });
        expect(projection.project(document)).toBe(first);
      }
      controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
      for (let frame = 0; frame < 100; frame++) {
        controller.wheelZoom({ x: 500, y: 400 }, -1);
        expect(projection.project(document)).toBe(first);
      }
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      controller.dispose();
      projection.clear();
    }
  });

  it("reuses shared media metadata on geometry-only edits and across image instances", () => {
    const input = createImageInput();
    input.elements[ids.secondImage] = {
      ...input.elements[ids.image],
      id: ids.secondImage,
      data: { ...input.elements[ids.image].data, placement: null },
    };
    input.canvases[TEST_IDS.canvasA].elementOrder.push(ids.secondImage);
    const document = validated(input);
    const projection = createRetainedCanvasProjection();
    const first = view(projection.project(document));
    const changed = produce(document, (draft) => {
      draft.elements[ids.image].geometry.x += 1;
    });
    const parse = vi.spyOn(imageMediaReferenceSchema, "safeParse");
    try {
      const after = view(projection.project(changed));
      expect(after.mediaReferences).toBe(first.mediaReferences);
      expect(after.canvases[0].images[1]).toBe(first.canvases[0].images[1]);
      expect(after.canvases[0].images[0].media).toBe(after.canvases[0].images[1].media);
      expect(parse).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("invalidates the image when only its referenced metadata changes", () => {
    const document = validated(createImageInput());
    const projection = createRetainedCanvasProjection();
    const before = view(projection.project(document));
    const changed = produce(document, (draft) => {
      draft.mediaReferences[TEST_IDS.media].pixelWidth = 800;
      draft.mediaReferences[TEST_IDS.media].altText = "Changed";
    });
    expect(changed.elements).toBe(document.elements);
    const after = view(projection.project(changed));
    expect(after.canvases[0].images[0].naturalWidth).toBe(800);
    expect(after.canvases[0].images[0].media?.altText).toBe("Changed");
    expect(after.canvases[0].images[0]).not.toBe(before.canvases[0].images[0]);
    expect(after.canvases[0].textCards[0]).toBe(before.canvases[0].textCards[0]);
  });

  it("keeps image identity when only unrelated metadata changes", () => {
    const input = createImageInput();
    input.mediaReferences[ids.secondMedia] = {
      ...input.mediaReferences[TEST_IDS.media],
      id: ids.secondMedia,
    };
    const document = validated(input);
    const projection = createRetainedCanvasProjection();
    const before = view(projection.project(document));
    const changed = produce(document, (draft) => {
      draft.mediaReferences[ids.secondMedia].altText = "Other";
    });
    const after = view(projection.project(changed));
    expect(after.canvases[0].images[0]).toBe(before.canvases[0].images[0]);
  });

  it.each(["remove", "unsupported"])(
    "does not reuse a stale image after referenced media becomes %s",
    (kind) => {
      const document = validated(createImageInput());
      const projection = createRetainedCanvasProjection();
      projection.project(document);
      const changed = produce(document, (draft) => {
        if (kind === "remove") delete draft.mediaReferences[TEST_IDS.media];
        else draft.mediaReferences[TEST_IDS.media].mimeType = "text/plain";
      });
      const after = projection.project(changed);
      expect(after.ok).toBe(false);
      if (after.ok) throw new Error("Expected failure");
      expect(after.issues).toContainEqual({ code: "missing-image-media", elementId: ids.image });
      expect(projection.project(document).ok).toBe(true);
    },
  );

  it("clears image and shared media caches together", () => {
    const document = validated(createImageInput());
    const projection = createRetainedCanvasProjection();
    const before = view(projection.project(document));
    projection.clear();
    const after = view(projection.project(document));
    expect(after).toEqual(before);
    expect(after.mediaReferences[0]).not.toBe(before.mediaReferences[0]);
    expect(after.canvases[0].images[0]).not.toBe(before.canvases[0].images[0]);
  });
});
