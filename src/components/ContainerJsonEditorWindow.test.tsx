import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ContainerJsonEditorWindow } from "./ContainerJsonEditorWindow";

describe("ContainerJsonEditorWindow", () => {
  it("applies edited JSON and can reset to the initial value", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <ContainerJsonEditorWindow
        containerName="Ideas"
        initialJson='{"name":"Ideas"}'
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Container JSON" });
    fireEvent.change(editor, { target: { value: '{"name":"Edited"}' } });
    await user.click(screen.getByRole("button", { name: "Apply JSON" }));
    expect(onApply).toHaveBeenCalledWith('{"name":"Edited"}');

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(editor).toHaveValue('{"name":"Ideas"}');

    expect(editor).toHaveStyle({ fontSize: "12px" });
    fireEvent.wheel(editor, { ctrlKey: true, deltaY: -100 });
    expect(editor).toHaveStyle({ fontSize: "13px" });
    expect(screen.queryByTitle("Resize JSON editor")).not.toBeInTheDocument();
  });
});
