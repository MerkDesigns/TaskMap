// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ToolbarButtonId } from "../platform/settings/preferenceContracts";
import { arrangeToolbar, toolbarArrangement } from "./toolbarButtonLayout";

const full: readonly ToolbarButtonId[] = [
  "canvases",
  "extensions",
  "settings",
  "privacy",
  "minimap",
  "sleep",
];

describe("toolbar button layout", () => {
  it("keeps every button that is not in the toolbar in the tray, in a fixed order", () => {
    expect(toolbarArrangement(full).tray).toEqual([
      "calendar",
      "placeholder-1",
      "placeholder-2",
      "placeholder-3",
    ]);
  });

  it("reorders toolbar buttons by inserting the dragged one between the others", () => {
    const moved = arrangeToolbar(
      full,
      { id: "sleep", from: "toolbar" },
      { kind: "toolbar", index: 1 },
    );
    expect(moved.toolbar).toEqual([
      "canvases",
      "sleep",
      "extensions",
      "settings",
      "privacy",
      "minimap",
    ]);
  });

  it("moves a toolbar button into the tray and a tray button into a free slot", () => {
    const fewer = arrangeToolbar(full, { id: "privacy", from: "toolbar" }, { kind: "tray" });
    expect(fewer.toolbar).toEqual(["canvases", "extensions", "settings", "minimap", "sleep"]);
    expect(fewer.tray).toEqual([
      "privacy",
      "calendar",
      "placeholder-1",
      "placeholder-2",
      "placeholder-3",
    ]);

    const added = arrangeToolbar(
      fewer.toolbar,
      { id: "placeholder-2", from: "tray" },
      { kind: "toolbar", index: 0 },
    );
    expect(added.toolbar[0]).toBe("placeholder-2");
    expect(added.toolbar).toHaveLength(6);
  });

  it("swaps a tray button with the toolbar button it is dropped onto", () => {
    const swapped = arrangeToolbar(
      full,
      { id: "placeholder-1", from: "tray" },
      { kind: "swap", id: "minimap" },
    );
    expect(swapped.toolbar).toEqual([
      "canvases",
      "extensions",
      "settings",
      "privacy",
      "placeholder-1",
      "sleep",
    ]);
    expect(swapped.tray).toContain("minimap");
  });

  it("takes a tray button into a full toolbar only by swapping", () => {
    const refused = arrangeToolbar(
      full,
      { id: "placeholder-1", from: "tray" },
      { kind: "toolbar", index: 2 },
    );
    expect(refused.toolbar).toBe(full);
  });

  it("never moves Settings out of the toolbar, though it can be reordered", () => {
    expect(
      arrangeToolbar(full, { id: "settings", from: "toolbar" }, { kind: "tray" }).toolbar,
    ).toBe(full);
    expect(
      arrangeToolbar(full, { id: "placeholder-1", from: "tray" }, { kind: "swap", id: "settings" })
        .toolbar,
    ).toBe(full);
    expect(
      arrangeToolbar(full, { id: "settings", from: "toolbar" }, { kind: "toolbar", index: 0 })
        .toolbar[0],
    ).toBe("settings");
  });

  it("leaves everything in place when a button is let go nowhere", () => {
    expect(arrangeToolbar(full, { id: "sleep", from: "toolbar" }, { kind: "none" }).toolbar).toBe(
      full,
    );
  });
});
