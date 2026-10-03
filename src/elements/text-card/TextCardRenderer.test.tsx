import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asEntityId } from "../../domain/ids/entityIds";
import type { MindMapNodeDocumentElement } from "../mind-map/mindMapModel";
import type { TextCardDocumentElement } from "./textCardModel";
import type { ExtensionCommands } from "../../extensions/extensionCommands";
import {
  TextCardRenderer,
  type TextCardActions,
  type TextCardRendererElement,
  type TextCardViewState,
} from "./TextCardRenderer";

const openExternalTarget = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../platform/opener/externalTargetClient", () => ({ openExternalTarget }));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

afterEach(() => {
  cleanup();
  openExternalTarget.mockClear();
});

const CARD_ID = asEntityId("element", "element-00000000-0000-4000-8000-000000000001");
const CANVAS_ID = asEntityId("canvas", "canvas-00000000-0000-4000-8000-000000000002");

const textCard = (
  data: Partial<TextCardDocumentElement["data"]> = {},
): TextCardDocumentElement => ({
  id: CARD_ID,
  canvasId: CANVAS_ID,
  type: "text-card",
  geometry: { x: 10, y: 20, width: 120, height: 40 },
  data: { text: "Build", accent: "#476FA8", link: null, placement: null, ...data },
});

const mindMapNode = (): MindMapNodeDocumentElement => ({
  id: CARD_ID,
  canvasId: CANVAS_ID,
  type: "mind-map-node",
  geometry: { x: 10, y: 20, width: 120, height: 40 },
  data: { text: "Idea", accent: "#476FA8" },
});

function createActions(): { [Key in keyof TextCardActions]: ReturnType<typeof vi.fn> } {
  return {
    onDraftChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onStartMove: vi.fn(),
    onOpenMenu: vi.fn(),
    onSizeChange: vi.fn(),
  };
}

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

function renderCard(element: TextCardRendererElement, view: Partial<TextCardViewState> = {}) {
  const actions = createActions();
  extensionCommands.toggle.mockClear();
  const fullView: TextCardViewState = {
    layer: 0,
    extensions: undefined,
    editing: false,
    draft: "",
    shadowsUnderElements: true,
    ...view,
  };
  const result = render(
    <TextCardRenderer
      element={element}
      view={fullView}
      actions={actions as unknown as TextCardActions}
      extensionCommands={extensionCommands}
    />,
  );
  const card = result.container.querySelector<HTMLElement>(`[data-text-card-id='${CARD_ID}']`)!;
  return { ...result, card, actions, fullView };
}

