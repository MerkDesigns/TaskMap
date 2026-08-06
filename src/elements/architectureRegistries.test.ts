import { describe, expect, it } from "vitest";
import {
  findArchitectureExtensionDefinition,
  getArchitectureExtensionDefinitions,
} from "../extensions/architectureRegistry";
import { findElementDefinition, getElementDefinitions } from "./registry";

describe("architecture registries", () => {
  it("load as explicit, empty registries without registration side effects", () => {
    const elements = getElementDefinitions();
    const extensions = getArchitectureExtensionDefinitions();

    expect(elements).toEqual([]);
    expect(extensions).toEqual([]);
    expect(Object.isFrozen(elements)).toBe(true);
    expect(Object.isFrozen(extensions)).toBe(true);
    expect(findElementDefinition("not-registered")).toBeUndefined();
    expect(findArchitectureExtensionDefinition("not-registered")).toBeUndefined();
  });
});
