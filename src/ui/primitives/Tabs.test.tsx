import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { LiquidTabs, type LiquidTabsProps } from "./LiquidTabs";
import { Tabs, type TabsProps } from "./Tabs";

afterEach(cleanup);

const items = [
  { value: "general", label: "General", id: "general-tab", panelId: "general-panel" },
  { value: "disabled", label: "Disabled", disabled: true },
  { value: "canvas", label: "Canvas" },
  { value: "shortcuts", label: "Keyboard Shortcuts" },
] as const;

type TestProps = TabsProps<(typeof items)[number]["value"]>;

function ControlledTabs({ component: Component }: { component: ComponentType<TestProps> }) {
  const [value, setValue] = useState<TestProps["value"]>("general");
  return <Component label="Categories" items={items} value={value} onValueChange={setValue} />;
}

describe.each([
  ["Tabs", Tabs as ComponentType<TestProps>],
  ["LiquidTabs", LiquidTabs as ComponentType<LiquidTabsProps<TestProps["value"]>>],
] as const)("%s behavior", (_name, Component) => {
  it("supports click selection and ARIA tab semantics", async () => {
    const user = userEvent.setup();
    render(<ControlledTabs component={Component} />);
    const list = screen.getByRole("tablist", { name: "Categories" });
    expect(list).toHaveAttribute("aria-orientation", "horizontal");
    const general = screen.getByRole("tab", { name: "General" });
    const canvas = screen.getByRole("tab", { name: "Canvas" });
    expect(general).toHaveAttribute("aria-selected", "true");
    expect(general).toHaveAttribute("aria-controls", "general-panel");
    await user.click(canvas);
    expect(canvas).toHaveAttribute("aria-selected", "true");
    expect(canvas).toHaveAttribute("tabindex", "-1");
    expect(general).toHaveAttribute("tabindex", "-1");
    if (_name === "LiquidTabs") {
      expect(canvas.querySelector(".taskmap-liquid-tabs__label")).toHaveStyle("transform: none");
    }
  });

  it("navigates with arrows and skips disabled tabs", () => {
    render(<ControlledTabs component={Component} />);
    const general = screen.getByRole("tab", { name: "General" });
    const canvas = screen.getByRole("tab", { name: "Canvas" });
    general.focus();
    fireEvent.keyDown(general, { key: "ArrowRight" });
    expect(canvas).toHaveFocus();
    expect(canvas).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(canvas, { key: "ArrowLeft" });
    expect(general).toHaveFocus();
    expect(general).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Disabled" })).toBeDisabled();
  });

  it("supports Home and End without entering native Tab navigation", () => {
    render(<ControlledTabs component={Component} />);
    const general = screen.getByRole("tab", { name: "General" });
    const last = screen.getByRole("tab", { name: "Keyboard Shortcuts" });
    fireEvent.keyDown(general, { key: "End" });
    expect(last).toHaveFocus();
    expect(last).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(last, { key: "Home" });
    expect(general).toHaveFocus();
    expect(screen.getAllByRole("tab").every((tab) => tab.tabIndex === -1)).toBe(true);
  });
});

describe("LiquidTabs orientation", () => {
  it("uses vertical semantics and Up/Down navigation while skipping disabled tabs", () => {
    function VerticalTabs() {
      const [value, setValue] = useState<TestProps["value"]>("general");
      return (
        <LiquidTabs
          label="Vertical categories"
          items={items}
          orientation="vertical"
          value={value}
          onValueChange={setValue}
        />
      );
    }

    render(<VerticalTabs />);
    const list = screen.getByRole("tablist", { name: "Vertical categories" });
    const general = screen.getByRole("tab", { name: "General" });
    const canvas = screen.getByRole("tab", { name: "Canvas" });
    expect(list).toHaveAttribute("aria-orientation", "vertical");

    general.focus();
    fireEvent.keyDown(general, { key: "ArrowDown" });
    expect(canvas).toHaveFocus();
    expect(canvas).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(canvas, { key: "ArrowUp" });
    expect(general).toHaveFocus();
    expect(general).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Disabled" })).toBeDisabled();
  });
});
