// @vitest-environment node
import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptLegacyExport } from "./migrate.mjs";

/** An export file as the legacy app's encrypt_export writes it. */
function legacyExport(body, password, overrides = {}) {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = pbkdf2Sync(password, salt, 210_000, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const sealed = Buffer.concat([
    cipher.update(JSON.stringify(body), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return JSON.stringify({
    version: 1,
    kdf: "pbkdf2-sha256",
    iterations: 210_000,
    salt: salt.toString("base64"),
    nonce: nonce.toString("base64"),
    ciphertext: sealed.toString("base64"),
    ...overrides,
  });
}

describe("decryptLegacyExport", () => {
  const body = { data: { schemaVersion: 2, canvases: [] }, images: [] };

  it("reads an export with its password", () => {
    expect(decryptLegacyExport(legacyExport(body, "export password"), "export password")).toEqual(
      body,
    );
  });

  it("refuses a wrong password", () => {
    expect(() => decryptLegacyExport(legacyExport(body, "right"), "wrong")).toThrow(
      /Wrong export password/,
    );
  });

  it("refuses files that are not legacy exports", () => {
    expect(() => decryptLegacyExport("not json", "x")).toThrow(/not a TaskMap export/);
    expect(() => decryptLegacyExport(legacyExport(body, "x", { iterations: 1 }), "x")).toThrow(
      /not supported/,
    );
  });
});
