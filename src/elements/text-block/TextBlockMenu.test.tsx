import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asEntityId } from "../../domain/ids/entityIds";
import { TextBlockMenu, type TextBlockMenuActions, type TextBlockMenuProps } from "./TextBlockMenu";
import type { TextBlockDocumentElement } from "./textBlockModel";

afterEach(cleanup);

const BLOCK_ID = asEntityId("element", "element-00000000-0000-4000-8000-000000000001");

const textBlock: TextBlockDocumentElement = {
  id: BLOCK_ID,
  canvasId: asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000002"),
  type: "text-block",
  geometry: { x: 0, y: 0, width: 400, height: 300 },
  data: { name: "Notes", text: "Body", accent: "#A74144", headerButtonsVisible: true },
};

function renderMenu(props: Partial<TextBlockMenuProps> = {}) {
  const actions = {
    onStartRename: vi.fn(),
    onUpdateAccent: vi.fn(),
    onCut: vi.fn(),
    onCopy: vi.fn(),
    onRemoveExtension: vi.fn(),
    onMoveLayer: vi.fn(),
    onDelete: vi.fn(),
  } satisfies TextBlockMenuActions;
  render(
    <TextBlockMenu
      element={textBlock}
      position={{ left: 100, top: 100 }}
      closing={false}
      isMultiTarget={false}
      installed={{}}
      actions={actions}
      {...props}
    />,
  );
  return actions;
}

describe("TextBlockMenu", () => {
  it("renames, cuts, copies and removes the text block by id", async () => {
    const user = userEvent.setup();
    const actions = renderMenu();

    await user.click(screen.getByRole("menuitem", { name: "Edit Text" }));
    await user.click(screen.getByRole("menuitem", { name: "Cut" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));

    expect(actions.onStartRename).toHaveBeenCalledWith(BLOCK_ID);
    expect(actions.onCut).toHaveBeenCalledWith(BLOCK_ID);
    expect(actions.onCopy).toHaveBeenCalledWith(BLOCK_ID);
    expect(actions.onDelete).toHaveBeenCalledWith(BLOCK_ID);
  });

  it("marks the element's accent and applies a preset", async () => {
    const user = userEvent.setup();
    const actions = renderMenu();
    const swatches = screen.getAllByRole("menuitem", { name: /Text block color/ });

    expect(swatches[0]).toHaveAttribute("aria-pressed", "true");
    expect(swatches[1]).toHaveAttribute("aria-pressed", "false");
    await user.click(swatches[1]);

    expect(actions.onUpdateAccent).toHaveBeenCalledWith(BLOCK_ID, "#AA7234");
  });

  it("moves the text block between layers", async () => {
    const user = userEvent.setup();
    const actions = renderMenu();

    await user.click(screen.getByLabelText("Bring to front"));

    expect(actions.onMoveLayer).toHaveBeenCalledWith(BLOCK_ID, "front");
  });

  it("offers only installed extensions for removal", async () => {
    const user = userEvent.setup();
    const actions = renderMenu({ installed: { privacy: true, lock: false } });

    expect(screen.queryByRole("menuitem", { name: "Lock" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Privacy" }));

    expect(actions.onRemoveExtension).toHaveBeenCalledWith(BLOCK_ID, "privacy");
  });

  it("names the selection in its actions when it targets several elements", () => {
    renderMenu({ isMultiTarget: true });

    expect(screen.getByRole("menuitem", { name: "Copy selected" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Remove selected" })).toBeInTheDocument();
  });
});
