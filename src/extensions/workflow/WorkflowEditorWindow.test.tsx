import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReducedMotionProvider } from "../../ui/motion/reducedMotionPreference";
import { useWorkflowEditorFlow, type WorkflowEditorPort } from "./useWorkflowEditorFlow";
import { WorkflowEditorWindow } from "./WorkflowEditorWindow";
import type { WorkflowLine } from "./workflowDefinition";

afterEach(cleanup);

const devServer: WorkflowLine = {
  invocations: [{ kind: "run", executable: "npm", arguments: ["run", "dev"] }],
  workingDirectory: "C:/Projects/App",
  display: "terminal",
};

function renderWindow(initialLines: WorkflowLine[] = [devServer], overrides = {}) {
  const props = {
    onSave: vi.fn(async () => true),
    onChooseFolder: vi.fn(async () => "C:/Chosen" as string | null),
    onClose: vi.fn(),
    ...overrides,
  };
  render(
    <ReducedMotionProvider override>
      <WorkflowEditorWindow cardName="Dev tools" initialLines={initialLines} {...props} />
    </ReducedMotionProvider>,
  );
  return props;
}

const command = (index: number) =>
  screen.getByRole("textbox", { name: `Command ${index}` }) as HTMLInputElement;

describe("WorkflowEditorWindow", () => {
  it("shows saved lines as the command lines they came from", () => {
    renderWindow();

    expect(command(1).value).toBe("npm run dev");
    expect(
      (screen.getByRole("textbox", { name: "Working directory 1" }) as HTMLInputElement).value,
    ).toBe("C:/Projects/App");
  });

  it("saves typed commands as structured lines, never as shell text", async () => {
    const user = userEvent.setup();
    const { onSave } = renderWindow([]);

    fireEvent.change(command(1), {
      target: { value: "docker desktop start && docker compose up -d" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Working directory 1" }), {
      target: { value: "C:\\Users\\Merk\\Projects\\TwitchDropsMiner" },
    });
    await user.click(screen.getByRole("button", { name: "Add command" }));
    fireEvent.change(command(2), { target: { value: "start http://localhost:8081" } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith("Dev tools", [
      {
        invocations: [
          { kind: "run", executable: "docker", arguments: ["desktop", "start"] },
          { kind: "run", executable: "docker", arguments: ["compose", "up", "-d"] },
        ],
        workingDirectory: "C:\\Users\\Merk\\Projects\\TwitchDropsMiner",
        display: "terminal",
      },
      {
        invocations: [{ kind: "open", target: "http://localhost:8081" }],
        workingDirectory: null,
        display: "terminal",
      },
    ]);
  });

  it("explains a command that needs a shell and does not save", async () => {
    const user = userEvent.setup();
    const { onSave } = renderWindow([]);

    fireEvent.change(command(1), { target: { value: "npm test > out.txt" } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Redirecting output");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("fills the working directory from the folder picker and reorders lines", async () => {
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "Choose folder for command 1" }));
    expect(
      (screen.getByRole("textbox", { name: "Working directory 1" }) as HTMLInputElement).value,
    ).toBe("C:/Chosen");
    await user.click(screen.getByRole("button", { name: "Add command" }));
    fireEvent.change(command(2), { target: { value: "cargo run" } });
    await user.click(screen.getByRole("button", { name: "Move command 2 up" }));
    expect(command(1).value).toBe("cargo run");
  });

  it("stays open with a message when saving fails", async () => {
    const user = userEvent.setup();
    renderWindow([devServer], { onSave: vi.fn(async () => false) });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
  });
});

describe("useWorkflowEditorFlow", () => {
  function setup(overrides: Partial<WorkflowEditorPort> = {}) {
    const port = {
      getLines: vi.fn(() => [devServer]),
      getCardName: vi.fn(() => "Dev tools"),
      saveLines: vi.fn(() => true),
      saveCardName: vi.fn(() => true),
      trust: vi.fn(async () => true),
      chooseFolder: vi.fn(async () => null),
      ...overrides,
    } satisfies WorkflowEditorPort;
    const flow: { current: ReturnType<typeof useWorkflowEditorFlow> | null } = { current: null };
    function Host() {
      flow.current = useWorkflowEditorFlow(port);
      return flow.current.editorWindow;
    }
    render(
      <ReducedMotionProvider override>
        <Host />
      </ReducedMotionProvider>,
    );
    return { port, flow: () => flow.current! };
  }

  it("stores the lines and a new name, then trusts the lines on this device", async () => {
    const user = userEvent.setup();
    const { port, flow } = setup();

    act(() => flow().openWorkflowEditor("card"));
    fireEvent.change(screen.getByRole("textbox", { name: "Text card name" }), {
      target: { value: "Start dev" },
    });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(port.saveLines).toHaveBeenCalledWith("card", [devServer]);
    expect(port.saveCardName).toHaveBeenCalledWith("card", "Start dev");
    expect(port.trust).toHaveBeenCalledWith([devServer]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("trusts nothing when the card changed before saving", async () => {
    const user = userEvent.setup();
    const { port, flow } = setup({ saveLines: vi.fn(() => false) });

    act(() => flow().openWorkflowEditor("card"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(port.trust).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit workflow" })).toBeInTheDocument();
  });

  it("does not open for a card without the extension", () => {
    const { flow } = setup({ getLines: vi.fn(() => null) });

    act(() => flow().openWorkflowEditor("card"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
