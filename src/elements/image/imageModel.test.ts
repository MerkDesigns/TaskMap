// @vitest-environment node
import { describe, expect, it } from "vitest";
import { imageDataSchema, imageElementSchema, imageMediaReferenceSchema } from "./imageModel";
import { createImageInput, IMAGE_TEST_IDS as ids } from "./imageTestFixtures";
import { TEST_IDS } from "../cardContainerTestFixtures";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";

describe("image payload and metadata contracts", () => {
  it("accepts explicit opaque references, empty placeholders and root placement", () => {
    const element = createImageInput().elements[ids.image];
    expect(imageElementSchema.parse(element)).toEqual(element);
    expect(
      imageDataSchema.parse({ mediaId: null, accent: "red", background: true, placement: null }),
    ).toEqual({
      mediaId: null,
      accent: "red",
      background: true,
      placement: null,
    });
  });
  it.each(["imageId", "format", "naturalWidth", "bytes", "url", "path", "extensions"])(
    "rejects legacy/duplicate field %s",
    (field) => {
      const data = createImageInput().elements[ids.image].data;
      expect(imageDataSchema.safeParse({ ...data, [field]: "secret" }).success).toBe(false);
    },
  );
  it.each(["mediaId", "background", "placement", "accent"])("requires explicit %s", (field) => {
    const data = { ...createImageInput().elements[ids.image].data };
    delete data[field];
    expect(imageDataSchema.safeParse(data).success).toBe(false);
  });
  it("rejects hashes, URLs and paths as media IDs without conversion", () => {
    const data = createImageInput().elements[ids.image].data;
    for (const mediaId of ["a".repeat(64), "C:\\image.webp", "https://example.com/a.gif"]) {
      expect(imageDataSchema.safeParse({ ...data, mediaId }).success).toBe(false);
    }
  });
  it("enforces shared placement, accent and geometry limits", () => {
    const element = createImageInput().elements[ids.image];
    expect(
      imageElementSchema.safeParse({ ...element, geometry: { ...element.geometry, width: 0 } })
        .success,
    ).toBe(false);
    for (const order of [-1, 0.5, DOCUMENT_LIMITS.elementCount]) {
      expect(
        imageDataSchema.safeParse({
          ...element.data,
          placement: { containerId: TEST_IDS.elementA, order },
        }).success,
      ).toBe(false);
    }
    for (const accent of ["", "x".repeat(DOCUMENT_LIMITS.jsonStringLength + 1)]) {
      expect(imageDataSchema.safeParse({ ...element.data, accent }).success).toBe(false);
    }
  });
  it.each(["image/webp", "image/gif", "image/svg+xml"])(
    "accepts stored %s metadata without byte decoding",
    (mimeType) => {
      const media = createImageInput().mediaReferences[TEST_IDS.media];
      expect(imageMediaReferenceSchema.parse({ ...media, mimeType }).mimeType).toBe(mimeType);
    },
  );
  it.each(["text/plain", "image/unknown", "image/png", "IMAGE/GIF"])(
    "fails explicitly for unsupported stored representation %s",
    (mimeType) => {
      const media = createImageInput().mediaReferences[TEST_IDS.media];
      expect(imageMediaReferenceSchema.safeParse({ ...media, mimeType }).success).toBe(false);
    },
  );
  it("permits paired unknown intrinsic dimensions, not one missing dimension or empty media", () => {
    const media = createImageInput().mediaReferences[TEST_IDS.media];
    expect(
      imageMediaReferenceSchema.safeParse({ ...media, pixelWidth: null, pixelHeight: null })
        .success,
    ).toBe(true);
    expect(imageMediaReferenceSchema.safeParse({ ...media, pixelWidth: null }).success).toBe(false);
    expect(imageMediaReferenceSchema.safeParse({ ...media, byteLength: 0 }).success).toBe(false);
    expect(imageMediaReferenceSchema.safeParse({ ...media, filename: "secret.gif" }).success).toBe(
      false,
    );
  });
});
