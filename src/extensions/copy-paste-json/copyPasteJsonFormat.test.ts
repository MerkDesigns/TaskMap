import { describe, expect, it } from "vitest";
import type { ContainerElement, TextCardElement } from "../../types";
import {
  COPY_PASTE_JSON_INSTRUCTION,
  parseCopyPasteJson,
  serializeContainerForAi,
} from "./copyPasteJsonFormat";

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
});
