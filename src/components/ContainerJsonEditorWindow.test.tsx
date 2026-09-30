import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { ContainerJsonEditorWindow } from "./ContainerJsonEditorWindow";

afterEach(cleanup);

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

  it("renders a Major Glass window and closes through presence on Close and Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const view = (
      <ReducedMotionProvider override>
        <ContainerJsonEditorWindow
          containerName="Ideas"
          initialJson="{}"
          onApply={vi.fn()}
          onClose={onClose}
        />
      </ReducedMotionProvider>
    );
    const { unmount } = render(view);
    const dialog = screen.getByRole("dialog", { name: "Edit JSON for Ideas" });
    expect(dialog).toHaveAttribute("data-material", "acrylic-large");
    expect(dialog.closest(".taskmap-target-theme")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Close JSON editor" }));
    expect(onClose).toHaveBeenCalledOnce();
    unmount();

    render(view);
    screen.getByRole("textbox", { name: "Container JSON" }).focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
