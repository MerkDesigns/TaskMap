import { describe, expect, it } from "vitest";
import {
  findArchitectureExtensionDefinition,
  getArchitectureExtensionDefinitions,
} from "../extensions/architectureRegistry";
import { findElementDefinition, getElementDefinitions } from "./registry";

describe("architecture registries", () => {
  it("loads explicit staged definitions without registration side effects or placeholder controls", () => {
    const elements = getElementDefinitions();
    const extensions = getArchitectureExtensionDefinitions();

    expect(elements).toEqual([]);
    expect(extensions.map((definition) => definition.id)).toEqual([
      "privacy",
      "lock",
      "color-picker",
      "checkbox",
      "search",
      "auto-checkbox",
      "counter",
      "inherit-card-color",
      "copy-paste-json",
    ]);
    expect(extensions.every((definition) => definition.Control === undefined)).toBe(true);
    expect(Object.isFrozen(elements)).toBe(true);
    expect(Object.isFrozen(extensions)).toBe(true);
    expect(findElementDefinition("not-registered")).toBeUndefined();
    expect(findArchitectureExtensionDefinition("not-registered")).toBeUndefined();
  });
});
