import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CanvasFrame } from "./CanvasFrame";

afterEach(cleanup);

// jsdom pointer events carry no button; the frame only reacts to the primary button.
function pressPrimary(target: Element) {
  const event = createEvent.pointerDown(target);
  Object.defineProperty(event, "button", { value: 0 });
  fireEvent(target, event);
}

function renderWorkspace() {
  render(
    <>
      <textarea aria-label="Editor" />
      <button type="button">Toolbar</button>
      <CanvasFrame data-testid="frame">
        <textarea aria-label="Card editor" />
      </CanvasFrame>
    </>,
  );
  return screen.getByTestId("frame");
}

describe("CanvasFrame", () => {
  it("takes no hits while a text selection dragged from a field outside it lasts", () => {
    const frame = renderWorkspace();

    pressPrimary(screen.getByRole("textbox", { name: "Editor" }));
    expect(frame).toHaveAttribute("data-text-selecting");

    fireEvent.pointerUp(window);
    expect(frame).not.toHaveAttribute("data-text-selecting");
  });

  it("keeps taking hits for presses on other controls and for editing inside it", () => {
    const frame = renderWorkspace();

    pressPrimary(screen.getByRole("button", { name: "Toolbar" }));
    pressPrimary(screen.getByRole("textbox", { name: "Card editor" }));

    expect(frame).not.toHaveAttribute("data-text-selecting");
  });

  it("stops ignoring hits when the window loses focus mid-drag", () => {
    const frame = renderWorkspace();

    pressPrimary(screen.getByRole("textbox", { name: "Editor" }));
    fireEvent.blur(window);

    expect(frame).not.toHaveAttribute("data-text-selecting");
  });
});
