import { expect, it } from "vitest";
import { readableDatabasePath } from "./DatabaseSessionGate";

it("hides Windows verbatim prefixes from displayed database paths", () => {
  expect(readableDatabasePath(String.raw`\\?\D:\Work\A.tmapdb`)).toBe(String.raw`D:\Work\A.tmapdb`);
  expect(readableDatabasePath(String.raw`\\?\UNC\server\share\A.tmapdb`)).toBe(
    String.raw`\\server\share\A.tmapdb`,
  );
  expect(readableDatabasePath("Plain.tmapdb")).toBe("Plain.tmapdb");
});
