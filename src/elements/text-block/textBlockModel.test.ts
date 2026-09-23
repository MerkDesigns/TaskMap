// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { textBlockDataSchema, textBlockElementSchema } from "./textBlockModel";

const data = { name: "", text: "# Heading\n第二行", accent: "red", headerButtonsVisible: false };

describe("typed text-block payload", () => {
  it("preserves empty/Unicode/Markdown fields and explicit header state", () => {
    expect(textBlockDataSchema.parse(data)).toEqual(data);
    expect(textBlockDataSchema.parse({ ...data, text: "" }).text).toBe("");
  });
  it.each(["name", "text", "accent", "headerButtonsVisible"])("requires %s explicitly", (field) => {
    const missing = { ...data } as Record<string, unknown>;
    delete missing[field];
    expect(textBlockDataSchema.safeParse(missing).success).toBe(false);
  });
  it.each(["name", "text", "accent"])("bounds %s without trimming", (field) => {
    expect(
      textBlockDataSchema.safeParse({
        ...data,
        [field]: "x".repeat(DOCUMENT_LIMITS.jsonStringLength + 1),
      }).success,
    ).toBe(false);
  });
  it("rejects unknown fields, coercion and embedded legacy extensions", () => {
    expect(textBlockDataSchema.safeParse({ ...data, headerButtonsVisible: "false" }).success).toBe(
      false,
    );
    expect(textBlockDataSchema.safeParse({ ...data, extensions: {} }).success).toBe(false);
    expect(textBlockDataSchema.safeParse({ ...data, placement: null }).success).toBe(false);
    expect(textBlockDataSchema.safeParse({ ...data, accent: "" }).success).toBe(false);
  });
  it("retains strict envelope geometry and type checks", () => {
    const element = {
      id: "element-00000000-0000-4000-8000-000000000001",
      canvasId: "canvas-00000000-0000-4000-8000-000000000001",
      type: "text-block",
      geometry: { x: 0, y: 0, width: 400, height: 300 },
      data,
    };
    expect(textBlockElementSchema.safeParse(element).success).toBe(true);
    expect(textBlockElementSchema.safeParse({ ...element, type: "container" }).success).toBe(false);
    expect(
      textBlockElementSchema.safeParse({ ...element, geometry: { ...element.geometry, height: 0 } })
        .success,
    ).toBe(false);
  });
});