describe("TextCardRenderer", () => {
  it("renders the element's text at its document position", () => {
    const { card } = renderCard(textCard());

    expect(card).toHaveTextContent("Build");
    expect(card.style.left).toBe("10px");
    expect(card.style.top).toBe("20px");
    expect(card).toHaveAttribute("data-accent-bar", "true");
  });

  it("can remain interactive inside the pointer-transparent release layer", () => {
    expect(renderCard(textCard(), { interaction: "forced" }).card).toHaveAttribute(
      "data-interaction",
      "forced",
    );
  });

  it("lifts the held card from its top-left corner, and shows its true size once snapped", () => {
    const drag = {
      primary: true,
      atTrueSize: false,
      bundleIndex: 0,
      pickupX: 0,
      pickupY: 0,
      swayX: 0,
      swayY: 0,
    };
    expect(renderCard(textCard(), { drag }).card).toHaveAttribute("data-drag", "primary");
    cleanup();

    expect(renderCard(textCard(), { drag: { ...drag, atTrueSize: true } }).card).toHaveAttribute(
      "data-drag",
      "primary-true-size",
    );
  });

  it("stacks bundled cards behind the held card with their pickup offset and sway", () => {
    const { card } = renderCard(textCard(), {
      drag: {
        primary: false,
        atTrueSize: false,
        bundleIndex: 2,
        pickupX: 12,
        pickupY: -4,
        swayX: 10,
        swayY: 0,
      },
    });

    expect(card).toHaveAttribute("data-drag", "bundle");
    expect(card.style.zIndex).toBe("9997");
    expect(card.style.getPropertyValue("--bundle-pickup-x")).toBe("12px");
    expect(card.style.transform).toContain("rotate(");
  });

  it("only animates moves while it is not being dragged", () => {
    expect(renderCard(textCard(), { motion: "settling" }).card).toHaveAttribute(
      "data-motion",
      "settling",
    );
    cleanup();

    const drag = {
      primary: true,
      atTrueSize: false,
      bundleIndex: 0,
      pickupX: 0,
      pickupY: 0,
      swayX: 0,
      swayY: 0,
    };
    expect(renderCard(textCard(), { motion: "moving", drag }).card).not.toHaveAttribute(
      "data-motion",
    );
  });

  it("starts a move from the card and opens the menu on right click", () => {
    const { card, actions } = renderCard(textCard());

    fireEvent.pointerDown(card);
    fireEvent.contextMenu(card);

    expect(actions.onStartMove).toHaveBeenCalledWith(expect.anything(), CARD_ID);
    expect(actions.onOpenMenu).toHaveBeenCalledWith(expect.anything(), CARD_ID);
  });

  it("saves the single-line editor on Enter and cancels on Escape", () => {
    const { actions } = renderCard(textCard(), { editing: true, draft: "Ship" });
    const editor = screen.getByRole("textbox");

    fireEvent.keyDown(editor, { key: "Enter" });
    fireEvent.keyDown(editor, { key: "Escape" });

    expect(actions.onSave).toHaveBeenCalledWith(CARD_ID);
    expect(actions.onCancel).toHaveBeenCalledOnce();
  });

  it("toggles an installed checkbox without starting a move, and strikes the text through", () => {
    const { actions, card } = renderCard(textCard(), {
      extensions: { checkbox: { checked: true } },
    });
    const checkbox = screen.getByRole("button", { pressed: true });

    fireEvent.pointerDown(checkbox);
    fireEvent.click(checkbox);

    expect(extensionCommands.toggle).toHaveBeenCalledWith("checkbox", CARD_ID);
    expect(actions.onStartMove).not.toHaveBeenCalled();
    expect(card.querySelector(".taskmap-text-card__text")).toHaveAttribute(
      "data-text-state",
      "done",
    );
  });

  it("shows no checkbox when none is installed", () => {
    renderCard(textCard());

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("follows changes to its view position and element text", () => {
    const { card, rerender, actions, fullView } = renderCard(textCard());
    const element = textCard();
    const draw = (next: TextCardViewState, nextElement = element) =>
      rerender(
        <TextCardRenderer
          element={nextElement}
          view={next}
          actions={actions as unknown as TextCardActions}
          extensionCommands={extensionCommands}
        />,
      );

    draw({ ...fullView, position: { x: 30, y: 40 } });
    expect(card.style.left).toBe("30px");
    draw({ ...fullView, position: { x: 30, y: 40 } });
    expect(card.style.left).toBe("30px");
    draw({ ...fullView, position: { x: 30, y: 40 } }, textCard({ text: "Renamed" }));
    expect(screen.getByText("Renamed")).toBeInTheDocument();
  });
});

describe("TextCardRenderer mind-map variant", () => {
  it("draws no accent bar and lets its content overflow", () => {
    const { card } = renderCard(mindMapNode());

    expect(card).toHaveAttribute("data-accent-bar", "false");
    expect(card).toHaveAttribute("data-overflow", "visible");
    expect(
      card
        .querySelector<HTMLElement>(".selection-overlay")
        ?.style.getPropertyValue("--selection-overlay-left"),
    ).toBe("-1px");
  });

  it("keeps Shift+Enter as a line break and saves on plain Enter", () => {
    const { actions } = renderCard(mindMapNode(), {
      editing: true,
      draft: "First line\nSecond line",
    });
    const editor = screen.getByRole("textbox");

    fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
    expect(actions.onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(actions.onSave).toHaveBeenCalledWith(CARD_ID);
  });

  it("measures a trailing newline as an additional blank line", () => {
    const { container } = renderCard(mindMapNode(), { editing: true, draft: "First line\n" });

    expect(container.querySelector("[aria-hidden]")?.textContent).toBe(
      `First line\n${String.fromCharCode(0x200b)}`,
    );
  });

  it("never renders a checkbox", () => {
    renderCard(mindMapNode(), { extensions: { checkbox: { checked: false } } });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("TextCardRenderer hyperlinks", () => {
  it("opens the link from the text, while the icon stays a drag handle", () => {
    const { container, actions } = renderCard(textCard({ link: "https://example.com/" }));
    const linkButton = screen.getByRole("button", { name: "Build" });
    const linkIcon = container.querySelector(".tabler-icon-link")!;

    expect(linkIcon.closest("button")).toBeNull();
    fireEvent.pointerDown(linkButton);
    expect(actions.onStartMove).not.toHaveBeenCalled();
    fireEvent.click(linkButton);
    expect(openExternalTarget).toHaveBeenCalledWith("https://example.com/");

    fireEvent.pointerDown(linkIcon);
    expect(actions.onStartMove).toHaveBeenCalledOnce();
  });

  it("turns the link into a drag handle while links are disabled", () => {
    const { actions } = renderCard(textCard({ link: "https://example.com/" }), {
      linksDisabled: true,
    });
    const linkButton = screen.getByRole("button", { name: "Build" });

    fireEvent.pointerDown(linkButton);
    fireEvent.click(linkButton);

    expect(actions.onStartMove).toHaveBeenCalledOnce();
    expect(openExternalTarget).not.toHaveBeenCalled();
  });
});
