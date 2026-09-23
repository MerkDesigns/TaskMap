// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRetainedCanvasProjection } from "./createRetainedCanvasProjection";
import { createImageInput, IMAGE_TEST_IDS as ids } from "../../elements/image/imageTestFixtures";
import { TEST_IDS, validated } from "../../elements/cardContainerTestFixtures";

describe("image metadata-only projection", () => {
  it("preserves geometry, shell setting, child order and intrinsic dimensions without legacy IDs or URLs", () => {
    const document = validated(createImageInput());
    const original = structuredClone(document);
    const result = createRetainedCanvasProjection().project(document);
    if (!result.ok) throw new Error("Expected projection");
    const image = result.canvases[0].images[0];
    expect(image).toEqual({
      id: ids.image,
      layer: 2,
      x: 50,
      y: 60,
      width: 320,
      height: 240,
      accent: "#abc",
      background: false,
      containerId: TEST_IDS.elementA,
      order: 4,
      naturalWidth: 640,
      naturalHeight: 480,
      media: document.mediaReferences[TEST_IDS.media],
    });
    expect(image.media).toBe(result.mediaReferences[0]);
    expect(Object.isFrozen(image)).toBe(true);
    expect(Object.isFrozen(image.media)).toBe(true);
    expect(Object.isFrozen(result.mediaReferences)).toBe(true);
    expect(document).toEqual(original);
    expect(image).not.toHaveProperty("imageId");
    expect(image).not.toHaveProperty("format");
    expect(image).not.toHaveProperty("url");
  });
  it("preserves empty root placeholders separately from missing references", () => {
    const input = createImageInput();
    input.elements[ids.image].data.mediaId = null;
    input.elements[ids.image].data.placement = null;
    input.mediaReferences = {};
    const result = createRetainedCanvasProjection().project(validated(input));
    if (!result.ok) throw new Error("Expected projection");
    const image = result.canvases[0].images[0];
    expect(image.media).toBeNull();
    expect(image).not.toHaveProperty("naturalWidth");
    expect(image).not.toHaveProperty("containerId");
  });
  it("rejects a missing media reference rather than turning an image into an empty placeholder", () => {
    const input = createImageInput();
    input.mediaReferences = {};
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "missing-image-media", elementId: ids.image }],
    });
  });
  it("validates unused metadata too, with no silent discard or sensitive error text", () => {
    const input = createImageInput();
    input.mediaReferences[ids.secondMedia] = {
      ...input.mediaReferences[TEST_IDS.media],
      id: ids.secondMedia,
      mimeType: "secret/unsupported",
      altText: "Secret title",
    };
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "invalid-image-media", mediaId: ids.secondMedia }],
    });
  });
  it("retains unused valid media references and unknown intrinsic sizes without guessing", () => {
    const input = createImageInput();
    input.mediaReferences[TEST_IDS.media].pixelWidth = null;
    input.mediaReferences[TEST_IDS.media].pixelHeight = null;
    input.mediaReferences[ids.secondMedia] = {
      ...input.mediaReferences[TEST_IDS.media],
      id: ids.secondMedia,
    };
    const result = createRetainedCanvasProjection().project(validated(input));
    if (!result.ok) throw new Error("Expected projection");
    expect(result.mediaReferences).toHaveLength(2);
    expect(result.canvases[0].images[0]).not.toHaveProperty("naturalWidth");
    expect(result.canvases[0].images[0].width).toBe(320);
  });
  it("shares one child-order namespace across images and cards", () => {
    const input = createImageInput();
    input.elements[ids.image].data.placement = { containerId: TEST_IDS.elementA, order: 3 };
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "duplicate-child-order", elementId: ids.image }],
    });
  });
  it.each(["image", "text-card"])("rejects a %s as an image parent", (kind) => {
    const input = createImageInput();
    input.elements[ids.image].data.placement = {
      containerId: kind === "image" ? ids.image : TEST_IDS.elementB,
      order: 0,
    };
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "invalid-container-parent", elementId: ids.image }],
    });
  });
  it("rejects cross-canvas image parents even if their IDs exist", () => {
    const input = createImageInput();
    input.elements[ids.image].canvasId = TEST_IDS.canvasB;
    input.canvases[TEST_IDS.canvasA].elementOrder = [TEST_IDS.elementA, TEST_IDS.elementB];
    input.canvasOrder.push(TEST_IDS.canvasB);
    input.canvases[TEST_IDS.canvasB] = {
      id: TEST_IDS.canvasB,
      name: "Other",
      settings: { width: 1000, height: 1000 },
      elementOrder: [ids.image],
    };
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "invalid-container-parent", elementId: ids.image }],
    });
  });
  it("supports image endpoints, including empty placeholders, without fetching bytes", () => {
    const input = createImageInput();
    input.elements[ids.image].data.mediaId = null;
    input.connections[TEST_IDS.connection] = {
      id: TEST_IDS.connection,
      canvasId: TEST_IDS.canvasA,
      type: "mind-map",
      source: { elementId: ids.image, portId: "right" },
      target: { elementId: TEST_IDS.elementA, portId: "left" },
      data: {},
    };
    const result = createRetainedCanvasProjection().project(validated(input));
    expect(result.ok).toBe(true);
  });
});
