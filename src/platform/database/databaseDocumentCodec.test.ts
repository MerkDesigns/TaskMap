// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createValidDocumentInput } from "../../domain/document/documentTestFixtures";
import { validateTaskMapDocument } from "../../domain/document/validateDocument";
import { decodeDatabaseDocument, encodeDatabaseDocument } from "./databaseDocumentCodec";

function validDocument() {
  const validated = validateTaskMapDocument(createValidDocumentInput());
  if (!validated.ok) throw new Error("expected a valid fixture");
  return validated.document;
}

describe("database document codec", () => {
  it("decodes the text it just encoded to the same document", () => {
    const encoded = encodeDatabaseDocument(validDocument());
    if (!encoded.ok) throw new Error("expected an encoded document");
    const decoded = decodeDatabaseDocument(encoded.value);
    expect(decoded).toMatchObject({ ok: true });
    expect(decodeDatabaseDocument(encoded.value)).toEqual(decoded);
    expect(JSON.stringify(decoded.ok && decoded.value)).toBe(encoded.value);
  });

  it("still validates other text", () => {
    const encoded = encodeDatabaseDocument(validDocument());
    if (!encoded.ok) throw new Error("expected an encoded document");
    const changed = encoded.value.replace('"schemaVersion":1', '"schemaVersion":2');
    expect(decodeDatabaseDocument(changed)).toMatchObject({
      ok: false,
      error: { code: "invalid_document_payload" },
    });
    expect(decodeDatabaseDocument("not json")).toMatchObject({ ok: false });
  });
});
