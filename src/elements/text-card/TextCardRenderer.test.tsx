import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TextCardElement } from "../../types";
import { TextCardRenderer, type TextCardRendererProps } from "./TextCardRenderer";

const openExternalTarget = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../platform/opener/externalTargetClient", () => ({ openExternalTarget }));

afterEach(() => {
  cleanup();
  openExternalTarget.mockClear();
});

const card = (overrides: Partial<TextCardElement> = {}): TextCardElement => ({
  id: "card-1",
  text: "Build",
  x: 10,
  y: 20,
  accent: "#476FA8",
  ...overrides,
});

function renderCard(value: TextCardElement, props: Partial<TextCardRendererProps> = {}) {
  const handlers = {
    onDraftChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onStartMove: vi.fn(),
    onOpenMenu: vi.fn(),
    onToggleCheckbox: vi.fn(),
  };
  const { container } = render(
    <TextCardRenderer
      card={value}
      editing={false}
      draft=""
      shadowsUnderElements
      {...handlers}
      {...props}
    />,
  );
  const element = container.querySelector<HTMLElement>("[data-text-card-id='card-1']")!;
  return { container, element, ...handlers };
}

describe("TextCardRenderer", () => {
  it("draws the accent bar by default and a plain border without it", () => {
    expect(renderCard(card()).element).toHaveAttribute("data-accent-bar", "true");
    cleanup();
    const { element } = renderCard(card(), { accentBar: false });

    expect(element).toHaveAttribute("data-accent-bar", "false");
    expect(
      element
        .querySelector<HTMLElement>(".selection-overlay")
        ?.style.getPropertyValue("--selection-overlay-left"),
    ).toBe("-1px");
  });

  it("can remain interactive inside the pointer-transparent release layer", () => {
    const { element } = renderCard(card(), { forceInteractive: true, interactionDisabled: true });

    expect(element).toHaveAttribute("data-interaction", "forced");
  });

  it("lifts the held card from its top-left corner, and shows its true size once snapped", () => {
    expect(renderCard(card(), { dragging: true, dragPrimary: true }).element).toHaveAttribute(
      "data-drag",
      "primary",
    );
    cleanup();

    expect(
      renderCard(card(), { dragging: true, dragPrimary: true, dragAtTrueSize: true }).element,
    ).toHaveAttribute("data-drag", "primary-true-size");
  });

  it("stacks bundled cards behind the held card with their pickup offset and sway", () => {
    const { element } = renderCard(card(), {
      dragging: true,
      dragBundleIndex: 2,
      dragPickupX: 12,
      dragPickupY: -4,
      dragSwayX: 10,
    });

    expect(element).toHaveAttribute("data-drag", "bundle");
    expect(element.style.zIndex).toBe("9997");
    expect(element.style.getPropertyValue("--bundle-pickup-x")).toBe("12px");
    expect(element.style.transform).toContain("rotate(");
  });

  it("only animates moves while it is not being dragged", () => {
    expect(renderCard(card(), { settling: true }).element).toHaveAttribute(
      "data-motion",
      "settling",
    );
    cleanup();

    expect(renderCard(card(), { moving: true, dragging: true }).element).not.toHaveAttribute(
      "data-motion",
    );
  });

  it("starts a move from the card and opens the menu on right click", () => {
    const { element, onStartMove, onOpenMenu } = renderCard(card());

    fireEvent.pointerDown(element);
    fireEvent.contextMenu(element);

    expect(onStartMove).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "card-1" }),
    );
    expect(onOpenMenu).toHaveBeenCalledOnce();
  });

  it("saves the single-line editor on Enter and cancels on Escape", () => {
    const { onSave, onCancel } = renderCard(card(), { editing: true, draft: "Ship" });
    const editor = screen.getByRole("textbox");

    fireEvent.keyDown(editor, { key: "Enter" });
    fireEvent.keyDown(editor, { key: "Escape" });

    expect(onSave).toHaveBeenCalledWith("card-1");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("toggles an installed checkbox without starting a move, and strikes the text through", () => {
    const { onToggleCheckbox, onStartMove, element } = renderCard(
      card({ extensions: { checkbox: { checked: true } } }),
    );
    const checkbox = screen.getByRole("button", { pressed: true });

    fireEvent.pointerDown(checkbox);
    fireEvent.click(checkbox);

    expect(onToggleCheckbox).toHaveBeenCalledWith("card-1");
    expect(onStartMove).not.toHaveBeenCalled();
    expect(element.querySelector(".taskmap-text-card__text")).toHaveAttribute(
      "data-checked",
      "true",
    );
  });
});

describe("TextCardRenderer mind-map variant", () => {
  it("keeps Shift+Enter as a line break and saves on plain Enter", () => {
    const { onSave } = renderCard(card({ kind: "mindmap" }), {
      editing: true,
      draft: "First line\nSecond line",
      multiline: true,
      accentBar: false,
    });
    const editor = screen.getByRole("textbox");

    fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("card-1");
  });

  it("measures a trailing newline as an additional blank line", () => {
    const { container } = renderCard(card({ kind: "mindmap" }), {
      editing: true,
      draft: "First line\n",
      multiline: true,
    });

    expect(container.querySelector("[aria-hidden]")?.textContent).toBe("First line\n​");
  });

  it("renders neither text-card checkboxes nor hyperlinks", () => {
    const { container } = renderCard(
      card({
        kind: "mindmap",
        extensions: { checkbox: { checked: false } },
        link: "https://example.com/",
      }),
    );

    expect(container.querySelector(".tabler-icon-check")).not.toBeInTheDocument();
    expect(container.querySelector(".tabler-icon-link")).not.toBeInTheDocument();
  });
});

describe("TextCardRenderer hyperlinks", () => {
  it("opens the link from the text, while the icon stays a drag handle", () => {
    const { container, onStartMove } = renderCard(card({ link: "https://example.com/" }));
    const linkButton = screen.getByRole("button", { name: "Build" });
    const linkIcon = container.querySelector(".tabler-icon-link")!;

    expect(linkIcon.closest("button")).toBeNull();
    fireEvent.pointerDown(linkButton);
    expect(onStartMove).not.toHaveBeenCalled();
    fireEvent.click(linkButton);
    expect(openExternalTarget).toHaveBeenCalledWith("https://example.com/");

    fireEvent.pointerDown(linkIcon);
    expect(onStartMove).toHaveBeenCalledOnce();
  });

  it("turns the link into a drag handle while links are disabled", () => {
    const { onStartMove } = renderCard(card({ link: "https://example.com/" }), {
      linksDisabled: true,
    });
    const linkButton = screen.getByRole("button", { name: "Build" });

    fireEvent.pointerDown(linkButton);
    fireEvent.click(linkButton);

    expect(onStartMove).toHaveBeenCalledOnce();
    expect(openExternalTarget).not.toHaveBeenCalled();
  });
});
