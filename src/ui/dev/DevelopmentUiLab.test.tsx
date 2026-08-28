import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithUiProviders as render } from "../../test/renderWithUiProviders";
import { createMaterialCompositorPresentationBridge } from "../materials/materialCompositorPresentation";
import { DevelopmentUiLab } from "./DevelopmentUiLab";

afterEach(cleanup);

describe("DevelopmentUiLab", () => {
  it("renders the real catalog with locally scoped theme and explicit cutout geometry", () => {
    const { container } = render(
      <DevelopmentUiLab presentation={createMaterialCompositorPresentationBridge()} />,
    );
    const root = container.querySelector<HTMLElement>("[data-taskmap-ui-lab='development-only']");
    const cutout = container.querySelector<HTMLElement>("[data-material='cutout']");

    expect(root).toHaveClass("taskmap-target-theme", "taskmap-ui-lab");
    expect(document.documentElement).not.toHaveClass("taskmap-target-theme");
    expect(document.body).not.toHaveClass("taskmap-target-theme");
    expect(cutout).toHaveStyle("--taskmap-material-radius: 6px");
    expect(container.querySelector("[data-material='acrylic-large']")).toBeInTheDocument();
    const opaqueSample = screen.getByText("Opaque").closest("[data-material]");
    expect(opaqueSample).toHaveAttribute("data-material", "opaque");
    expect(opaqueSample).toHaveAttribute("data-material-strategy", "opaque");
    expect(container.querySelector(".taskmap-liquid-indicator")).toHaveAttribute(
      "data-material",
      "acrylic-small",
    );
    expect(screen.getByRole("heading", { name: "Acrylic compositor playground" })).toBeVisible();
  });

  it("keeps shared buttons outside native Tab navigation", () => {
    const { container } = render(
      <DevelopmentUiLab presentation={createMaterialCompositorPresentationBridge()} />,
    );
    expect(screen.queryByText("Keyboard focus: press Tab")).not.toBeInTheDocument();
    expect(
      [...container.querySelectorAll<HTMLButtonElement>(".taskmap-button")].every(
        (button) => button.tabIndex === -1,
      ),
    ).toBe(true);
  });

  it("reports the system preference and applies a non-persistent Lab-only override", async () => {
    const user = userEvent.setup();
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    const { container } = render(
      <DevelopmentUiLab presentation={createMaterialCompositorPresentationBridge()} />,
    );
    const root = container.querySelector<HTMLElement>("[data-taskmap-ui-lab='development-only']");
    const simulation = screen.getByRole("switch", { name: "Simulate reduced motion" });

    expect(screen.getByText("System reduced motion: off")).toBeVisible();
    expect(root).toHaveAttribute("data-motion-source", "system");
    expect(root).toHaveAttribute("data-reduced-motion", "false");
    await user.click(simulation);
    expect(root).toHaveAttribute("data-motion-source", "simulation");
    expect(root).toHaveAttribute("data-reduced-motion", "true");
    await user.click(screen.getByRole("button", { name: "Use system" }));
    expect(root).toHaveAttribute("data-motion-source", "system");
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it("keeps one liquid demo and exposes the expanded left-column button-material tests", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DevelopmentUiLab presentation={createMaterialCompositorPresentationBridge()} />,
    );
    for (const heading of [
      "Acrylic compositor playground",
      "Material surfaces",
      "Buttons and selection",
      "Forms",
      "Navigation and status",
      "Button material tests",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
    const toggle = screen.getByRole("button", { name: "Acrylic toggle" });
    expect(toggle.closest("[data-material]")).toHaveAttribute("data-material", "acrylic-small");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    const fourOptions = screen.getByRole("tablist", { name: "Four-option material test" });
    expect(within(fourOptions).getAllByRole("tab")).toHaveLength(4);
    expect(container.querySelectorAll('[aria-label="Four-option material test"]')).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Liquid selection" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More options example" })).toHaveClass(
      "taskmap-button--ghost",
    );
    expect(screen.getByRole("switch", { name: "Liquid glass toggle" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Confirm" })).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: "Draw check mark" })).toBeInTheDocument();
    expect(container.querySelector(".taskmap-button-material-test__controls")).toBeInTheDocument();
    expect(container.querySelector(".taskmap-button-material-test__divider")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });

  it("renders the local container context-menu fixture in the production section order", async () => {
    const user = userEvent.setup();
    render(<DevelopmentUiLab presentation={createMaterialCompositorPresentationBridge()} />);
    await user.click(screen.getByRole("button", { name: "Open container context menu" }));
    const menu = screen.getByRole("menu", { name: "Container context menu example" });
    expect(menu).toHaveAttribute("data-material", "opaque");
    expect(menu).toHaveAttribute("data-material-strategy", "opaque");
    expect(menu.closest(".taskmap-acrylic-playground__viewport")).toBeInTheDocument();
    expect(
      [...menu.querySelectorAll<HTMLElement>("[data-menu-section]")].map(
        (element) => element.dataset.menuSection,
      ),
    ).toEqual(["edit", "colors", "layers", "clipboard", "extensions", "remove"]);
    expect(within(menu).getByRole("menuitem", { name: "Edit Container" })).toBeVisible();
    expect(within(menu).getByRole("menuitem", { name: "Copy/Paste JSON" })).toBeVisible();
    expect(within(menu).getByRole("menuitem", { name: "Remove" })).toHaveAttribute(
      "data-tone",
      "danger",
    );
  });
});
