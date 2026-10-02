import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asEntityId } from "../../domain/ids/entityIds";
import type { ContainerDocumentElement } from "./containerModel";
import { ContainerRenderer } from "./ContainerRenderer";
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
    onTogglePrivacy: vi.fn(),
    onToggleLock: vi.fn(),
    onUpdateAccent: vi.fn(),
    onRememberRecentColor: vi.fn(),
    onCopyJsonForAi: vi.fn(async () => undefined),
    onPasteJsonFromAi: vi.fn(async () => undefined),
    onOpenJsonEditor: vi.fn(),
    onHeaderButtonsVisibleChange: vi.fn(),
    onSearchChange: vi.fn(),
    onOpenContentMenu: vi.fn(),
    onWheelContent: vi.fn(),
    onStartContentSelection: vi.fn(),
  } satisfies ContainerActions;
  const { container: root } = render(
    <ContainerRenderer
      element={element}
      actions={handlers}
      view={{
        layer: 0,
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
  return { article, ...handlers };
}

describe("ContainerRenderer", () => {
  it("draws the container at its position in its accent colour", () => {
    const { article } = renderContainer(container());

    expect(screen.getByText("Ideas")).toBeInTheDocument();
    expect(article.style.left).toBe("10px");
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
    const { article, onToggleLock, onTogglePrivacy } = renderContainer(container(), {
      extensions: { lock: { enabled: true }, privacy: { enabled: true } },
    });

    fireEvent.click(screen.getByTitle("More extensions"));
    fireEvent.click(screen.getByTitle("Unlock"));
    fireEvent.click(screen.getByTitle("Show content"));

    expect(onToggleLock).toHaveBeenCalledWith(CONTAINER_ID);
    expect(onTogglePrivacy).toHaveBeenCalledWith(CONTAINER_ID);
    expect(article.querySelector(".taskmap-container__content")).toHaveAttribute(
      "data-privacy-hidden",
      "true",
    );
  });

  it("counts its cards and opens the Copy/Paste JSON actions", () => {
    const { onOpenJsonEditor } = renderContainer(container(), {
      extensions: { counter: { enabled: true }, copyPasteJson: { enabled: true } },
    });

    fireEvent.click(screen.getByTitle("More extensions"));
    expect(screen.getByTitle("3 cards")).toHaveTextContent("3");
    fireEvent.click(screen.getByTitle("Copy/Paste JSON"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Open JSON editor" }));

    expect(onOpenJsonEditor).toHaveBeenCalledWith(CONTAINER_ID);
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
});
