import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asEntityId } from "../../domain/ids/entityIds";
import type { ContainerDocumentElement } from "./containerModel";
import { ContainerRenderer } from "./ContainerRenderer";
import type { ExtensionCommands } from "../../extensions/headerControl";
import type { ContainerActions, ContainerViewState } from "./containerView";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

afterEach(cleanup);

/** jsdom has no PointerEvent, so the generic event it creates carries no button or modifiers. */
function pressPrimary(target: Element) {
  const event = createEvent.pointerDown(target);
  Object.defineProperty(event, "button", { value: 0 });
  Object.defineProperty(event, "shiftKey", { value: false });
  fireEvent(target, event);
}

const CONTAINER_ID = asEntityId("element", "element-00000000-0000-4000-8000-000000000001");
const CANVAS_ID = asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000002");

const container = (
  data: Partial<ContainerDocumentElement["data"]> = {},
): ContainerDocumentElement => ({
  id: CONTAINER_ID,
  canvasId: CANVAS_ID,
  type: "container",
  geometry: { x: 10, y: 20, width: 400, height: 300 },
  data: { name: "Ideas", accent: "#c0604e", headerButtonsVisible: true, ...data },
});

function renderContainer(
  element: ContainerDocumentElement,
  view: Partial<ContainerViewState> = {},
) {
  const handlers = {
    onRenameDraftChange: vi.fn(),
    onSaveRename: vi.fn(),
    onCancelRename: vi.fn(),
    onSelect: vi.fn(),
    onStartMove: vi.fn(),
    onStartResize: vi.fn(),
    onToggleMenu: vi.fn(),
    onHeaderButtonsVisibleChange: vi.fn(),
    onSearchChange: vi.fn(),
    onOpenContentMenu: vi.fn(),
    onWheelContent: vi.fn(),
    onStartContentSelection: vi.fn(),
  } satisfies ContainerActions;
  const extensionCommands = {
    toggle: vi.fn(),
    updateAccent: vi.fn(),
    rememberRecentColor: vi.fn(),
    copyJsonForAi: vi.fn(async () => undefined),
    pasteJsonFromAi: vi.fn(async () => undefined),
    openJsonEditor: vi.fn(),
  } satisfies ExtensionCommands;
  const { container: root } = render(
    <ContainerRenderer
      element={element}
      actions={handlers}
      extensionCommands={extensionCommands}
      view={{
        layer: 0,
        geometry: element.geometry,
        extensions: undefined,
        cardCount: 3,
        selected: false,
        multiSelected: false,
        entering: false,
        deleting: false,
        moving: false,
        shadowsUnderElements: true,
        recentColors: [],
        renaming: false,
        renameDraft: "",
        contentRevision: {},
        contentEditRevision: "",
        ...view,
      }}
    />,
  );
  const article = root.querySelector<HTMLElement>(".taskmap-container")!;
  return { article, extensionCommands, ...handlers };
}

