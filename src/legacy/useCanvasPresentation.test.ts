import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CanvasInteractionSnapshot } from "../app/interactions/canvasInteractionTypes";
import type { LegacyTextCardInteractionSnapshot } from "./interactions/legacyTextCardInteraction";
import { useCanvasPresentation, type CanvasPresentationInput } from "./useCanvasPresentation";
import type { RetainedInlineEdit } from "./useRetainedInlineEdit";

const none = { containers: [], textCards: [], textBlocks: [], images: [] };
const edit = (editingId: string | null = null, draft = ""): RetainedInlineEdit => ({
  editingId,
  draft,
  setDraft: vi.fn(),
  begin: vi.fn(),
  complete: vi.fn(),
  end: vi.fn(),
});

function present(
  interaction: Partial<CanvasInteractionSnapshot>,
  overrides: Partial<CanvasPresentationInput> = {},
) {
  const input: CanvasPresentationInput = {
    interaction: {
      activeInteraction: null,
      selectedIds: [],
      selectionPreviewIds: [],
      selectionRectangle: null,
      ...interaction,
    } as unknown as CanvasInteractionSnapshot,
    cardDrags: { active: null, release: null } as LegacyTextCardInteractionSnapshot,
    isCard: (id) => id.startsWith("card"),
    rename: edit(),
    cardEdit: edit(),
    blockEdit: edit(),
    marks: { entering: none, deleting: none, pulsing: none },
    shadowsUnderElements: false,
    recentColors: [],
    importingImageIds: [],
    ...overrides,
  };
  return renderHook(() => useCanvasPresentation(input)).result.current;
}

describe("useCanvasPresentation", () => {
  it("outlines the box selection preview, else a multi-selection, never a single element", () => {
    const rectangle = { x: 0, y: 0, width: 10, height: 10 };

    expect(
      present({ selectionRectangle: rectangle, selectionPreviewIds: ["a"] }).presentation
        .outlinedIds,
    ).toEqual(["a"]);
    expect(present({ selectedIds: ["a", "b"] }).presentation.outlinedIds).toEqual(["a", "b"]);
    expect(present({ selectedIds: ["a"] }).presentation.outlinedIds).toEqual([]);
    expect(present({ selectionRectangle: rectangle }).selectionVisible).toBe(true);
  });

  it("keeps selected, edited and dragged elements rendered when culled", () => {
    const { pinnedIds, draggedCardIds, presentation } = present(
      {
        selectedIds: ["a"],
        activeInteraction: { kind: "move", pointerId: 1, targetIds: ["card-1", "box"] },
      },
      { rename: edit("b", "Name"), cardEdit: edit("card-2", "Draft") },
    );

    expect([...pinnedIds].sort()).toEqual(["a", "b", "box", "card-1", "card-2"]);
    expect(draggedCardIds).toEqual(["card-1"]);
    expect(presentation.primaryMoveId).toBe("card-1");
    expect(presentation.textCardEdit).toEqual({ id: "card-2", draft: "Draft" });
  });

  it("hands held and settling cards to the overlay", () => {
    const { overlaidCardIds, releasingCardIds } = present(
      {},
      {
        cardDrags: {
          active: { ids: ["card-1"] },
          release: { cards: [{ card: { id: "card-2" } }] },
        } as unknown as LegacyTextCardInteractionSnapshot,
      },
    );

    expect(releasingCardIds).toEqual(["card-2"]);
    expect(overlaidCardIds).toEqual(["card-1", "card-2"]);
  });
});
