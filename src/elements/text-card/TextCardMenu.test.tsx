import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asEntityId } from "../../domain/ids/entityIds";
import type { MindMapNodeDocumentElement } from "../mind-map/mindMapModel";
import type { TextCardDocumentElement } from "./textCardModel";
import type { ExtensionCommands } from "../../extensions/extensionCommands";
import { TextCardMenu, type TextCardMenuActions, type TextCardMenuProps } from "./TextCardMenu";

afterEach(cleanup);

const CARD_ID = asEntityId("element", "element-00000000-0000-4000-8000-000000000001");
const CONTAINER_ID = asEntityId("element", "element-00000000-0000-4000-8000-000000000003");
const CANVAS_ID = asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000002");

const textCard = (
  data: Partial<TextCardDocumentElement["data"]> = {},
): TextCardDocumentElement => ({
  id: CARD_ID,
  canvasId: CANVAS_ID,
  type: "text-card",
  geometry: { x: 20, y: 30, width: 120, height: 40 },
  data: { text: "Card", accent: "#476FA8", link: null, placement: null, ...data },
});

const mindMapNode = (): MindMapNodeDocumentElement => ({
  id: CARD_ID,
  canvasId: CANVAS_ID,
  type: "mind-map-node",
  geometry: { x: 20, y: 30, width: 120, height: 40 },
  data: { text: "Mindmap", accent: "#476FA8" },
});

function renderMenu(props: Partial<TextCardMenuProps> = {}) {
  const actions = {
    onStartEdit: vi.fn(),
    onUpdateAccent: vi.fn(),
    onUpdateLink: vi.fn(),
    onCut: vi.fn(),
    onCopy: vi.fn(),
    onMoveLayer: vi.fn(),
    onDelete: vi.fn(),
  } satisfies TextCardMenuActions;
  const extensionCommands = {
    toggle: vi.fn(),
    remove: vi.fn(),
    updateAccent: vi.fn(),
    updateSelectionAccent: vi.fn(),
    rememberRecentColor: vi.fn(),
    copyJsonForAi: vi.fn(async () => undefined),
    pasteJsonFromAi: vi.fn(async () => undefined),
    openJsonEditor: vi.fn(),
  } satisfies ExtensionCommands;
  render(
    <TextCardMenu
      element={textCard()}
      position={{ left: 100, top: 100 }}
      closing={false}
      isMultiTarget={false}
      extensions={undefined}
      installedOnTargets={new Set()}
      extensionCommands={extensionCommands}
      recentColors={[]}
      actions={actions}
      {...props}
    />,
  );
  return { actions, extensionCommands };
}

describe("TextCardMenu", () => {
  it("opens the Extra Colors picker directly below Edit Text", async () => {
    const user = userEvent.setup();
    const { extensionCommands } = renderMenu({ installedOnTargets: new Set(["colorPicker"]) });

    const editText = screen.getByRole("menuitem", { name: "Edit Text" });
    const openPicker = screen.getByRole("menuitem", { name: "Open color picker" });
    expect(editText.compareDocumentPosition(openPicker) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await user.click(openPicker);
    const colorInput = screen.getByTitle("Visual color picker");
    expect(colorInput.closest("[data-color-picker-menu]")).toHaveAttribute("data-context-menu");
    fireEvent.change(colorInput, { target: { value: "#123456" } });
    expect(extensionCommands.updateSelectionAccent).toHaveBeenCalledWith(CARD_ID, "#123456");

    await user.click(screen.getByTitle("Close"));
    expect(extensionCommands.rememberRecentColor).toHaveBeenCalledWith("#123456");
  });

  it("starts editing, cuts, copies and removes the card by id", async () => {
    const user = userEvent.setup();
    const { actions } = renderMenu();

    await user.click(screen.getByRole("menuitem", { name: "Edit Text" }));
    await user.click(screen.getByRole("menuitem", { name: "Cut" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));

    expect(actions.onStartEdit).toHaveBeenCalledWith(CARD_ID);
    expect(actions.onCut).toHaveBeenCalledWith(CARD_ID);
    expect(actions.onCopy).toHaveBeenCalledWith(CARD_ID);
    expect(actions.onDelete).toHaveBeenCalledWith(CARD_ID);
  });

  it("names the selection in its actions when it targets several elements", () => {
    renderMenu({ isMultiTarget: true });

    expect(screen.getByRole("menuitem", { name: "Cut selected" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Remove selected" })).toBeInTheDocument();
  });

  it("saves the hyperlink draft prefilled with the card's link", async () => {
    const user = userEvent.setup();
    const { actions } = renderMenu({ element: textCard({ link: "https://example.com/" }) });

    await user.click(screen.getByRole("menuitem", { name: "Hyperlink" }));
    const field = screen.getByPlaceholderText("https://example.com or C:\\path\\file");
    expect(field).toHaveValue("https://example.com/");
    await user.clear(field);
    await user.type(field, "taskmap.app{Enter}");

    expect(actions.onUpdateLink).toHaveBeenCalledWith(CARD_ID, "taskmap.app");
  });

  it("offers layer order only on the canvas root, not inside a container", () => {
    renderMenu();
    expect(screen.getByLabelText("Bring to front")).toBeInTheDocument();
    cleanup();

    renderMenu({ element: textCard({ placement: { containerId: CONTAINER_ID, order: 0 } }) });
    expect(screen.queryByLabelText("Bring to front")).not.toBeInTheDocument();
  });

  it("offers installed extensions for removal", async () => {
    const user = userEvent.setup();
    const { extensionCommands } = renderMenu({ installedOnTargets: new Set(["checkbox"]) });

    expect(screen.queryByRole("menuitem", { name: "Lock" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Checkbox" }));

    expect(extensionCommands.remove).toHaveBeenCalledWith("checkbox", CARD_ID);
  });

  it("offers the lock toggle only when the card itself has a lock", () => {
    renderMenu({ installedOnTargets: new Set(["lock"]), isMultiTarget: true });

    expect(screen.queryByRole("menuitem", { name: /^(Locked|Unlocked)$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Lock" })).toBeInTheDocument();
  });
});

describe("TextCardMenu for mind-map nodes", () => {
  it("does not offer hyperlinks", () => {
    renderMenu({ element: mindMapNode() });

    expect(screen.queryByText("Hyperlink")).not.toBeInTheDocument();
  });

  it("toggles an installed lock above the color swatches for a selected group", async () => {
    const user = userEvent.setup();
    const { extensionCommands } = renderMenu({
      element: mindMapNode(),
      isMultiTarget: true,
      extensions: { lock: { enabled: true } },
      installedOnTargets: new Set(["lock"]),
    });

    const toggle = screen.getByRole("menuitem", { name: "Locked" });
    expect(toggle.querySelector(".tabler-icon-lock")).toBeInTheDocument();
    const firstSwatch = screen.getAllByTitle("Text card color")[0];
    expect(toggle.compareDocumentPosition(firstSwatch) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await user.click(toggle);
    expect(extensionCommands.toggle).toHaveBeenCalledWith("lock", CARD_ID);
  });
});
