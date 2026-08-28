import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithUiProviders as render } from "../../test/renderWithUiProviders";
import { Button, IconButton, ToggleButton } from "./Button";
import { Field } from "./Field";
import { SearchField, Select, TextArea, TextField } from "./FormControls";
import { Checkbox, RadioGroup, Slider, Switch } from "./SelectionControls";

afterEach(cleanup);

describe("UI primitives", () => {
  it("keeps button variants on native button semantics", async () => {
    const user = userEvent.setup();
    const clicked = vi.fn();
    render(
      <>
        <Button variant="primary" onClick={clicked}>
          Primary
        </Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost" disabled onClick={clicked}>
          Disabled
        </Button>
        <ToggleButton pressed>Toggle</ToggleButton>
        <IconButton icon={<span>+</span>} aria-label="Add item" />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Primary" }));
    await user.click(screen.getByRole("button", { name: "Disabled" }));
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Toggle" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Add item" })).toHaveAttribute("type", "button");
  });

  it("uses native checkbox, switch, radio, and slider semantics", async () => {
    const user = userEvent.setup();
    function SelectionHarness() {
      const [radio, setRadio] = useState("one");
      return (
        <>
          <Checkbox label="Keep open" />
          <Switch label="Private" />
          <RadioGroup
            label="View"
            name="view"
            items={[
              { value: "one", label: "One" },
              { value: "two", label: "Two", disabled: true },
            ]}
            value={radio}
            onValueChange={setRadio}
          />
          <Slider aria-label="Zoom" min={0} max={100} defaultValue={50} />
        </>
      );
    }
    const { container } = render(<SelectionHarness />);

    const checkbox = screen.getByRole("checkbox", { name: "Keep open" });
    const switchControl = screen.getByRole("switch", { name: "Private" });
    await user.click(checkbox);
    await user.click(switchControl);
    expect(checkbox).toBeChecked();
    expect(container.querySelector(".taskmap-check-control__box svg")).toBeInTheDocument();
    expect(container.querySelector(".taskmap-check-control__mark")).toHaveAttribute(
      "pathLength",
      "1",
    );
    expect(switchControl).toBeChecked();
    expect(screen.getByRole("radio", { name: "Two" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Zoom" })).toHaveValue(50);
  });

  it("associates Field labels, descriptions, errors, and controls", () => {
    render(
      <>
        <Field label="Title" description="Visible on the card" error="Required" required>
          <TextField />
        </Field>
        <Field label="Search">
          <SearchField />
        </Field>
        <Field label="Notes">
          <TextArea />
        </Field>
        <Field label="Mode">
          <Select
            value="local"
            onValueChange={() => undefined}
            options={[{ value: "local", label: "Local" }]}
          />
        </Field>
      </>,
    );

    const title = screen.getByLabelText("Title *");
    expect(title).toHaveAttribute("aria-invalid", "true");
    const describedBy = title.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(describedBy).toHaveLength(2);
    expect(describedBy.every((id) => document.getElementById(id))).toBe(true);
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Mode" })).toBeInTheDocument();
  });

  it("keeps explicit control IDs associated and merges explicit and Field descriptions", async () => {
    const user = userEvent.setup();
    render(
      <>
        <div id="external-help">External help</div>
        <div id="format-help">Formatting help</div>
        <Field label="Custom title" description="Field description" error="Field error">
          <TextField id="explicit-title" aria-describedby="external-help format-help" />
        </Field>
      </>,
    );

    const control = screen.getByRole("textbox", { name: "Custom title" });
    const label = screen.getByText("Custom title");
    expect(control).toHaveAttribute("id", "explicit-title");
    expect(label).toHaveAttribute("for", "explicit-title");
    const describedBy = control.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(describedBy.slice(0, 2)).toEqual(["external-help", "format-help"]);
    expect(describedBy).toHaveLength(4);
    expect(new Set(describedBy)).toHaveProperty("size", 4);
    expect(describedBy.every((id) => document.getElementById(id))).toBe(true);
    await user.click(label);
    expect(control).toHaveFocus();
  });

  it("preserves explicit validation attributes outside a Field", () => {
    render(<TextField aria-label="Standalone" aria-invalid="grammar" />);
    expect(screen.getByLabelText("Standalone")).toHaveAttribute("aria-invalid", "grammar");
    screen.getByLabelText("Standalone").focus();
    expect(screen.getByLabelText("Standalone")).toHaveFocus();
  });
});
