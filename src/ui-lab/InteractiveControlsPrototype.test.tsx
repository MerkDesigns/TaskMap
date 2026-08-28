import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithUiProviders as render } from "../test/renderWithUiProviders";
import { MotionProvider } from "../ui/motion/MotionProvider";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { InteractiveControlsPrototype } from "./InteractiveControlsPrototype";

afterEach(cleanup);

describe("InteractiveControlsPrototype", () => {
  it("renders and exercises the real production controls", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ReducedMotionProvider override>
        <MotionProvider>
          <InteractiveControlsPrototype />
        </MotionProvider>
      </ReducedMotionProvider>,
    );

    const vertical = screen.getByRole("tablist", { name: "Workspace settings sections" });
    const horizontal = screen.getByRole("tablist", { name: "Workspace preferences" });
    expect(vertical).toHaveClass("taskmap-liquid-tabs");
    expect(vertical).toHaveAttribute("aria-orientation", "vertical");
    expect(horizontal).toHaveClass("taskmap-liquid-tabs");
    expect(horizontal).toHaveAttribute("aria-orientation", "horizontal");
    expect(screen.getAllByRole("tab").every((tab) => tab.tabIndex === -1)).toBe(true);
    expect(container.querySelectorAll(".taskmap-liquid-indicator")).toHaveLength(2);

    const appearance = screen.getAllByRole("tab", { name: "Appearance" });
    await user.click(appearance[0]);
    expect(screen.getByText("Selected: Appearance")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    expect(screen.getByText("Selected: Advanced")).toBeInTheDocument();

    const toggle = screen.getByRole("switch", { name: "30px toggle option" });
    expect(toggle).toHaveClass("taskmap-liquid-toggle");
    expect(toggle).toHaveAttribute("tabindex", "-1");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Toggle: On")).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(confirm).toHaveClass("taskmap-button");
    expect(confirm).toHaveAttribute("tabindex", "-1");
    expect(confirm).toHaveClass("taskmap-button--primary");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("taskmap-button--secondary");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("taskmap-button--danger");
    expect(screen.getByRole("button", { name: "Details" })).toHaveClass("taskmap-button--ghost");
    await user.click(confirm);
    expect(screen.getByText("Confirmed · Confirmed 1 time")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Cancelled · Confirmed 1 time")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete requested · Confirmed 1 time")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Details opened · Confirmed 1 time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });
});
