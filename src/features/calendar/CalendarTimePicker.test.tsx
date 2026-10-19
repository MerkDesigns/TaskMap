import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarTimePicker } from "./CalendarTimePicker";

afterEach(cleanup);

function renderPicker() {
  const onSet = vi.fn();
  render(
    <CalendarTimePicker
      title="Choose a time"
      value="09:00"
      onSet={onSet}
      onBack={vi.fn()}
      onHeightChange={vi.fn()}
    />,
  );
  return { onSet, value: () => screen.getByRole("status").textContent };
}

describe("CalendarTimePicker", () => {
  it("moves one row per mouse-wheel notch, however far the system scrolls per notch", () => {
    const { onSet, value } = renderPicker();
    const minutes = screen.getByRole("listbox", { name: "Minutes" });
    for (let notch = 0; notch < 3; notch++) fireEvent.wheel(minutes, { deltaY: 100 });
    expect(value()).toBe("09:03");
    fireEvent.wheel(minutes, { deltaY: -300 });
    expect(value()).toBe("09:02");

    fireEvent.click(screen.getByRole("button", { name: "Set time" }));
    expect(onSet).toHaveBeenCalledWith("09:02");
  });

  it("adds up a touchpad's small scrolls to one row at a time", () => {
    const { value } = renderPicker();
    const hours = screen.getByRole("listbox", { name: "Hours" });
    for (let step = 0; step < 3; step++) fireEvent.wheel(hours, { deltaY: 10 });
    expect(value()).toBe("09:00");
    fireEvent.wheel(hours, { deltaY: 10 });
    expect(value()).toBe("10:00");
  });
});
