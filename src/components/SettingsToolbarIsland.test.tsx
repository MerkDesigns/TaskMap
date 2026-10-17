import { act, cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolbarButtonId } from "../platform/settings/preferenceContracts";
import { SettingsToolbarIsland } from "./SettingsToolbarIsland";

afterEach(cleanup);

// jsdom has no layout, so the stage sits at the origin and these are the island's own coordinates.
const toolbarSlot = (index: number) => ({ x: 8 + index * 32 + 14, y: 20 });
// The tray starts after the toolbar bar and the divider beside it.
const traySlot = (index: number, toolbarButtons = 6) => ({
  x: toolbarButtons * 32 + 12 + 25 + 8 + index * 32 + 14,
  y: 20,
});

describe("SettingsToolbarIsland", () => {
  it("reorders the toolbar by dropping a button between two others", () => {
    const onButtonsChange = renderIsland();
    drag("Sleep mode", toolbarSlot(5), toolbarSlot(1));
    expect(onButtonsChange).toHaveBeenCalledExactlyOnceWith([
      "canvases",
      "sleep",
      "extensions",
      "settings",
      "privacy",
      "minimap",
    ]);
  });

  it("moves a toolbar button into the tray of unused buttons", () => {
    const onButtonsChange = renderIsland();
    drag("Privacy mode", toolbarSlot(3), traySlot(1));
    expect(onButtonsChange).toHaveBeenCalledExactlyOnceWith([
      "canvases",
      "extensions",
      "settings",
      "minimap",
      "sleep",
    ]);
  });

  it("swaps an unused button with the toolbar button it is dropped onto", () => {
    const onButtonsChange = renderIsland();
    drag("Placeholder 1 (unused)", traySlot(1), toolbarSlot(4));
    expect(onButtonsChange).toHaveBeenCalledExactlyOnceWith([
      "canvases",
      "extensions",
      "settings",
      "privacy",
      "placeholder-1",
      "sleep",
    ]);
  });

  it("adds an unused button into a free slot between two others", () => {
    const onButtonsChange = renderIsland(["canvases", "settings", "sleep"]);
    // The right edge of Canvases inserts after it rather than swapping.
    drag("Placeholder 2 (unused)", traySlot(5, 3), { x: toolbarSlot(0).x + 11, y: 20 });
    expect(onButtonsChange).toHaveBeenCalledExactlyOnceWith([
      "canvases",
      "placeholder-2",
      "settings",
      "sleep",
    ]);
  });

  it("keeps Settings in the toolbar and ignores clicks without a drag", () => {
    const onButtonsChange = renderIsland();
    drag("Settings", toolbarSlot(2), traySlot(0));
    drag("Minimap", toolbarSlot(4), toolbarSlot(4));
    expect(onButtonsChange).not.toHaveBeenCalled();
  });

  it("rearranges from the keyboard", () => {
    const onButtonsChange = renderIsland();
    fireEvent.keyDown(screen.getByRole("button", { name: "Canvases" }), { key: "ArrowRight" });
    expect(onButtonsChange).toHaveBeenLastCalledWith([
      "extensions",
      "canvases",
      "settings",
      "privacy",
      "minimap",
      "sleep",
    ]);
  });
});

const TOOLBAR: readonly ToolbarButtonId[] = [
  "canvases",
  "extensions",
  "settings",
  "privacy",
  "minimap",
  "sleep",
];

function renderIsland(buttons = TOOLBAR) {
  const onButtonsChange = vi.fn();
  render(
    <SettingsToolbarIsland
      buttons={buttons}
      toggles={{ privacy: false, calendar: false, minimap: false, sleep: false }}
      onButtonsChange={onButtonsChange}
    />,
  );
  return onButtonsChange;
}

function drag(name: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const tile = screen.getByRole("button", { name });
  tile.setPointerCapture = vi.fn();
  press(tile, "pointerDown", from.x, from.y);
  press(tile, "pointerMove", (from.x + to.x) / 2, (from.y + to.y) / 2);
  press(tile, "pointerMove", to.x, to.y);
  press(tile, "pointerUp", to.x, to.y);
}

/** jsdom has no PointerEvent, so the generic event it creates carries no pointer fields. */
function press(
  target: HTMLElement,
  type: "pointerDown" | "pointerMove" | "pointerUp",
  clientX: number,
  clientY: number,
) {
  const event = createEvent[type](target);
  Object.defineProperty(event, "clientX", { value: clientX });
  Object.defineProperty(event, "clientY", { value: clientY });
  Object.defineProperty(event, "button", { value: 0 });
  Object.defineProperty(event, "pointerId", { value: 1 });
  act(() => {
    fireEvent(target, event);
  });
}
