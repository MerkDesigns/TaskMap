import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImageElement } from "../types";
import { CanvasContextMenu, ImageContextMenu } from "./ContextMenus";

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

    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveTextContent("Paste");
    expect(items[1]).toHaveTextContent("Create text card");
    expect(within(items[1]).getByText("Create text card")).toBeInTheDocument();
    expect(items[1].querySelector(".tabler-icon-text-size")).toBeInTheDocument();
    expect(screen.getByText("Create container")).toBeInTheDocument();
    expect(screen.getByText("Create text block")).toBeInTheDocument();
    expect(screen.getByText("Create mindmap")).toBeInTheDocument();
    // The App-driven menu renders on the shared ContextMenuSurface.
    const surface = screen.getByRole("menu", { name: "Canvas menu" });
    expect(surface).toHaveClass("taskmap-context-menu");
    expect(surface).toHaveAttribute("data-material", "opaque");
    fireEvent.click(screen.getByText("Create mindmap"));
    expect(onCreateMindmap).toHaveBeenCalledWith(100, 100);
    expect(screen.getByText("Create image")).toBeInTheDocument();
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

    const toggle = screen.getByRole("menuitem", { name: "Unlocked" });
    expect(toggle.querySelector(".tabler-icon-lock-open")).toBeInTheDocument();
    const firstSwatch = screen.getAllByTitle("Image frame color")[0];
    expect(toggle.compareDocumentPosition(firstSwatch) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await user.click(toggle);
    expect(onToggleLock).toHaveBeenCalledWith(image.id);
  });
});
