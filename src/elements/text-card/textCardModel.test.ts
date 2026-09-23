// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { textCardDataSchema, textCardElementSchema } from "./textCardModel";
import { createCardContainerInput, TEST_IDS } from "../cardContainerTestFixtures";

describe("current-version text-card schema", () => {
  it("validates its explicit type and full geometry, not only a generic JSON payload", () => {
    const element = createCardContainerInput().elements[TEST_IDS.elementB];
    expect(textCardElementSchema.safeParse(element).success).toBe(true);
    expect(textCardElementSchema.safeParse({ ...element, type: "mindmap" }).success).toBe(false);
    expect(
      textCardElementSchema.safeParse({ ...element, geometry: { ...element.geometry, width: 0 } })
        .success,
    ).toBe(false);
  });

  it.each(["text", "accent", "link"] as const)("bounds %s without silently truncating", (field) => {
    const data = {
      ...createCardContainerInput().elements[TEST_IDS.elementB].data,
      [field]: "a".repeat(DOCUMENT_LIMITS.jsonStringLength + 1),
    };
    expect(textCardDataSchema.safeParse(data).success).toBe(false);
  });

  it("requires explicit nulls and rejects empty accents and out-of-range child orders", () => {
    const data = createCardContainerInput().elements[TEST_IDS.elementB].data;
    const { link: _link, ...withoutLink } = data;
    expect(textCardDataSchema.safeParse(withoutLink).success).toBe(false);
    expect(textCardDataSchema.safeParse({ ...data, accent: "" }).success).toBe(false);
    expect(
      textCardDataSchema.safeParse({
        ...data,
        placement: { containerId: TEST_IDS.elementA, order: DOCUMENT_LIMITS.elementCount },
      }).success,
    ).toBe(false);
  });
});
