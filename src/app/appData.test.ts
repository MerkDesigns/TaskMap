import { describe, expect, it } from "vitest";
import sharedAppDataFixture from "../../fixtures/app-data-v1.json";
import { DEFAULT_CONTAINER_ACCENT, DEFAULT_ELEMENT_COLORS } from "../constants";
import { normalizeAppData } from "./appData";

const preview = () => ({ width: 1280, height: 720 });

describe("app data migration and validation", () => {
  it("accepts the shared frontend/backend version 1 fixture", () => {
    const data = normalizeAppData(sharedAppDataFixture, preview);

    expect(data.schemaVersion).toBe(1);
    expect(data.activeCanvasId).toBe("canvas-fixture");
    expect(data.canvases[0].containers).toHaveLength(1);
    expect(data.canvases[0].textCards).toHaveLength(1);
    expect(data.canvases[0].textBlocks).toHaveLength(1);
    expect(data.canvases[0].images).toHaveLength(1);
    expect(data.defaultElementColors).toEqual(DEFAULT_ELEMENT_COLORS);
    expect(data.recentColors).toEqual([]);
    expect(data.shadowsUnderElements).toBe(false);
  });

  it("migrates legacy top-level content to schema version 1", () => {
    const data = normalizeAppData(
      {
        containers: [
          {
            id: "legacy-container",
            name: "Legacy",
            x: 10,
            y: 20,
            width: 300,
            height: 200,
            accent: DEFAULT_CONTAINER_ACCENT,
          },
        ],
        pan: { x: -20, y: -30 },
        zoom: 0.8,
      },
      preview,
    );

    expect(data.schemaVersion).toBe(1);
    expect(data.canvases[0].containers[0].id).toBe("legacy-container");
    expect(data.canvases[0].previewViewport).toEqual(preview());
  });

  it("fills safe defaults on unversioned canvas data", () => {
    const data = normalizeAppData(
      {
        activeCanvasId: "canvas-a",
        canvases: [
          {
            id: "canvas-a",
            name: "Canvas A",
            width: 3000,
            height: 3000,
            containers: [],
            pan: { x: 0, y: 0 },
            zoom: 1,
          },
        ],
        canvasGridStyle: "dots",
        canvasGridOpacity: { dots: 50, lines: 15 },
      },
      preview,
    );

    expect(data.schemaVersion).toBe(1);
    expect(data.canvases[0].textCards).toEqual([]);
    expect(data.discordRpcShowCanvas).toBe(true);
  });

  it("rejects future schemas and malformed canvases", () => {
    expect(() => normalizeAppData({ schemaVersion: 2 }, preview)).toThrow(
      "Unsupported TaskMap data schema version",
    );
    expect(() => normalizeAppData({ canvases: "broken" }, preview)).toThrow("Invalid TaskMap data");
  });

  it("does not silently repair malformed versioned data", () => {
    const current = structuredClone(sharedAppDataFixture);
    Reflect.deleteProperty(current.canvases[0], "images");

    expect(() => normalizeAppData(current, preview)).toThrow("Invalid TaskMap data");
  });

  it("repairs persisted zoom values below the supported minimum", () => {
    const current = structuredClone(sharedAppDataFixture);
    current.canvases[0].zoom = 0.45;

    expect(normalizeAppData(current, preview).canvases[0].zoom).toBe(0.5);
  });

  it("preserves customized default element colors", () => {
    const current = {
      ...structuredClone(sharedAppDataFixture),
      defaultElementColors: {
        container: "#111111",
        textCard: "#222222",
        textBlock: "#333333",
        image: "#444444",
      },
    };

    expect(normalizeAppData(current, preview).defaultElementColors).toEqual(
      current.defaultElementColors,
    );
  });

  it("removes the retired More Colors extension from saved elements", () => {
    const current = structuredClone(sharedAppDataFixture);
    Object.assign(current.canvases[0].containers[0].extensions, {
      colors: { enabled: true },
    });

    const normalized = normalizeAppData(current, preview);

    expect(normalized.canvases[0].containers[0].extensions).not.toHaveProperty("colors");
  });

  it("does not silently erase malformed legacy element collections", () => {
    expect(() =>
      normalizeAppData(
        {
          activeCanvasId: "canvas-a",
          canvases: [
            {
              id: "canvas-a",
              name: "Canvas A",
              width: 3000,
              height: 3000,
              containers: "broken",
              pan: { x: 0, y: 0 },
              zoom: 1,
            },
          ],
        },
        preview,
      ),
    ).toThrow("Invalid TaskMap data");
  });

  it("rejects duplicate element identifiers", () => {
    const duplicate = {
      id: "duplicate",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      accent: "#333",
    };

    expect(() =>
      normalizeAppData(
        {
          activeCanvasId: "canvas-a",
          canvases: [
            {
              id: "canvas-a",
              name: "Canvas A",
              width: 3000,
              height: 3000,
              containers: [{ ...duplicate, name: "Container" }],
              textBlocks: [{ ...duplicate, name: "Text", text: "Body" }],
              pan: { x: 0, y: 0 },
              zoom: 1,
            },
          ],
        },
        preview,
      ),
    ).toThrow("Element IDs must be unique");
  });
});
