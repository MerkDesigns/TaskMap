import { describe, expect, it } from "vitest";
import { commandErrorMessage, isRecoverableStorageError, parseCommandError } from "./commandError";

describe("command errors", () => {
  it("parses structured backend errors", () => {
    expect(parseCommandError({ code: "missing_key", message: "Key missing" })).toEqual({
      code: "missing_key",
      message: "Key missing",
    });
    expect(isRecoverableStorageError({ code: "decrypt_failed", message: "Cannot decrypt" })).toBe(
      true,
    );
  });

  it("keeps compatibility with string errors", () => {
    expect(commandErrorMessage(new Error("Failed"))).toBe("Failed");
    expect(isRecoverableStorageError("no database key was found for this database")).toBe(true);
  });

  it("does not expose reset recovery for unrelated failures", () => {
    expect(isRecoverableStorageError({ code: "io", message: "Disk unavailable" })).toBe(false);
  });
});
