import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Field } from "../../ui/primitives/Field";
import { PasswordInput } from "./PasswordInput";
import { useCapsLock } from "./useCapsLock";

afterEach(cleanup);

it("toggles visibility and conceals again on the signal", () => {
  const { rerender } = render(
    <Field label="Password">
      <PasswordInput concealSignal={0} />
    </Field>,
  );
  const input = screen.getByLabelText("Password") as HTMLInputElement;
  expect(input.type).toBe("password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(input.type).toBe("text");
  expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("tabindex", "-1");
  rerender(
    <Field label="Password">
      <PasswordInput concealSignal={1} />
    </Field>,
  );
  expect(input.type).toBe("password");
});

function CapsProbe() {
  return <output>{useCapsLock() ? "on" : "off"}</output>;
}

it("reads Caps Lock from key and pointer events", () => {
  render(<CapsProbe />);
  const on = new KeyboardEvent("keydown", {
    key: "a",
    modifierCapsLock: true,
  } as KeyboardEventInit);
  fireEvent(window, on);
  expect(screen.getByRole("status")).toHaveTextContent("on");
  fireEvent(window, new KeyboardEvent("keyup", { key: "a" }));
  expect(screen.getByRole("status")).toHaveTextContent("off");
});
