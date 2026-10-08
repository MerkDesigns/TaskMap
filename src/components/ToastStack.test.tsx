import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToastMessage } from "../types";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { ToastStack } from "./ToastStack";

afterEach(cleanup);

const toast = (overrides: Partial<ToastMessage>): ToastMessage => ({
  id: "toast",
  tone: "info",
  title: "Saved",
  exiting: false,
  ...overrides,
});

const renderStack = (toasts: ToastMessage[], onDismiss = vi.fn()) =>
  render(
    <ReducedMotionProvider override>
      <ToastStack toasts={toasts} onDismiss={onDismiss} />
    </ReducedMotionProvider>,
  );

describe("ToastStack", () => {
  it("announces errors as alerts and other toasts as status updates", () => {
    renderStack([
      toast({ id: "error", tone: "error", title: "Could not paste", message: "Copy it again." }),
      toast({ id: "done", tone: "success", title: "Workflow finished" }),
    ]);

    expect(screen.getByRole("alert")).toHaveTextContent("Could not pasteCopy it again.");
    expect(screen.getByRole("status")).toHaveTextContent("Workflow finished");
  });

  it("dismisses a toast from its close button", async () => {
    const onDismiss = vi.fn();
    renderStack([toast({ id: "saved" })], onDismiss);

    await userEvent.setup().click(screen.getByRole("button", { name: "Dismiss notification" }));

    expect(onDismiss).toHaveBeenCalledWith("saved");
  });

  it("renders nothing without toasts", () => {
    const { container } = renderStack([]);

    expect(container).toBeEmptyDOMElement();
  });
});
