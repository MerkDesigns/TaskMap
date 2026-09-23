// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRetainedCanvasProjection } from "./createRetainedCanvasProjection";
import { createRetainedExtensionsProjection } from "./createRetainedExtensionsProjection";
import {
  createCardContainerInput,
  TEST_IDS as ids,
  validated,
} from "../../elements/cardContainerTestFixtures";
import { getArchitectureExtensionDefinitions } from "../../extensions/architectureRegistry";
import { createValidDocumentInput } from "../../domain/document/documentTestFixtures";

function inputWithExtension(extensionId = "lock", configuration = { enabled: false }) {
  const input = createCardContainerInput();
  input.extensionInstallations = createValidDocumentInput().extensionInstallations;
  Object.assign(input.extensionInstallations[ids.extensionA], { extensionId, configuration });
  return input;
}

describe("retained extension projection", () => {
  it("separates installation activation from installed-but-off state, without mutating input", () => {
    const input = inputWithExtension();
    const document = validated(input);
    const original = structuredClone(document);
    const result = createRetainedCanvasProjection().project(document);
    if (!result.ok) throw new Error("Expected projection");
    const extensions = result.canvases[0].containers[0].extensions;
    expect(extensions).toEqual({ lock: { enabled: false } });
    expect(Object.isFrozen(extensions)).toBe(true);
    expect(Object.isFrozen(extensions?.lock)).toBe(true);
    expect(Object.isFrozen(result.extensionInstallations)).toBe(true);
    expect(Object.isFrozen(result.extensionInstallations[0])).toBe(true);
    expect(Object.isFrozen(result.extensionInstallations[0].target)).toBe(true);
    expect(Object.isFrozen(result.extensionInstallations[0].configuration)).toBe(true);
    expect(document).toEqual(original);
    input.extensionInstallations[ids.extensionA].enabled = false;
    const disabled = createRetainedCanvasProjection().project(validated(input));
    if (!disabled.ok) throw new Error("Expected disabled projection");
    expect(disabled.canvases[0].containers[0].extensions).toEqual({});
    expect(disabled.extensionInstallations[0]).toMatchObject({
      enabled: false,
      configuration: { enabled: false },
    });
  });

  it.each(["sorting", "daily-reset", "pick-card", "command-runner", "unknown"])(
    "rejects unsupported %s even when disabled, without leaking data or a partial view",
    (id) => {
      const input = inputWithExtension(id);
      input.extensionInstallations[ids.extensionA].enabled = false;
      input.extensionInstallations[ids.extensionA].configuration = { command: "secret shell" };
      expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
        ok: false,
        issues: [{ code: "unsupported-extension", extensionInstanceId: ids.extensionA }],
      });
    },
  );

  it.each([true, false])("validates configuration for installation enabled=%s", (enabled) => {
    const input = inputWithExtension();
    Object.assign(input.extensionInstallations[ids.extensionA], {
      enabled,
      configuration: { enabled: "secret" },
    });
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "invalid-extension-configuration", extensionInstanceId: ids.extensionA }],
    });
  });

  it.each(["document", "canvas"])("rejects unsupported %s scope", (kind) => {
    const input = inputWithExtension();
    input.extensionInstallations[ids.extensionA].target =
      kind === "document" ? { kind, documentId: ids.document } : { kind, canvasId: ids.canvasA };
    expect(createRetainedCanvasProjection().project(validated(input))).toEqual({
      ok: false,
      issues: [{ code: "incompatible-extension-target", extensionInstanceId: ids.extensionA }],
    });
  });

  it.each([true, false])("rejects duplicate installation even when enabled=%s", (enabled) => {
    const document = validated(inputWithExtension());
    // Generic document validation also rejects duplicates. Exercise the adapter's defensive check.
    const duplicate = {
      ...document,
      extensionInstallations: {
        ...document.extensionInstallations,
        [ids.extensionB]: {
          ...document.extensionInstallations[ids.extensionA],
          id: ids.extensionB,
          enabled,
        },
      },
    };
    expect(createRetainedCanvasProjection().project(duplicate)).toEqual({
      ok: false,
      issues: [{ code: "duplicate-extension-installation", extensionInstanceId: ids.extensionB }],
    });
  });

  // This helper tests extension compatibility independently of element payload codecs.
  it.each(getArchitectureExtensionDefinitions())(
    "checks every target type for $id",
    (definition) => {
      for (const type of [
        "container",
        "text-block",
        "text-card",
        "mind-map-node",
        "image",
        "unknown",
      ]) {
        const input = inputWithExtension();
        input.elements[ids.elementA].type = type;
        Object.assign(input.extensionInstallations[ids.extensionA], {
          extensionId: definition.id,
          configuration: definition.createDefaultState(),
        });
        const result = createRetainedExtensionsProjection().project(validated(input));
        expect(result.issues.length === 0).toBe(definition.compatibleElementTypes.includes(type));
        if (!result.issues.length)
          expect(result.byElement.get(ids.elementA)).toEqual({
            [definition.viewKey]: definition.createDefaultState(),
          });
      }
    },
  );
});
