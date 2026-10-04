import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReducedMotionProvider } from "../../ui/motion/reducedMotionPreference";
import { useWorkflowEditorFlow, type WorkflowEditorPort } from "./useWorkflowEditorFlow";
import { WorkflowEditorDialog } from "./WorkflowEditorDialog";
import type { WorkflowStep } from "./workflowDefinition";

afterEach(cleanup);

const devServer: WorkflowStep = {
  executable: "npm",
  arguments: ["run", "dev"],
  workingDirectory: "C:/Projects/App",
  display: "terminal",
  waitForExit: false,
};

function renderDialog(initialSteps: WorkflowStep[] = [devServer]) {
  const onSave = vi.fn(async () => true);
  const onClose = vi.fn();
  render(<WorkflowEditorDialog initialSteps={initialSteps} onSave={onSave} onClose={onClose} />);
  return { onSave, onClose };
}

const fields = (label: string) => screen.getAllByLabelText(label) as HTMLInputElement[];

describe("WorkflowEditorDialog", () => {
  it("saves structured steps: one argument per line and an empty directory as none", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog([]);

    fireEvent.change(fields("Program")[0], { target: { value: "  cargo " } });
    fireEvent.change(fields("Arguments")[0], { target: { value: "tauri\n\ndev --release\n" } });
    await user.click(screen.getByRole("switch", { name: "Wait until it exits" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith([
      {
        executable: "cargo",
        arguments: ["tauri", "dev --release"],
        workingDirectory: null,
        display: "terminal",
        waitForExit: true,
      },
    ]);
  });

  it("asks for a program before saving", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog([]);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Step 1 needs a program to run.");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("adds, reorders and removes steps", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Add step" }));
    fireEvent.change(fields("Program")[1], { target: { value: "cargo" } });
    await user.click(screen.getByRole("button", { name: "Move step 2 up" }));
    expect(fields("Program").map((field) => field.value)).toEqual(["cargo", "npm"]);
    await user.click(screen.getByRole("button", { name: "Remove step 2" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith([expect.objectContaining({ executable: "cargo" })]);
  });

  it("keeps the dialog open with a message when saving fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => false);
    render(<WorkflowEditorDialog initialSteps={[devServer]} onSave={onSave} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
  });
});

describe("useWorkflowEditorFlow", () => {
  function setup(overrides: Partial<WorkflowEditorPort> = {}) {
    const port = {
      getSteps: vi.fn(() => [devServer]),
      saveSteps: vi.fn(() => true),
      trust: vi.fn(async () => true),
      ...overrides,
    } satisfies WorkflowEditorPort;
    const flow: { current: ReturnType<typeof useWorkflowEditorFlow> | null } = { current: null };
    function Host() {
      flow.current = useWorkflowEditorFlow(port);
      return flow.current.editorDialog;
    }
    render(
      <ReducedMotionProvider override>
        <Host />
      </ReducedMotionProvider>,
    );
    return { port, flow: () => flow.current! };
  }

  it("stores the edited steps, then trusts them on this device", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const { port, flow } = setup({
      saveSteps: vi.fn(() => {
        order.push("save");
        return true;
      }),
      trust: vi.fn(async () => {
        order.push("trust");
        return true;
      }),
    });

    act(() => flow().openWorkflowEditor("card"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(port.saveSteps).toHaveBeenCalledWith("card", [devServer]);
    expect(port.trust).toHaveBeenCalledWith([devServer]);
    expect(order).toEqual(["save", "trust"]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("trusts nothing when the card changed before saving", async () => {
    const user = userEvent.setup();
    const { port, flow } = setup({ saveSteps: vi.fn(() => false) });

    act(() => flow().openWorkflowEditor("card"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(port.trust).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit workflow" })).toBeInTheDocument();
  });

  it("does not open for a card without the extension", () => {
    const { flow } = setup({ getSteps: vi.fn(() => null) });

    act(() => flow().openWorkflowEditor("card"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
