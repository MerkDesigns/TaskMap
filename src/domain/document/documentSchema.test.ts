// @vitest-environment node

import { describe, expect, it } from "vitest";
import { DOCUMENT_LIMITS } from "./documentLimits";
import { parseTaskMapDocument } from "./documentSchema";
import { createValidDocumentInput, TEST_IDS } from "./documentTestFixtures";
import { validateTaskMapDocument } from "./validateDocument";

describe("current document structural parsing", () => {
  it("round trips normalized entities and does not mutate its input", () => {
    const input = createValidDocumentInput();
    const before = structuredClone(input);
    const parsed = parseTaskMapDocument(input);
    const validated = validateTaskMapDocument(input);
    const roundTripped = parseTaskMapDocument(JSON.parse(JSON.stringify(parsed)));

    expect(validated).toMatchObject({ ok: true });
    expect(parsed).toEqual(before);
    expect(input).toEqual(before);
    expect(roundTripped).toEqual(parsed);
    expect(Object.keys(parsed.elements)).toEqual([TEST_IDS.elementA, TEST_IDS.elementB]);
  });

  it("reports unsupported schema versions and unknown top-level fields", () => {
    const unsupported = { ...createValidDocumentInput(), schemaVersion: 2 };
    const versionResult = validateTaskMapDocument(unsupported);
    expect(versionResult).toMatchObject({
      ok: false,
      stage: "structure",
      issues: [{ code: "unsupported-schema-version", path: "schemaVersion" }],
    });

    const unknown = { ...createValidDocumentInput(), legacyCanvases: [] };
    const unknownResult = validateTaskMapDocument(unknown);
    expect(unknownResult).toMatchObject({
      ok: false,
      stage: "structure",
      issues: [{ code: "unknown-field" }],
    });
  });

  it("rejects malformed IDs", () => {
    const input = createValidDocumentInput();
    input.id = "document-not-a-uuid";
    const result = validateTaskMapDocument(input);

    expect(result).toMatchObject({
      ok: false,
      stage: "structure",
      issues: [{ code: "malformed-id", path: "id" }],
    });
  });

  it("rejects forbidden media filename and path fields", () => {
    const input = createValidDocumentInput();
    const media = input.mediaReferences[TEST_IDS.media];
    Object.assign(media, {
      originalFilename: "private-name.png",
      originalPath: "C:\\Users\\person\\private-name.png",
      bytes: [137, 80, 78, 71],
    });

    const result = validateTaskMapDocument(input);
    expect(result).toMatchObject({ ok: false, stage: "structure" });
    if (!result.ok)
      expect(result.issues.some((issue) => issue.code === "unknown-field")).toBe(true);
  });

  it("rejects non-JSON-safe and structurally unsupported values", () => {
    const withUndefined = createValidDocumentInput();
    Object.assign(withUndefined.elements[TEST_IDS.elementA].data, { invalid: undefined });
    expect(validateTaskMapDocument(withUndefined)).toMatchObject({
      ok: false,
      stage: "structure",
      issues: [{ code: "json-unsafe-value" }],
    });

    const withDate = createValidDocumentInput();
    Object.assign(withDate.elements[TEST_IDS.elementA].data, { invalid: new Date(0) });
    expect(validateTaskMapDocument(withDate)).toMatchObject({
      ok: false,
      stage: "structure",
      issues: [{ code: "json-unsafe-value" }],
    });
  });

  it("rejects a huge sparse array without walking its attacker-controlled length", () => {
    const input = createValidDocumentInput();
    const oversizedSparse: unknown[] = [];
    oversizedSparse.length = 0xffff_ffff;
    input.elements[TEST_IDS.elementA].data.payload = oversizedSparse;

    const result = validateTaskMapDocument(input);

    expect(result).toMatchObject({
      ok: false,
      stage: "structure",
      issues: [{ code: "json-limit-exceeded" }],
    });
    if (!result.ok) expect(result.issues).toHaveLength(1);
  });

  it("rejects oversized objects without traversing property values", () => {
    const input = createValidDocumentInput();
    const oversized: Record<string, unknown> = {};
    let getterCalls = 0;
    Object.defineProperty(oversized, "trapped", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "not reached";
      },
    });
    for (let index = 0; index < DOCUMENT_LIMITS.jsonObjectProperties; index += 1) {
      oversized[`property${index}`] = index;
    }
    input.elements[TEST_IDS.elementA].data.payload = oversized;

    const result = validateTaskMapDocument(input);

    expect(result).toMatchObject({
      ok: false,
      stage: "structure",
      issues: [{ code: "json-limit-exceeded" }],
    });
    expect(getterCalls).toBe(0);
    if (!result.ok) expect(result.issues).toHaveLength(1);
  });

  it("rejects accessor properties without invoking them", () => {
    const input = createValidDocumentInput();
    let getterCalls = 0;
    Object.defineProperty(input.elements[TEST_IDS.elementA].data, "computed", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "not reached";
      },
    });

    const result = validateTaskMapDocument(input);

    expect(result).toMatchObject({
      ok: false,
      stage: "structure",
      issues: [{ code: "json-unsafe-value" }],
    });
    expect(getterCalls).toBe(0);
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects nested %s properties in generic JSON objects",
    (propertyName) => {
      const input = createValidDocumentInput();
      input.extensionInstallations[TEST_IDS.extensionA].configuration = JSON.parse(
        `{"nested":{"${propertyName}":{}}}`,
      );

      const result = validateTaskMapDocument(input);

      expect(result).toMatchObject({
        ok: false,
        stage: "structure",
        issues: [{ code: "json-unsafe-value" }],
      });
    },
  );

  it("accepts normal JSON.parse objects without mutating the input", () => {
    const input = createValidDocumentInput();
    input.elements[TEST_IDS.elementA].data = JSON.parse(
      '{"nested":{"items":[1,true,null,"safe"]}}',
    );
    const before = JSON.stringify(input);

    expect(validateTaskMapDocument(input)).toMatchObject({ ok: true });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("enforces conservative string and collection limits", () => {
    const longName = createValidDocumentInput();
    longName.canvases[TEST_IDS.canvasA].name = "x".repeat(DOCUMENT_LIMITS.canvasNameLength + 1);
    const stringResult = validateTaskMapDocument(longName);
    expect(stringResult).toMatchObject({ ok: false, stage: "structure" });
    if (!stringResult.ok) {
      expect(stringResult.issues.some((issue) => issue.code === "limit-exceeded")).toBe(true);
    }

    const tooManyCanvases = createValidDocumentInput();
    tooManyCanvases.canvasOrder = Array.from(
      { length: DOCUMENT_LIMITS.canvasCount + 1 },
      () => TEST_IDS.canvasA,
    );
    const collectionResult = validateTaskMapDocument(tooManyCanvases);
    expect(collectionResult).toMatchObject({ ok: false, stage: "structure" });
    if (!collectionResult.ok) {
      expect(collectionResult.issues.some((issue) => issue.code === "limit-exceeded")).toBe(true);
    }
  });
});
