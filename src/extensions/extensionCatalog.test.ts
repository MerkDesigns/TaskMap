import { describe, expect, it } from "vitest";
import { EXTENSIONS, extensionCatalogEntry, isExtensionCompatible } from "./extensionCatalog";

describe("extension catalog", () => {
  it("lists every registered extension in the panel's order", () => {
    expect(EXTENSIONS.map((extension) => extension.id)).toEqual([
      "privacy",
      "lock",
      "colorPicker",
      "search",
      "checkbox",
      "autoCheckbox",
      "counter",
      "inheritCardColor",
      "copyPasteJson",
      "workflow",
    ]);
    expect(extensionCatalogEntry("copyPasteJson")).toMatchObject({
      label: "Copy/Paste JSON",
      description: "Edit cards with AI",
    });
    expect(extensionCatalogEntry("inheritCardColor").label).toBe("Inherit color");
  });

  it("derives panel targets from each definition's element types", () => {
    expect(isExtensionCompatible("checkbox", "text-card")).toBe(true);
    expect(isExtensionCompatible("checkbox", "text-block")).toBe(false);
    expect(isExtensionCompatible("privacy", "text-block")).toBe(true);
    expect(isExtensionCompatible("copyPasteJson", "container")).toBe(true);
    expect(isExtensionCompatible("copyPasteJson", "text-card")).toBe(false);
    expect(
      EXTENSIONS.filter((extension) => extension.targets.includes("mindmap")).map(
        (extension) => extension.id,
      ),
    ).toEqual(["lock", "colorPicker"]);
    expect(extensionCatalogEntry("lock").targets).toEqual([
      "container",
      "text-block",
      "text-card",
      "mindmap",
      "image",
    ]);
  });
});
