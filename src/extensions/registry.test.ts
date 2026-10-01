import { describe, expect, it } from "vitest";
import {
  EXTENSIONS,
  EXTENSION_COMPATIBLE_TARGETS,
  EXTENSION_DROP_ICONS,
  EXTENSION_REGISTRY,
  addAutomaticCheckbox,
  isExtensionCompatible,
} from "./registry";

describe("extension registry", () => {
  it("provides metadata, icons, and compatibility for every extension", () => {
    for (const extension of EXTENSIONS) {
      expect(EXTENSION_REGISTRY[extension.id]).toBe(extension);
      expect(EXTENSION_DROP_ICONS[extension.id]).toBe(extension.Icon);
      expect([...EXTENSION_COMPATIBLE_TARGETS[extension.id]]).toEqual(extension.targets);
    }
  });

  it("uses one canonical target vocabulary", () => {
    expect(isExtensionCompatible("checkbox", "text-card")).toBe(true);
    expect(isExtensionCompatible("checkbox", "text-block")).toBe(false);
    expect(isExtensionCompatible("privacy", "text-block")).toBe(true);
    expect(isExtensionCompatible("colorPicker", "text-card")).toBe(true);
    expect(isExtensionCompatible("lock", "mindmap")).toBe(true);
    expect(isExtensionCompatible("colorPicker", "mindmap")).toBe(true);
    expect(isExtensionCompatible("checkbox", "mindmap")).toBe(false);
    expect(
      EXTENSIONS.filter((extension) => extension.targets.includes("mindmap")).map(
        (extension) => extension.id,
      ),
    ).toEqual(["lock", "colorPicker"]);
    expect(isExtensionCompatible("copyPasteJson", "container")).toBe(true);
    expect(isExtensionCompatible("copyPasteJson", "text-card")).toBe(false);
    expect(EXTENSION_REGISTRY.copyPasteJson.description).toBe("Edit cards with AI");
    expect(EXTENSIONS.map((extension) => extension.id)).not.toContain("commandRunner");
  });

  it("adds a default Checkbox and keeps an existing one", () => {
    expect(addAutomaticCheckbox()).toEqual({ checkbox: { checked: false } });
    expect(addAutomaticCheckbox({ checkbox: { checked: true } })).toEqual({
      checkbox: { checked: true },
    });
  });
});
