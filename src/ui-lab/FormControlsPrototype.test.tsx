import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithUiProviders as render } from "../test/renderWithUiProviders";
import { FormControlsPrototype } from "./FormControlsPrototype";

afterEach(cleanup);

describe("FormControlsPrototype", () => {
  it("uses the production checkbox and slider with local state", async () => {
    const user = userEvent.setup();
    render(<FormControlsPrototype />);

    const checkbox = screen.getByRole("checkbox", { name: "Enable snapping" });
    const disabled = screen.getByRole("checkbox", { name: "Unavailable option" });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(disabled).not.toBeChecked();

    fireEvent.keyDown(screen.getByRole("slider", { name: "Grid opacity" }), { key: "End" });
    expect(screen.getByText("Grid opacity: 100%")).toBeInTheDocument();
  });

  it("edits the production text, textarea, and search inputs", async () => {
    const user = userEvent.setup();
    render(<FormControlsPrototype />);

    const text = screen.getByRole("textbox", { name: "Canvas name" });
    await user.clear(text);
    await user.type(text, "Roadmap");
    expect(text).toHaveValue("Roadmap");

    const textarea = screen.getByRole("textbox", { name: "Canvas notes" });
    await user.clear(textarea);
    await user.type(textarea, "First line{enter}Second line");
    expect(textarea).toHaveValue("First line\nSecond line");

    const search = screen.getByRole("searchbox", { name: "Search canvases" });
    await user.type(search, "Archive");
    expect(search).toHaveValue("Archive");
  });

  it("uses the Mantine-backed production Select and Tooltip", async () => {
    const user = userEvent.setup();
    render(<FormControlsPrototype />);

    const select = screen.getByRole("combobox", { name: "Theme" });
    expect(select).toHaveValue("System");
    await user.click(select);
    await user.click(screen.getByRole("option", { name: "Dark" }));
    expect(select).toHaveValue("Dark");

    const iconButton = screen.getByRole("button", { name: "Open settings example" });
    expect(iconButton).toHaveClass("taskmap-icon-button");
    expect(iconButton).not.toHaveAttribute("title");
    await user.hover(iconButton);
    expect(await screen.findByRole("tooltip", { name: "Open settings" })).toBeVisible();
    await user.click(iconButton);
    expect(screen.getByText("Settings requested")).toBeInTheDocument();
  });
});
