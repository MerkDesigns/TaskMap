import { describe, expect, it, vi } from "vitest";
import { createContextTargets, type ContextTargetPorts } from "./contextTargets";

const extensions: Record<string, object> = {
  a: { lock: { enabled: true } },
  b: { search: { query: "" }, privacy: undefined as unknown as object },
};

function setup(selection: string[]) {
  const ports: ContextTargetPorts = {
    selection,
    element: (id) => ({ extensions: extensions[id] }),
    isTopLevel: (id) => id !== "contained",
    reorder: vi.fn(),
    updateAccent: vi.fn(),
    remove: vi.fn(),
    closeContextMenus: vi.fn(),
    endRename: vi.fn(),
  };
  return { targets: createContextTargets(ports), ports };
}

describe("createContextTargets", () => {
  it("applies a command to the whole selection the element is in, else to the element", () => {
    const { targets, ports } = setup(["a", "b"]);

    targets.remove("a");
    targets.remove("c");

    expect(ports.remove).toHaveBeenNthCalledWith(1, ["a", "b"]);
    expect(ports.remove).toHaveBeenNthCalledWith(2, ["c"]);
    expect(targets.isMulti("a")).toBe(true);
    expect(targets.isMulti("c")).toBe(false);
  });

  it("lists the extensions installed on any target", () => {
    const { targets } = setup(["a", "b"]);

    expect([...targets.installedExtensions("a")].sort()).toEqual(["lock", "search"]);
  });

  it("moves only top-level targets between layers", () => {
    const { targets, ports } = setup(["a", "contained"]);

    targets.moveLayer("a", "front");

    expect(ports.reorder).toHaveBeenCalledWith(["a"], "front");
    expect(ports.endRename).toHaveBeenCalled();
  });
});
