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
  workflow: ["text-card"],
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
          : definition.id === "workflow"
            ? { lines: [] }
            : { enabled: false };
    expect(definition.parseConfiguration(configuration)).toEqual({
      ok: true,
      configuration,
      view: { [definition.viewKey]: configuration },
    });
  });

  it("accepts structured workflow lines and rejects shell strings and blank or oversized fields", () => {
    const workflow = definitions.find((definition) => definition.id === "workflow")!;
    const run = { kind: "run", executable: "npm", arguments: ["run", "dev"] };
    const line = {
      invocations: [run, { kind: "open", target: "http://localhost:8081" }],
      workingDirectory: "C:/Projects/App",
      display: "terminal",
    };
    const parse = (lines: unknown[]) => workflow.parseConfiguration({ lines }).ok;
    expect(parse([line])).toBe(true);
    for (const bad of [
      { ...line, command: "npm run dev" },
      { ...line, invocations: [] },
      { ...line, invocations: Array.from({ length: 9 }, () => run) },
      { ...line, invocations: [{ ...run, shell: "npm run dev" }] },
      { ...line, invocations: [{ kind: "shell", line: "npm run dev" }] },
      { ...line, invocations: [{ ...run, executable: "  " }] },
      { ...line, invocations: [{ kind: "open", target: "" }] },
      { ...line, workingDirectory: "" },
      { ...line, display: "elevated" },
      { ...line, invocations: [{ ...run, arguments: Array.from({ length: 65 }, () => "x") }] },
      { ...line, invocations: [{ ...run, arguments: ["a\u0000b"] }] },
      { ...line, invocations: [{ ...run, executable: "é".repeat(2049) }] },
    ])
      expect(parse([bad])).toBe(false);
    expect(parse(Array.from({ length: 33 }, () => line))).toBe(false);
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