describe("ContainerRenderer", () => {
  it("draws the container at its position in its accent colour", () => {
    const { article } = renderContainer(container());

    expect(screen.getByText("Ideas")).toBeInTheDocument();
    expect(article.style.translate).toBe("10px 20px");
    expect(article.style.width).toBe("400px");
    expect(article.style.backgroundColor).toBe("rgb(192, 96, 78)");
  });

  it("selects on a press and moves the whole group while several elements are selected", () => {
    const single = renderContainer(container());
    pressPrimary(single.article);
    expect(single.onSelect).toHaveBeenCalledWith(CONTAINER_ID, false);
    cleanup();

    const group = renderContainer(container(), { multiSelected: true });
    pressPrimary(group.article);
    expect(group.onStartMove).toHaveBeenCalledOnce();
    expect(group.onSelect).not.toHaveBeenCalled();
  });

  it("starts a move from the header and opens the menu from its button", () => {
    const { onStartMove, onToggleMenu } = renderContainer(container());

    fireEvent.pointerDown(screen.getByText("Ideas"));
    fireEvent.click(screen.getByTitle("Container menu"));

    expect(onStartMove).toHaveBeenCalledOnce();
    expect(onToggleMenu).toHaveBeenCalledOnce();
  });

  it("saves the rename on Enter and cancels on Escape", () => {
    const { onSaveRename, onCancelRename } = renderContainer(container(), {
      renaming: true,
      renameDraft: "Plans",
    });
    const input = screen.getByDisplayValue("Plans");

    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onSaveRename).toHaveBeenCalledWith(CONTAINER_ID);
    expect(onCancelRename).toHaveBeenCalledOnce();
  });

  it("filters through an installed search field and clears it", () => {
    const { article, onSearchChange } = renderContainer(container(), {
      extensions: { search: { query: "milk" } },
    });

    expect(article).toHaveAttribute("data-search", "true");
    fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "eggs" } });
    fireEvent.click(screen.getByTitle("Clear search"));

    expect(onSearchChange).toHaveBeenNthCalledWith(1, CONTAINER_ID, "eggs");
    expect(onSearchChange).toHaveBeenNthCalledWith(2, CONTAINER_ID, "");
  });

  // jsdom has no layout, so every extension button sits in the overflow popover.
  it("toggles lock and privacy from their header buttons and blurs hidden content", () => {
    const { article, extensionCommands } = renderContainer(container(), {
      extensions: { lock: { enabled: true }, privacy: { enabled: true } },
    });

    fireEvent.click(screen.getByTitle("More extensions"));
    fireEvent.click(screen.getByTitle("Unlock"));
    fireEvent.click(screen.getByTitle("Show content"));

    expect(extensionCommands.toggle).toHaveBeenCalledWith("lock", CONTAINER_ID);
    expect(extensionCommands.toggle).toHaveBeenCalledWith("privacy", CONTAINER_ID);
    expect(article.querySelector(".taskmap-container__content")).toHaveAttribute(
      "data-privacy-hidden",
      "true",
    );
  });

  it("keeps a panel opened from the overflow popover after the popover closes", () => {
    const { extensionCommands } = renderContainer(container(), {
      extensions: { lock: { enabled: false }, colorPicker: { enabled: true } },
    });

    fireEvent.click(screen.getByTitle("More extensions"));
    fireEvent.click(screen.getByTitle("Open color picker"));

    expect(screen.queryByTitle("Lock")).not.toBeInTheDocument();
    const picker = screen.getByTitle("Visual color picker");
    fireEvent.change(picker, { target: { value: "#123456" } });
    expect(extensionCommands.updateAccent).toHaveBeenCalledWith(CONTAINER_ID, "#123456");
  });

  it("counts its cards and opens the Copy/Paste JSON actions", () => {
    const { extensionCommands } = renderContainer(container(), {
      extensions: { counter: { enabled: true }, copyPasteJson: { enabled: true } },
    });

    fireEvent.click(screen.getByTitle("More extensions"));
    expect(screen.getByTitle("3 cards")).toHaveTextContent("3");
    fireEvent.click(screen.getByTitle("Copy/Paste JSON"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Open JSON editor" }));

    expect(extensionCommands.openJsonEditor).toHaveBeenCalledWith(CONTAINER_ID);
  });

  it("opens the content menu on right click, except while part of a group selection", () => {
    const single = renderContainer(container());
    fireEvent.contextMenu(single.article.querySelector(".taskmap-container__content")!);
    expect(single.onOpenContentMenu).toHaveBeenCalledOnce();
    cleanup();

    const group = renderContainer(container(), { multiSelected: true });
    fireEvent.contextMenu(group.article.querySelector(".taskmap-container__content")!);
    expect(group.onOpenContentMenu).not.toHaveBeenCalled();
  });

  it("is placed by translation at its shown position, so moves never re-lay it out", () => {
    const { article } = renderContainer(container(), {
      geometry: { x: 90, y: 120, width: 500, height: 260 },
    });

    expect(article.style.left).toBe("0px");
    expect(article.style.translate).toBe("90px 120px");
    expect(article.style.width).toBe("500px");
  });
});
