import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasContextMenu } from "./ContextMenus";

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
