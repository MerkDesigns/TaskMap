import { cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReducedMotionProvider } from "../../motion/reducedMotionPreference";
import { FloatingToolWindow } from "./FloatingToolWindow";

afterEach(cleanup);
beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
});

// jsdom pointer events carry no coordinates or pointer id; set the ones the window reads.
function pointer(
  type: "pointerDown" | "pointerMove" | "pointerUp",
  target: Element,
  x: number,
  y: number,
) {
  const event = createEvent[type](target);
  Object.defineProperty(event, "clientX", { value: x });
  Object.defineProperty(event, "clientY", { value: y });
  Object.defineProperty(event, "pointerId", { value: 1 });
  fireEvent(target, event);
}

function renderWindow(onClose = vi.fn()) {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  render(
    <ReducedMotionProvider override>
      <FloatingToolWindow
        label="Tool"
        icon={null}
        title="Tool window"
        closeLabel="Close tool"
        onClose={onClose}
        initialSize={{ width: 600, height: 400 }}
        minimumSize={{ width: 300, height: 200 }}
      >
        <p>Body</p>
      </FloatingToolWindow>
    </ReducedMotionProvider>,
  );
  return { dialog: screen.getByRole("dialog", { name: "Tool" }), onClose };
}

describe("FloatingToolWindow", () => {
  it("opens centred and moves by its header, staying on screen", () => {
    const { dialog } = renderWindow();
    expect(dialog.style.left).toBe("300px");
    expect(dialog.style.top).toBe("200px");

    const header = screen.getByText("Tool window").closest("header")!;
    pointer("pointerDown", header, 400, 220);
    pointer("pointerMove", header, 450, 250);
    expect(dialog.style.left).toBe("350px");
    expect(dialog.style.top).toBe("230px");
    pointer("pointerMove", header, 2000, 2000);
    pointer("pointerUp", header, 2000, 2000);

    expect(dialog.style.left).toBe("592px");
    expect(dialog.style.top).toBe("392px");
  });

  it("resizes from an edge or corner down to its minimum size", () => {
    const { dialog } = renderWindow();
    const corner = dialog.querySelector('[data-edge="se"]')!;

    pointer("pointerDown", corner, 900, 600);
    pointer("pointerMove", corner, 1000, 650);
    expect(dialog.style.width).toBe("700px");
    expect(dialog.style.height).toBe("450px");
    pointer("pointerMove", corner, 0, 0);
    pointer("pointerUp", corner, 0, 0);
    expect(dialog.style.width).toBe("300px");
    expect(dialog.style.height).toBe("200px");

    const west = dialog.querySelector('[data-edge="w"]')!;
    pointer("pointerDown", west, 300, 300);
    pointer("pointerMove", west, 250, 300);
    pointer("pointerUp", west, 250, 300);
    expect(dialog.style.left).toBe("250px");
    expect(dialog.style.width).toBe("350px");
  });

  it("fades its content without covering the glass layers", () => {
    const { dialog } = renderWindow();

    expect(screen.getByText("Body")).toHaveAttribute("data-material-presence-content");
    expect(screen.getByText("Tool window").closest("header")).toHaveAttribute(
      "data-material-presence-content",
    );
    expect(dialog.querySelector(".taskmap-material-native-glass__clip")).not.toHaveAttribute(
      "data-material-presence-content",
    );
  });

  it("closes through its close button", async () => {
    const { onClose } = renderWindow();

    fireEvent.click(screen.getByRole("button", { name: "Close tool" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
