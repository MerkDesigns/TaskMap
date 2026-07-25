import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

const renderCard = (value: TextCardElement, running = false) => {
  const onRunCommands = vi.fn();
  const onStopCommands = vi.fn();
  render(
    <TextCardNode
      card={value}
      editing={false}
      draft=""
      shadowsUnderElements
      onDraftChange={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      onStartMove={vi.fn()}
      onOpenMenu={vi.fn()}
      onToggleCheckbox={vi.fn()}
      onRunCommands={onRunCommands}
      running={running}
      onStopCommands={onStopCommands}
    />,
  );
  return { onRunCommands, onStopCommands };
};

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

    await user.click(screen.getByRole("button", { name: "Stop commands" }));
    expect(actions.onStopCommands).toHaveBeenCalledWith("card-1");
  });
});
