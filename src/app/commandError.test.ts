import { describe, expect, it } from "vitest";
import { commandErrorMessage, parseCommandError } from "./commandError";

describe("command errors", () => {
  it("parses structured backend errors", () => {
    expect(parseCommandError({ code: "missing_key", message: "Key missing" })).toEqual({
      code: "missing_key",
      message: "Key missing",
    });
  });

  it("keeps compatibility with string errors", () => {
    expect(commandErrorMessage(new Error("Failed"))).toBe("Failed");
  });
});
