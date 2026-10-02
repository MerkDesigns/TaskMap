import { describe, expect, it } from "vitest";
import { isLocalPath } from "./externalTargetClient";

describe("external link targets", () => {
  it("opens drive and network paths as files and everything else as URLs", () => {
    expect(isLocalPath(String.raw`C:\Users\me\notes.txt`)).toBe(true);
    expect(isLocalPath("D:/Projects")).toBe(true);
    expect(isLocalPath(String.raw`\\server\share\plan.pdf`)).toBe(true);
    expect(isLocalPath("https://example.com/")).toBe(false);
    expect(isLocalPath("mailto:me@example.com")).toBe(false);
  });
});
