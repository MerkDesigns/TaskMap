// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LAB_CONTAINER_EXTENSION_LABELS,
  LAB_CONTAINER_MENU_SECTION_ORDER,
} from "./containerContextMenuFixture";

describe("UI Lab container context-menu fixture", () => {
  it("tracks the current production presentation order without importing its business logic", async () => {
    const [productionSource, demoSource] = await Promise.all([
      readFile(new URL("../../components/ContextMenus.tsx", import.meta.url), "utf8"),
      readFile(new URL("./ContextMenuDemo.tsx", import.meta.url), "utf8"),
    ]);
    expect(LAB_CONTAINER_MENU_SECTION_ORDER).toEqual([
      "edit",
      "colors",
      "layers",
      "clipboard",
      "extensions",
      "remove",
    ]);
    expectInSourceOrder(productionSource, [
      "Edit Container",
      "presets.map",
      'onMoveLayer(element.id, "back")',
      "onCut(element)",
      "onCopy(element)",
      "Remove Extensions",
      "onDelete(element.id)",
    ]);
    expectInSourceOrder(productionSource, LAB_CONTAINER_EXTENSION_LABELS);
    expect(demoSource).not.toContain("components/ContextMenus");
    expect(demoSource).not.toMatch(/(?:redux|persistence|history|domain)/i);
  });
});

function expectInSourceOrder(source, values) {
  let previous = -1;
  for (const value of values) {
    const index = source.indexOf(value, previous + 1);
    expect(index, `Missing or out-of-order production menu token: ${value}`).toBeGreaterThan(
      previous,
    );
    previous = index;
  }
}
