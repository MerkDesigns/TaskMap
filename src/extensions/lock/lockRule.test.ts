import { describe, expect, it } from "vitest";
import { deletionProtectedIds, isLocked } from "./lockRule";

const locked = { lock: { enabled: true } };
const unlocked = { lock: { enabled: false } };

describe("isLocked", () => {
  it("is engaged only by an installed, enabled lock", () => {
    expect(isLocked({ extensions: locked })).toBe(true);
    expect(isLocked({ extensions: unlocked })).toBe(false);
    expect(isLocked({ extensions: {} })).toBe(false);
    expect(isLocked({})).toBe(false);
    expect(isLocked(undefined)).toBe(false);
  });
});

describe("deletionProtectedIds", () => {
  const elements = [
    { id: "container", extensions: {} },
    { id: "locked-child", containerId: "container", extensions: locked },
    { id: "free-child", containerId: "container", extensions: unlocked },
    { id: "loose-locked", containerId: null, extensions: locked },
    { id: "loose-free" },
  ];

  it("protects locked elements and the containers holding them", () => {
    expect([...deletionProtectedIds(elements, false)].sort()).toEqual([
      "container",
      "locked-child",
      "loose-locked",
    ]);
  });

  it("protects nothing when deleting locked elements is allowed", () => {
    expect(deletionProtectedIds(elements, true).size).toBe(0);
  });
});
