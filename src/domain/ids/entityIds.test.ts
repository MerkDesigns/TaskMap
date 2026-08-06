// @vitest-environment node

import { describe, expect, it } from "vitest";
import { asEntityId, createEntityId, isEntityId } from "./entityIds";

describe("branded entity IDs", () => {
  it("validates canonical prefixed UUIDs, opaque media IDs, and stable extension IDs", () => {
    expect(isEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isEntityId("canvas", "canvas-not-valid")).toBe(false);
    expect(isEntityId("database", "DATABASE-00000000-0000-4000-8000-000000000001")).toBe(false);
    expect(isEntityId("media", "abcdefghijklmnopqrstuvwx")).toBe(true);
    expect(isEntityId("media", "original-photo.png")).toBe(false);
    expect(isEntityId("extension", "color-picker.v1")).toBe(true);
  });

  it("creates IDs only through an injected UUID source", () => {
    const id = createEntityId("element", {
      nextUuid: () => "00000000-0000-4000-8000-000000000001",
    });
    expect(id).toBe("element-00000000-0000-4000-8000-000000000001");
    expect(() =>
      createEntityId("element", {
        nextUuid: () => "not-a-uuid",
      }),
    ).toThrow("invalid format");
    expect(() => asEntityId("media", "C:\\private\\photo.png")).toThrow("invalid format");
  });
});
