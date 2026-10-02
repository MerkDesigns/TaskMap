import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asEntityId } from "../../domain/ids/entityIds";
import type { TextBlockDocumentElement } from "./textBlockModel";
import { TextBlockRenderer } from "./TextBlockRenderer";
import type { TextBlockActions, TextBlockViewState } from "./textBlockView";

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

const BLOCK_ID = asEntityId("element", "element-00000000-0000-4000-8000-000000000001");

const textBlock = (
  data: Partial<TextBlockDocumentElement["data"]> = {},
): TextBlockDocumentElement => ({
  id: BLOCK_ID,
  canvasId: asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000002"),
  type: "text-block",
  geometry: { x: 10, y: 20, width: 340, height: 230 },
  data: {
    name: "Notes",
    text: "Plain body",
    accent: "#4a6fa5",
    headerButtonsVisible: true,
    ...data,
  },
});

function renderTextBlock(
  element: TextBlockDocumentElement,
  view: Partial<TextBlockViewState> = {},
) {
  const actions = {
    onDraftChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onRenameDraftChange: vi.fn(),
    onSaveRename: vi.fn(),
    onCancelRename: vi.fn(),
    onStartEdit: vi.fn(),
    onSelect: vi.fn(),
    onStartMove: vi.fn(),
    onStartResize: vi.fn(),
    onToggleMenu: vi.fn(),
    onTogglePrivacy: vi.fn(),
    onToggleLock: vi.fn(),
    onUpdateAccent: vi.fn(),
    onRememberRecentColor: vi.fn(),
    onHeaderButtonsVisibleChange: vi.fn(),
  } satisfies TextBlockActions;
  const { container } = render(
    <TextBlockRenderer
      element={element}
      actions={actions}
      view={{
        layer: 0,
        extensions: undefined,
        selected: false,
        multiSelected: false,
        entering: false,
        deleting: false,
        pulsing: false,
        moving: false,
        shadowsUnderElements: true,
        recentColors: [],
        editing: false,
        draft: "",
        renaming: false,
        renameDraft: "",
        ...view,
      }}
    />,
  );
  const article = container.querySelector<HTMLElement>(".taskmap-text-block")!;
  return { article, actions };
}

describe("TextBlockRenderer", () => {
  it("draws its name and body at the element's position", async () => {
    const { article } = renderTextBlock(textBlock());

    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(await screen.findByText("Plain body")).toBeInTheDocument();
    expect(article.style.left).toBe("10px");
    expect(article.style.height).toBe("230px");
  });

  it("selects from the body, and moves the group while several elements are selected", () => {
    const single = renderTextBlock(textBlock());
    pressPrimary(single.article.querySelector(".taskmap-text-block__content")!);
    expect(single.actions.onSelect).toHaveBeenCalledWith(BLOCK_ID, false);
    cleanup();

    const group = renderTextBlock(textBlock(), { multiSelected: true });
    pressPrimary(group.article.querySelector(".taskmap-text-block__content")!);
    expect(group.actions.onStartMove).toHaveBeenCalledOnce();
    expect(group.actions.onSelect).not.toHaveBeenCalled();
  });

  it("starts editing on double click and cancels the editor on Escape", () => {
    const viewing = renderTextBlock(textBlock());
    fireEvent.doubleClick(viewing.article.querySelector(".taskmap-text-block__content")!);
    expect(viewing.actions.onStartEdit).toHaveBeenCalledWith(BLOCK_ID);
    cleanup();

    const editing = renderTextBlock(textBlock(), { editing: true, draft: "Draft" });
    const editor = screen.getByDisplayValue("Draft");
    fireEvent.change(editor, { target: { value: "Draft 2" } });
    fireEvent.keyDown(editor, { key: "Escape" });

    expect(editing.actions.onDraftChange).toHaveBeenCalledWith("Draft 2");
    expect(editing.actions.onCancel).toHaveBeenCalledOnce();
  });

  it("saves a rename on Enter", () => {
    const { actions } = renderTextBlock(textBlock(), { renaming: true, renameDraft: "Plans" });

    fireEvent.keyDown(screen.getByDisplayValue("Plans"), { key: "Enter" });

    expect(actions.onSaveRename).toHaveBeenCalledWith(BLOCK_ID);
  });

  it("opens its menu and toggles installed extensions from the overflow popover", () => {
    const { article, actions } = renderTextBlock(textBlock(), {
      extensions: { lock: { enabled: false }, privacy: { enabled: true } },
    });

    fireEvent.click(screen.getByTitle("Text block menu"));
    // jsdom has no layout, so every extension button sits in the overflow popover.
    fireEvent.click(screen.getByTitle("More extensions"));
    fireEvent.click(screen.getByTitle("Lock"));
    fireEvent.click(screen.getByTitle("Show content"));

    expect(actions.onToggleMenu).toHaveBeenCalledOnce();
    expect(actions.onToggleLock).toHaveBeenCalledWith(BLOCK_ID);
    expect(actions.onTogglePrivacy).toHaveBeenCalledWith(BLOCK_ID);
    expect(article.querySelector(".taskmap-text-block__content")).toHaveAttribute(
      "data-privacy-hidden",
      "true",
    );
  });
});
