import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TextCardElement } from "../types";
import { TextCardNode } from "./TextCardNode";

afterEach(cleanup);

const card = (commands: TextCardElement["extensions"]): TextCardElement => ({
  id: "card-1",
  text: "Build",
  x: 10,
  y: 20,
  accent: "#476FA8",
  extensions: commands,
});

const renderCard = (
  value: TextCardElement,
  running = false,
  drag?: {
    dragging?: boolean;
    dragAtTrueSize?: boolean;
    dragPrimary?: boolean;
    accentBar?: boolean;
    forceInteractive?: boolean;
  },
) => {
  const onRunCommands = vi.fn();
  const onStopCommands = vi.fn();
  const onStartMove = vi.fn();
  const { container } = render(
    <TextCardNode
      card={value}
      editing={false}
      draft=""
      shadowsUnderElements
      onDraftChange={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      onStartMove={onStartMove}
      onOpenMenu={vi.fn()}
      onToggleCheckbox={vi.fn()}
      onRunCommands={onRunCommands}
      running={running}
      onStopCommands={onStopCommands}
      {...drag}
    />,
  );
  return { container, onRunCommands, onStartMove, onStopCommands };
};

describe("TextCardNode drag presentation", () => {
  it("keeps the complete text-card shell when the accent bar is disabled", () => {
    const { container } = renderCard(card(undefined), false, { accentBar: false });
    const renderedCard = container.querySelector<HTMLElement>("[data-text-card-id='card-1']");

    expect(renderedCard).toHaveClass("inline-flex", "px-[17px]");
    expect(renderedCard).not.toHaveClass("border-l-[6px]");
    expect(
      renderedCard
        ?.querySelector<HTMLElement>(".selection-overlay")
        ?.style.getPropertyValue("--selection-overlay-left"),
    ).toBe("-1px");
  });

  it("can remain interactive inside the pointer-transparent release layer", () => {
    const { container } = renderCard(card(undefined), false, { forceInteractive: true });

    expect(container.querySelector("[data-text-card-id='card-1']")).toHaveClass(
      "pointer-events-auto",
    );
  });

  it("anchors the lifted size to the card position", () => {
    const { container } = renderCard(card(undefined), false, {
      dragging: true,
      dragPrimary: true,
    });
    const draggedCard = container.querySelector("[data-text-card-id='card-1']");

    expect(draggedCard).toHaveClass("origin-top-left", "scale-[1.035]");
  });

  it("shows the primary card at its true size without a transition after snapping", () => {
    const { container } = renderCard(card(undefined), false, {
      dragging: true,
      dragAtTrueSize: true,
      dragPrimary: true,
    });
    const draggedCard = container.querySelector("[data-text-card-id='card-1']");

    expect(draggedCard).toHaveClass("origin-top-left", "scale-100");
    expect(draggedCard).not.toHaveClass("scale-[1.035]");
    expect(draggedCard).not.toHaveClass("transition-transform");
  });
});

describe("TextCardNode multiline mode", () => {
  it("keeps Shift+Enter as a line break and saves on plain Enter", () => {
    const onSave = vi.fn();
    const { container } = render(
      <TextCardNode
        card={{ ...card(undefined), kind: "mindmap" }}
        editing
        draft={"First line\nSecond line"}
        multiline
        accentBar={false}
        shadowsUnderElements
        onDraftChange={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
        onStartMove={vi.fn()}
        onOpenMenu={vi.fn()}
        onToggleCheckbox={vi.fn()}
        onRunCommands={vi.fn()}
        running={false}
        onStopCommands={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox");
    fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("card-1");
    expect(container.querySelector("[data-text-card-id='card-1']")).toHaveClass("max-w-[520px]");
    expect(container.querySelector("[aria-hidden]")).toHaveClass(
      "whitespace-pre-wrap",
      "break-words",
    );
  });

  it("measures a trailing newline as an additional blank line", () => {
    const { container } = render(
      <TextCardNode
        card={{ ...card(undefined), kind: "mindmap" }}
        editing
        draft={"First line\n"}
        multiline
        accentBar={false}
        shadowsUnderElements
        onDraftChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onStartMove={vi.fn()}
        onOpenMenu={vi.fn()}
        onToggleCheckbox={vi.fn()}
        onRunCommands={vi.fn()}
        running={false}
        onStopCommands={vi.fn()}
      />,
    );

    expect(container.querySelector("[aria-hidden]")?.textContent).toBe("First line\n\u200b");
  });

  it("does not render text-card-only extension controls", () => {
    const { container } = renderCard({
      ...card({ checkbox: { checked: false } }),
      kind: "mindmap",
    });

    expect(container.querySelector(".tabler-icon-check")).not.toBeInTheDocument();
  });

  it("never renders a hyperlink for a mindmap card", () => {
    const { container } = renderCard({
      ...card(undefined),
      kind: "mindmap",
      link: "https://example.com/",
    });

    expect(container.querySelector(".tabler-icon-link")).not.toBeInTheDocument();
  });
});

describe("TextCardNode hyperlinks", () => {
  it("renders saved hyperlinks on normal textcards", () => {
    const { container } = renderCard({ ...card(undefined), link: "https://example.com/" });

    expect(container.querySelector(".tabler-icon-link")).toBeInTheDocument();
  });

  it("limits the link hitbox to the inset text and leaves the icon available for dragging", () => {
    const actions = renderCard({ ...card(undefined), link: "https://example.com/" });
    const linkButton = screen.getByRole("button", { name: "Build" });
    const linkIcon = actions.container.querySelector(".tabler-icon-link");

    expect(linkButton).toHaveClass("h-5", "leading-5");
    expect(linkIcon).toHaveClass("pointer-events-none");
    expect(linkIcon?.closest("button")).toBeNull();

    fireEvent.pointerDown(linkButton);
    expect(actions.onStartMove).not.toHaveBeenCalled();
    fireEvent.pointerDown(linkIcon as Element);
    expect(actions.onStartMove).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "card-1" }),
    );
  });
});

describe("TextCardNode Command Runner controls", () => {
  it("disables Play with no commands while keeping it solid white", () => {
    renderCard(card({ commandRunner: { commands: [] } }));
    expect(screen.getByRole("button", { name: "Run saved commands" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run saved commands" })).toHaveStyle({
      color: "rgb(255, 255, 255)",
      opacity: "1",
    });
    expect(
      screen.queryByRole("button", { name: "Command Runner settings" }),
    ).not.toBeInTheDocument();
  });

  it("runs configured commands from Play", async () => {
    const user = userEvent.setup();
    const actions = renderCard(
      card({ commandRunner: { commands: [{ command: "npm test", runMode: "background" }] } }),
    );
    await user.click(screen.getByRole("button", { name: "Run saved commands" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Run saved commands" })).toHaveClass(
        "command-runner-play-press",
      ),
    );
    await waitFor(() => expect(actions.onRunCommands).toHaveBeenCalledWith("card-1"));
  });

  it("shows a running control that stops commands", async () => {
    const user = userEvent.setup();
    const actions = renderCard(
      card({ commandRunner: { commands: [{ command: "npm test", runMode: "background" }] } }),
      true,
    );

    const runningCog = actions.container.querySelector(".tabler-icon-settings.animate-spin");
    expect(runningCog).toBeInTheDocument();
    expect(runningCog).toHaveAttribute("width", "20.7");
    expect(runningCog).toHaveStyle({ animationDuration: "1.3s" });
    await user.click(screen.getByRole("button", { name: "Stop commands" }));
    expect(actions.onStopCommands).toHaveBeenCalledWith("card-1");
  });
});
