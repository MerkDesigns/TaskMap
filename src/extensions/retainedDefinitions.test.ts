// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getArchitectureExtensionDefinitions } from "./architectureRegistry";
import { DOCUMENT_LIMITS } from "../domain/document/documentLimits";

const definitions = getArchitectureExtensionDefinitions();
const targets: Record<string, readonly string[]> = {
  privacy: ["container", "text-block"],
  lock: ["container", "text-block", "text-card", "mind-map-node", "image"],
  "color-picker": ["container", "text-block", "text-card", "mind-map-node"],
  checkbox: ["text-card"],
  search: ["container"],
  "auto-checkbox": ["container"],
  counter: ["container"],
  "inherit-card-color": ["container"],
  "copy-paste-json": ["container"],
};

describe("retained extension definitions", () => {
  it.each(definitions)(
    "owns strict configuration and explicit compatibility for $id",
    (definition) => {
      expect(definition.compatibleElementTypes).toEqual(targets[definition.id]);
      expect(definition.conflictsWith).toEqual([]);
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.compatibleElementTypes)).toBe(true);
      const defaults = definition.createDefaultState();
      expect(defaults).toEqual(definition.createDefaultState());
      expect(defaults).not.toBe(definition.createDefaultState());
      const parsed = definition.parseConfiguration(defaults);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) throw new Error("Expected valid defaults");
      expect(parsed.configuration).toEqual(defaults);
      expect(parsed.view).toEqual({ [definition.viewKey]: defaults });
      expect(Object.isFrozen(parsed.configuration)).toBe(true);
      expect(Object.isFrozen(parsed.view)).toBe(true);
      for (const bad of [
        null,
        [],
        {},
        { ...parsed.configuration, command: "secret shell" },
        Object.fromEntries(Object.keys(parsed.configuration).map((key) => [key, 1])),
      ]) {
        expect(definition.parseConfiguration(bad)).toEqual({ ok: false });
      }
    },
  );

  it.each(definitions)("preserves explicit false/empty state for $id", (definition) => {
    const configuration =
      definition.id === "search"
        ? { query: "" }
        : definition.id === "checkbox"
          ? { checked: false }
          : { enabled: false };
    expect(definition.parseConfiguration(configuration)).toEqual({
      ok: true,
      configuration,
      view: { [definition.viewKey]: configuration },
    });
  });

  it("preserves search text and bounds its size without trimming", () => {
    const search = definitions.find((definition) => definition.id === "search")!;
    const configuration = { query: "  café\n第二行  " };
    expect(search.parseConfiguration(configuration)).toMatchObject({ ok: true, configuration });
    expect(
      search.parseConfiguration({ query: "a".repeat(DOCUMENT_LIMITS.jsonStringLength) }).ok,
    ).toBe(true);
    expect(
      search.parseConfiguration({ query: "a".repeat(DOCUMENT_LIMITS.jsonStringLength + 1) }).ok,
    ).toBe(false);
  });
});
