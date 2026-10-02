import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asEntityId } from "../../domain/ids/entityIds";
import { ImageMenu, type ImageMenuActions, type ImageMenuProps } from "./ImageMenu";
import type { ImageDocumentElement } from "./imageModel";

afterEach(cleanup);

const IMAGE_ID = asEntityId("element", "element-00000000-0000-4000-8000-000000000001");

const image = (data: Partial<ImageDocumentElement["data"]> = {}): ImageDocumentElement => ({
  id: IMAGE_ID,
  canvasId: asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000002"),
  type: "image",
  geometry: { x: 20, y: 30, width: 200, height: 120 },
  data: { mediaId: null, placement: null, accent: "#476FA8", background: true, ...data },
});

function renderMenu(props: Partial<ImageMenuProps> = {}) {
  const actions = {
    onReplace: vi.fn(),
    onUpdateAccent: vi.fn(),
    onToggleBackground: vi.fn(),
    onToggleLock: vi.fn(),
    onMoveLayer: vi.fn(),
    onCut: vi.fn(),
    onCopy: vi.fn(),
    onRemoveLock: vi.fn(),
    onDelete: vi.fn(),
  } satisfies ImageMenuActions;
  render(
    <ImageMenu
      element={image()}
      position={{ left: 100, top: 100 }}
      closing={false}
      isMultiTarget={false}
      lock={null}
      lockInstalled={false}
      actions={actions}
      {...props}
    />,
  );
  return actions;
}

describe("ImageMenu", () => {
  it("toggles an installed lock above the color swatches", async () => {
    const user = userEvent.setup();
    const actions = renderMenu({ lock: { enabled: false }, lockInstalled: true });

    const toggle = screen.getByRole("menuitem", { name: "Unlocked" });
    expect(toggle.querySelector(".tabler-icon-lock-open")).toBeInTheDocument();
    const firstSwatch = screen.getAllByTitle("Image frame color")[0];
    expect(toggle.compareDocumentPosition(firstSwatch) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await user.click(toggle);
    expect(actions.onToggleLock).toHaveBeenCalledWith(IMAGE_ID);
    await user.click(screen.getByRole("menuitem", { name: "Lock" }));
    expect(actions.onRemoveLock).toHaveBeenCalledWith(IMAGE_ID);
  });

  it("offers to hide the background, or to show it again", async () => {
    const user = userEvent.setup();
    const actions = renderMenu();
    await user.click(screen.getByRole("menuitem", { name: "Hide background" }));
    expect(actions.onToggleBackground).toHaveBeenCalledWith(IMAGE_ID);
    cleanup();

    renderMenu({ element: image({ background: false }) });
    expect(screen.getByRole("menuitem", { name: "Show background" })).toBeInTheDocument();
  });

  it("replaces, cuts, copies and removes the image by id", async () => {
    const user = userEvent.setup();
    const actions = renderMenu();

    await user.click(screen.getByRole("menuitem", { name: "Replace image" }));
    await user.click(screen.getByRole("menuitem", { name: "Cut" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));

    expect(actions.onReplace).toHaveBeenCalledWith(IMAGE_ID);
    expect(actions.onCut).toHaveBeenCalledWith(IMAGE_ID);
    expect(actions.onCopy).toHaveBeenCalledWith(IMAGE_ID);
    expect(actions.onDelete).toHaveBeenCalledWith(IMAGE_ID);
  });
});
