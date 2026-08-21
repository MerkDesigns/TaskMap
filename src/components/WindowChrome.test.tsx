import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WindowChromeActions } from "../app/windowChrome";
import { WindowChrome } from "./WindowChrome";

afterEach(cleanup);

describe("WindowChrome", () => {
  it("routes drag and window buttons without turning controls into drag targets", async () => {
    let maximized = false;
    let resizedListener: (() => void) | undefined;
    const actions: WindowChromeActions = {
      close: vi.fn().mockResolvedValue(undefined),
      isMaximized: vi.fn(async () => maximized),
      minimize: vi.fn().mockResolvedValue(undefined),
      onResized: vi.fn(async (listener) => {
        resizedListener = listener;
        return vi.fn();
      }),
      startDragging: vi.fn().mockResolvedValue(undefined),
      toggleMaximize: vi.fn(async () => {
        maximized = !maximized;
      }),
    };
    const { container } = render(<WindowChrome actions={actions} radius={17} />);
    const dragRegion = container.querySelector<HTMLElement>(".taskmap-window-drag-region");

    expect(dragRegion).not.toBeNull();
    expect(
      screen
        .getByRole("group", { name: "Window controls" })
        .style.getPropertyValue("--taskmap-material-radius"),
    ).toBe("17px");
    await waitFor(() => expect(actions.isMaximized).toHaveBeenCalled());

    fireEvent(dragRegion!, pointerDownEvent(0, 1));
    expect(actions.startDragging).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByLabelText("Minimize window"), pointerDownEvent(0, 1));
    fireEvent.click(screen.getByLabelText("Minimize window"));
    expect(actions.startDragging).toHaveBeenCalledTimes(1);
    expect(actions.minimize).toHaveBeenCalledTimes(1);

    fireEvent.doubleClick(dragRegion!, { button: 0 });
    await waitFor(() => expect(screen.getByLabelText("Restore window")).toBeInTheDocument());
    expect(actions.toggleMaximize).toHaveBeenCalledTimes(1);

    maximized = false;
    await act(async () => resizedListener?.());
    await waitFor(() => expect(screen.getByLabelText("Maximize window")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Close window"));
    expect(actions.close).toHaveBeenCalledTimes(1);
  });

  it("ignores non-primary pointer presses in the drag region", () => {
    const actions = createActions();
    const { container } = render(<WindowChrome actions={actions} />);
    const dragRegion = container.querySelector<HTMLElement>(".taskmap-window-drag-region");

    fireEvent(dragRegion!, pointerDownEvent(2, 1));
    fireEvent(dragRegion!, pointerDownEvent(0, 2));

    expect(actions.startDragging).not.toHaveBeenCalled();
  });
});

function createActions(): WindowChromeActions {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    isMaximized: vi.fn().mockResolvedValue(false),
    minimize: vi.fn().mockResolvedValue(undefined),
    onResized: vi.fn().mockResolvedValue(vi.fn()),
    startDragging: vi.fn().mockResolvedValue(undefined),
    toggleMaximize: vi.fn().mockResolvedValue(undefined),
  };
}

function pointerDownEvent(button: number, detail: number) {
  const event = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: button },
    detail: { value: detail },
  });
  return event;
}
