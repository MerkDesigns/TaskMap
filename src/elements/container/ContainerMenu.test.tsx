import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asEntityId } from "../../domain/ids/entityIds";
import { mockExtensionCommands } from "../../extensions/extensionCommandsTestSupport";
import { ContainerMenu, type ContainerMenuActions, type ContainerMenuProps } from "./ContainerMenu";
import type { ContainerDocumentElement } from "./containerModel";

afterEach(cleanup);

const CONTAINER_ID = asEntityId("element", "element-00000000-0000-4000-8000-000000000001");

const container: ContainerDocumentElement = {
  id: CONTAINER_ID,
  canvasId: asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000002"),
  type: "container",
  geometry: { x: 0, y: 0, width: 400, height: 300 },
  data: { name: "Ideas", accent: "#A74144", headerButtonsVisible: true },
};

function renderMenu(props: Partial<ContainerMenuProps> = {}) {
  const actions = {
    onStartRename: vi.fn(),
    onUpdateAccent: vi.fn(),
    onCut: vi.fn(),
    onCopy: vi.fn(),
    onMoveLayer: vi.fn(),
    onDelete: vi.fn(),
  } satisfies ContainerMenuActions;
  const extensionCommands = mockExtensionCommands();
  render(
    <ContainerMenu
      element={container}
      position={{ left: 100, top: 100 }}
      closing={false}
      isMultiTarget={false}
      extensions={undefined}
      installedOnTargets={new Set()}
      extensionCommands={extensionCommands}
      actions={actions}
      {...props}
    />,
  );
  return { actions, extensionCommands };
}

describe("ContainerMenu", () => {
  it("renames, cuts, copies and removes the container by id", async () => {
    const user = userEvent.setup();
    const { actions } = renderMenu();

    await user.click(screen.getByRole("menuitem", { name: "Edit Container" }));
    await user.click(screen.getByRole("menuitem", { name: "Cut" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));

    expect(actions.onStartRename).toHaveBeenCalledWith(CONTAINER_ID);
    expect(actions.onCut).toHaveBeenCalledWith(CONTAINER_ID);
    expect(actions.onCopy).toHaveBeenCalledWith(CONTAINER_ID);
    expect(actions.onDelete).toHaveBeenCalledWith(CONTAINER_ID);
  });

  it("marks the element's accent and applies a preset", async () => {
    const user = userEvent.setup();
    const { actions } = renderMenu();
    const swatches = screen.getAllByRole("menuitem", { name: /Container accent/ });

    expect(swatches[0]).toHaveAttribute("aria-pressed", "true");
    expect(swatches[1]).toHaveAttribute("aria-pressed", "false");
    await user.click(swatches[1]);

    expect(actions.onUpdateAccent).toHaveBeenCalledWith(CONTAINER_ID, "#AA7234");
  });

  it("moves the container between layers", async () => {
    const user = userEvent.setup();
    const { actions } = renderMenu();

    await user.click(screen.getByLabelText("Bring to front"));

    expect(actions.onMoveLayer).toHaveBeenCalledWith(CONTAINER_ID, "front");
  });

  it("offers only installed extensions for removal", async () => {
    const user = userEvent.setup();
    const { extensionCommands } = renderMenu({
      installedOnTargets: new Set(["search", "inheritCardColor"]),
    });

    expect(screen.queryByRole("menuitem", { name: "Counter" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Inherit Card Color" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Search" }));

    expect(extensionCommands.remove).toHaveBeenCalledWith("search", CONTAINER_ID);
  });

  it("leaves lock and color controls to the container header", () => {
    renderMenu({
      extensions: { lock: { enabled: true }, colorPicker: { enabled: true } },
      installedOnTargets: new Set(["lock", "colorPicker"]),
    });

    expect(screen.queryByRole("menuitem", { name: "Locked" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Open color picker" })).not.toBeInTheDocument();
  });

  it("names the selection in its actions when it targets several elements", () => {
    renderMenu({ isMultiTarget: true });

    expect(screen.getByRole("menuitem", { name: "Copy selected" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Remove selected" })).toBeInTheDocument();
  });
});
