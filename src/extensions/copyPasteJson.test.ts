import { describe, expect, it } from "vitest";
import { createInitialCanvasHistory, pushCanvasHistorySnapshot } from "../app/history";
import { DEFAULT_ELEMENT_COLORS } from "../constants";
import type { ContainerElement, TaskCanvas, TextCardElement } from "../types";
import {
  COPY_PASTE_JSON_INSTRUCTION,
  parseCopyPasteJson,
  replaceContainerFromAiJson,
  serializeContainerForAi,
} from "./copyPasteJson";

const container: ContainerElement = {
  id: "container-a",
  name: "Ideas",
  x: 120,
  y: 240,
  width: 480,
  height: 320,
  accent: "#123456",
  extensions: {
    copyPasteJson: { enabled: true },
    lock: { enabled: true },
    pickCard: { selectedCardId: "card-a" },
  },
};

const cards: TextCardElement[] = [
  {
    id: "card-a",
    text: "First",
    accent: "#ABCDEF",
    link: "https://example.com/first",
    x: 0,
    y: 0,
    containerId: container.id,
    order: 0,
  },
  {
    id: "card-b",
    text: "Second",
    accent: "#FEDCBA",
    x: 0,
    y: 0,
    containerId: container.id,
    order: 1,
  },
];

const canvas: TaskCanvas = {
  id: "canvas-a",
  name: "Canvas",
  width: 3000,
  height: 3000,
  containers: [container],
  textCards: cards,
  textBlocks: [],
  images: [],
  mindmapConnections: [],
  pan: { x: 0, y: 0 },
  zoom: 1,
};

const createReplaceOptions = () => {
  let nextId = 0;
  return {
    createCardId: () => `new-card-${nextId++}`,
    headerHeight: 48,
    searchHeight: 42,
    cardPadding: 17,
    cardRowHeight: 43,
    cardGap: 8,
  };
};

describe("Copy/Paste JSON extension", () => {
  it("serializes the container and ordered card fields for AI", () => {
    expect(JSON.parse(serializeContainerForAi(container, cards))).toEqual({
      instruction: COPY_PASTE_JSON_INSTRUCTION,
      name: "Ideas",
      color: "#123456",
      cards: [
        {
          text: "First",
          color: "#ABCDEF",
          hyperlink: "https://example.com/first",
        },
        { text: "Second", color: "#FEDCBA", hyperlink: null },
      ],
    });
  });

  it("rejects invalid JSON and non-HTTP hyperlinks", () => {
    expect(parseCopyPasteJson("not JSON")).toEqual({
      success: false,
      error: "Clipboard does not contain valid JSON.",
    });

    const result = parseCopyPasteJson(
      JSON.stringify({
        instruction: COPY_PASTE_JSON_INSTRUCTION,
        name: "Ideas",
        color: "#123456",
        cards: [{ text: "Card", color: "#ABCDEF", hyperlink: "ftp://example.com" }],
      }),
    );
    expect(result).toEqual({
      success: false,
      error: "Card 1 hyperlink must use HTTP or HTTPS.",
    });
  });

  it("accepts null when a card has no hyperlink", () => {
    const result = parseCopyPasteJson(
      JSON.stringify({
        instruction: COPY_PASTE_JSON_INSTRUCTION,
        name: "Ideas",
        color: "#123456",
        cards: [{ text: "Card", color: "#ABCDEF", hyperlink: null }],
      }),
    );

    expect(result).toEqual({
      success: true,
      data: {
        instruction: COPY_PASTE_JSON_INSTRUCTION,
        name: "Ideas",
        color: "#123456",
        cards: [{ text: "Card", color: "#ABCDEF", hyperlink: null }],
      },
    });
  });

  it("replaces only the editable container fields and its cards", () => {
    const result = replaceContainerFromAiJson(
      canvas,
      container.id,
      {
        instruction: COPY_PASTE_JSON_INSTRUCTION,
        name: "Updated ideas",
        color: "#654321",
        cards: [{ text: "Replacement", color: "#112233", hyperlink: "https://example.com" }],
      },
      createReplaceOptions(),
    );

    expect(result).not.toBeNull();
    expect(result?.containers[0]).toMatchObject({
      id: container.id,
      name: "Updated ideas",
      accent: "#654321",
      x: container.x,
      y: container.y,
      width: container.width,
      height: container.height,
      extensions: {
        copyPasteJson: { enabled: true },
        lock: { enabled: true },
        pickCard: { selectedCardId: "new-card-0" },
      },
    });
    expect(result?.textCards).toEqual([
      {
        id: "new-card-0",
        text: "Replacement",
        accent: "#112233",
        link: "https://example.com",
        x: container.x + 17,
        y: container.y + 48 + 17,
        containerId: container.id,
        order: 0,
      },
    ]);
  });

  it("records the atomic replacement as one undoable canvas snapshot", () => {
    const replacement = replaceContainerFromAiJson(
      canvas,
      container.id,
      {
        instruction: COPY_PASTE_JSON_INSTRUCTION,
        name: "Undoable update",
        color: "#654321",
        cards: [{ text: "New card", color: "#112233", hyperlink: null }],
      },
      createReplaceOptions(),
    );
    expect(replacement).not.toBeNull();

    const initial = createInitialCanvasHistory(canvas);
    const pushed = pushCanvasHistorySnapshot(
      initial.historyByCanvasId,
      initial.historyIndexByCanvasId,
      {
        schemaVersion: 2,
        activeCanvasId: canvas.id,
        canvases: [replacement!],
        canvasGridStyle: "dots",
        canvasGridOpacity: { dots: 50, lines: 15 },
        defaultElementColors: DEFAULT_ELEMENT_COLORS,
        recentColors: [],
        shadowsUnderElements: false,
        allowLockedElementDeletion: true,
        discordRpcEnabled: false,
        discordRpcShowCanvas: true,
        minimapEnabled: true,
        privacyModeEnabled: false,
        toolbarButtonsVisible: false,
      },
    );

    expect(pushed?.historyByCanvasId[canvas.id]).toHaveLength(2);
    expect(pushed?.historyByCanvasId[canvas.id][0].containers[0].name).toBe("Ideas");
    expect(pushed?.historyByCanvasId[canvas.id][0].textCards).toEqual(cards);
  });
});
