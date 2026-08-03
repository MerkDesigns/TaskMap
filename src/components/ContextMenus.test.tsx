import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImageElement, TextCardElement } from "../types";
import { CanvasContextMenu, ImageContextMenu, TextCardContextMenu } from "./ContextMenus";

afterEach(cleanup);

describe("canvas context menu", () => {
  it("puts conditional Paste above the creation actions", () => {
    const onCreateMindmap = vi.fn();
    render(
      <CanvasContextMenu
        menu={{ clientX: 100, clientY: 100 }}
        hasCopiedItem
        closing={false}
        onPaste={vi.fn()}
        onCreate={vi.fn()}
        onCreateTextCard={vi.fn()}
        onCreateTextBlock={vi.fn()}
        onCreateMindmap={onCreateMindmap}
        onCreateImage={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Paste");
    expect(within(buttons[0]).getByText("Paste")).toHaveClass("text-[#7debe1]");
    expect(buttons[1]).toHaveTextContent("Create text card");
    expect(within(buttons[1]).getByText("Create text card")).toBeInTheDocument();
    expect(buttons[1].querySelector(".tabler-icon-text-size")).toBeInTheDocument();
    expect(screen.getByText("Create container")).toBeInTheDocument();
    expect(screen.getByText("Create text block")).toBeInTheDocument();
    expect(screen.getByText("Create mindmap")).toBeInTheDocument();
    expect(screen.getByText("Create mindmap").closest("[data-context-menu]")).toHaveClass(
      "z-[200]",
    );
    fireEvent.click(screen.getByText("Create mindmap"));
    expect(onCreateMindmap).toHaveBeenCalledWith(100, 100);
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
        onToggleLock={vi.fn()}
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
    expect(screen.getByText("Hyperlink")).toBeInTheDocument();
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

  it("does not offer hyperlinks to mindmap cards", () => {
    const card: TextCardElement = {
      id: "mindmap-1",
      kind: "mindmap",
      text: "Mindmap",
      x: 20,
      y: 30,
      accent: "#476FA8",
    };

    render(
      <TextCardContextMenu
        menu={{ id: card.id, left: 100, top: 100 }}
        card={card}
        closing={false}
        onStartEdit={vi.fn()}
        onEditCommand={vi.fn()}
        onUpdateAccent={vi.fn()}
        recentColors={[]}
        onRememberRecentColor={vi.fn()}
        onUpdateLink={vi.fn()}
        onToggleLock={vi.fn()}
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

    expect(screen.queryByText("Hyperlink")).not.toBeInTheDocument();
  });

  it("toggles an installed lock above the color swatches for a selected mindmap group", async () => {
    const user = userEvent.setup();
    const onToggleLock = vi.fn();
    const card: TextCardElement = {
      id: "mindmap-locked",
      kind: "mindmap",
      text: "Mindmap",
      x: 20,
      y: 30,
      accent: "#476FA8",
      extensions: { lock: { enabled: true } },
    };

    render(
      <TextCardContextMenu
        menu={{ id: card.id, left: 100, top: 100 }}
        card={card}
        closing={false}
        isMultiTarget
        onStartEdit={vi.fn()}
        onEditCommand={vi.fn()}
        onUpdateAccent={vi.fn()}
        recentColors={[]}
        onRememberRecentColor={vi.fn()}
        onUpdateLink={vi.fn()}
        onToggleLock={onToggleLock}
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

    const toggle = screen.getByRole("button", { name: "Locked" });
    expect(toggle.querySelector(".tabler-icon-lock")).toBeInTheDocument();
    const firstSwatch = screen.getAllByTitle("Text card color")[0];
    expect(toggle.compareDocumentPosition(firstSwatch) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await user.click(toggle);
    expect(onToggleLock).toHaveBeenCalledWith(card.id);
  });
});

describe("image context menu", () => {
  it("toggles an installed lock above the color swatches", async () => {
    const user = userEvent.setup();
    const onToggleLock = vi.fn();
    const image: ImageElement = {
      id: "image-locked",
      x: 20,
      y: 30,
      width: 200,
      height: 120,
      accent: "#476FA8",
      extensions: { lock: { enabled: false } },
    };

    render(
      <ImageContextMenu
        menu={{ id: image.id, left: 100, top: 100 }}
        image={image}
        closing={false}
        onReplace={vi.fn()}
        onUpdateAccent={vi.fn()}
        onToggleBackground={vi.fn()}
        onToggleLock={onToggleLock}
        onMoveLayer={vi.fn()}
        onCut={vi.fn()}
        onCopy={vi.fn()}
        onRemoveLockExtension={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Unlocked" });
    expect(toggle.querySelector(".tabler-icon-lock-open")).toBeInTheDocument();
    const firstSwatch = screen.getAllByTitle("Image frame color")[0];
    expect(toggle.compareDocumentPosition(firstSwatch) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await user.click(toggle);
    expect(onToggleLock).toHaveBeenCalledWith(image.id);
  });
});
