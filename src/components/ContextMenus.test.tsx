import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TextCardElement } from "../types";
import { CanvasContextMenu, TextCardContextMenu } from "./ContextMenus";

afterEach(cleanup);

describe("canvas context menu", () => {
  it("puts Create text card first and labels every creation action", () => {
    render(
      <CanvasContextMenu
        menu={{ clientX: 100, clientY: 100 }}
        hasCopiedItem
        closing={false}
        onPaste={vi.fn()}
        onCreate={vi.fn()}
        onCreateTextCard={vi.fn()}
        onCreateTextBlock={vi.fn()}
        onCreateImage={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Create text card");
    expect(within(buttons[0]).getByText("Create text card")).toBeInTheDocument();
    expect(buttons[0].querySelector(".tabler-icon-text-size")).toBeInTheDocument();
    expect(screen.getByText("Create container")).toBeInTheDocument();
    expect(screen.getByText("Create text block")).toBeInTheDocument();
    expect(screen.getByText("Create image")).toBeInTheDocument();
  });
});

describe("text card context menu", () => {
  it("opens the Extra Colors picker directly below Edit Text", async () => {
    const user = userEvent.setup();
    const onUpdateAccent = vi.fn();
    const onRememberRecentColor = vi.fn();
    const card: TextCardElement = {
      id: "card-1",
      text: "Card",
      x: 20,
      y: 30,
      accent: "#476FA8",
      extensions: { colorPicker: { enabled: true } },
    };

    render(
      <TextCardContextMenu
        menu={{ id: card.id, left: 100, top: 100 }}
        card={card}
        closing={false}
        onStartEdit={vi.fn()}
        onEditCommand={vi.fn()}
        onUpdateAccent={onUpdateAccent}
        recentColors={[]}
        onRememberRecentColor={onRememberRecentColor}
        onUpdateLink={vi.fn()}
        onCut={vi.fn()}
        onCopy={vi.fn()}
        onRemoveLockExtension={vi.fn()}
        onRemoveColorPickerExtension={vi.fn()}
        onRemoveCheckboxExtension={vi.fn()}
        onRemoveCommandRunnerExtension={vi.fn()}
        onMoveLayer={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const editText = screen.getByRole("button", { name: "Edit Text" });
    const openPicker = screen.getByRole("button", { name: "Open color picker" });
    expect(editText.compareDocumentPosition(openPicker) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await user.click(openPicker);
    const colorInput = screen.getByTitle("Visual color picker");
    expect(colorInput.closest("[data-color-picker-menu]")).toHaveAttribute("data-context-menu");
    fireEvent.change(colorInput, { target: { value: "#123456" } });
    expect(onUpdateAccent).toHaveBeenCalledWith(card.id, "#123456");

    await user.click(screen.getByTitle("Close"));
    expect(onRememberRecentColor).toHaveBeenCalledWith("#123456");
  });
});
