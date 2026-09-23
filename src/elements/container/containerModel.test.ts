// @vitest-environment node
import { describe, expect, it } from "vitest";
import { containerDataSchema, containerElementSchema } from "./containerModel";
import { createCardContainerInput, TEST_IDS } from "../cardContainerTestFixtures";

describe("current-version container schema", () => {
  it("accepts empty names, explicit header state and existing color strings unchanged", () => {
    expect(
      containerDataSchema.parse({
        name: "",
        accent: "rgba(1, 2, 3, 0.5)",
        headerButtonsVisible: false,
      }),
    ).toEqual({
      name: "",
      accent: "rgba(1, 2, 3, 0.5)",
      headerButtonsVisible: false,
    });
  });

  it.each([
    { name: "Container", accent: "red" },
    { name: "Container", accent: "", headerButtonsVisible: true },
    { name: "Container", accent: "red", headerButtonsVisible: "true" },
    { name: "Container", accent: "red", headerButtonsVisible: true, childIds: [] },
    { name: "Container", accent: "red", headerButtonsVisible: true, extensions: {} },
  ])("rejects incomplete or redundant data %#", (data) => {
    expect(containerDataSchema.safeParse(data).success).toBe(false);
  });

  it("rejects a different type and unknown envelope fields", () => {
    const element = createCardContainerInput().elements[TEST_IDS.elementA];
    expect(containerElementSchema.safeParse(element).success).toBe(true);
    expect(containerElementSchema.safeParse({ ...element, type: "text-card" }).success).toBe(false);
    expect(containerElementSchema.safeParse({ ...element, children: [] }).success).toBe(false);
  });
});
