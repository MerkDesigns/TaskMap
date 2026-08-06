import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultApplicationErrorReporter } from "./applicationErrorReporter";

afterEach(() => vi.restoreAllMocks());

describe("defaultApplicationErrorReporter", () => {
  it("logs a non-sensitive classification without error internals", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("decrypted document content");
    error.name = "SensitiveCustomErrorName";

    defaultApplicationErrorReporter.report({
      source: "new-architecture",
      error,
      componentStack: "sensitive component stack",
    });

    expect(consoleError).toHaveBeenCalledWith("TaskMap new-architecture render failure", {
      source: "new-architecture",
      errorType: "Error",
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("SensitiveCustomErrorName");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("decrypted document content");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("sensitive component stack");
  });
});
