import { describe, expect, it } from "vitest";
import sharedAppDataFixture from "../../examples/app-data-v1.json";
import { DEFAULT_CONTAINER_ACCENT, DEFAULT_ELEMENT_COLORS } from "../constants";
import type { AppData } from "../types";
import { normalizeAppData } from "./appData";

const preview = () => ({ width: 1280, height: 720 });

describe("app data migration and validation", () => {
  it("migrates the shared frontend/backend version 1 fixture", () => {
    const data = normalizeAppData(sharedAppDataFixture, preview);

    expect(data.schemaVersion).toBe(2);
    expect(data.activeCanvasId).toBe("canvas-fixture");
    expect(data.canvases[0].containers).toHaveLength(1);
    expect(data.canvases[0].textCards).toHaveLength(1);
    expect(data.canvases[0].textCards[0].link).toBe("https://example.com");
    expect(data.canvases[0].textBlocks).toHaveLength(1);
    expect(data.canvases[0].images).toHaveLength(1);
    expect(data.canvases[0]).not.toHaveProperty("mindmaps");
    expect(data.canvases[0].mindmapConnections).toEqual([]);
    expect(data.defaultElementColors).toEqual(DEFAULT_ELEMENT_COLORS);
    expect(data.recentColors).toEqual([]);
    expect(data.shadowsUnderElements).toBe(false);
    expect(data.allowLockedElementDeletion).toBe(true);
  });

  it("migrates legacy top-level content to schema version 2", () => {
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

    expect(data.schemaVersion).toBe(2);
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

    expect(data.schemaVersion).toBe(2);
    expect(data.canvases[0].textCards).toEqual([]);
    expect(data.discordRpcShowCanvas).toBe(true);
    expect(data.allowLockedElementDeletion).toBe(true);
  });

  it("defaults locked element removal to allowed for existing data", () => {
    const current = structuredClone(sharedAppDataFixture);
    Reflect.deleteProperty(current, "allowLockedElementDeletion");

    expect(normalizeAppData(current, preview).allowLockedElementDeletion).toBe(true);
  });

  it("rejects future schemas and malformed canvases", () => {
    expect(() => normalizeAppData({ schemaVersion: 3 }, preview)).toThrow(
      "Unsupported TaskMap data schema version",
    );
    expect(() => normalizeAppData({ canvases: "broken" }, preview)).toThrow("Invalid TaskMap data");
  });

  it("does not silently repair malformed versioned data", () => {
    const current = normalizeAppData(structuredClone(sharedAppDataFixture), preview);
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

    expect(normalizeAppData(current, preview).defaultElementColors).toEqual({
      ...current.defaultElementColors,
      mindmap: DEFAULT_ELEMENT_COLORS.mindmap,
    });
  });

  it("migrates the temporary mindmap-new subtype and detaches it from containers", () => {
    const current = normalizeAppData(structuredClone(sharedAppDataFixture), preview);
    Reflect.set(current.canvases[0].textCards[0], "kind", "mindmap-new");
    current.canvases[0].textCards[0].containerId = current.canvases[0].containers[0].id;
    current.canvases[0].textCards[0].order = 0;
    current.canvases[0].textCards[0].extensions = {
      lock: { enabled: true },
      colorPicker: { enabled: true },
      checkbox: { checked: false },
    };

    const normalizedCard = normalizeAppData(current, preview).canvases[0].textCards[0];
    expect(normalizedCard.kind).toBe("mindmap");
    expect(normalizedCard.containerId).toBeUndefined();
    expect(normalizedCard.order).toBeUndefined();
    expect(normalizedCard.link).toBeUndefined();
    expect(normalizedCard.extensions).toEqual({
      lock: { enabled: true },
      colorPicker: { enabled: true },
    });
  });

  it("validates connections between eligible elements and rejects invalid endpoint pairs", () => {
    const current = normalizeAppData(structuredClone(sharedAppDataFixture), preview);
    current.canvases[0].textCards.push(
      {
        id: "mindmap-one",
        kind: "mindmap",
        text: "One",
        x: 100,
        y: 100,
        accent: "#476FA8",
      },
      {
        id: "mindmap-two",
        kind: "mindmap",
        text: "Two",
        x: 400,
        y: 100,
        accent: "#476FA8",
      },
    );
    current.canvases[0].mindmapConnections = [
      {
        id: "connection-one",
        sourceId: "mindmap-one",
        sourcePort: "right",
        targetId: "mindmap-two",
        targetPort: "left",
      },
    ];

    expect(normalizeAppData(current, preview).canvases[0].mindmapConnections).toHaveLength(1);

    const mixed = structuredClone(current);
    mixed.canvases[0].mindmapConnections[0] = {
      id: "connection-one",
      sourceId: mixed.canvases[0].containers[0].id,
      sourcePort: "right",
      targetId: mixed.canvases[0].images[0].id,
      targetPort: "left",
    };
    expect(normalizeAppData(mixed, preview).canvases[0].mindmapConnections).toHaveLength(1);

    const duplicate = structuredClone(current);
    duplicate.canvases[0].mindmapConnections.push({
      id: "connection-two",
      sourceId: "mindmap-two",
      sourcePort: "left",
      targetId: "mindmap-one",
      targetPort: "right",
    });
    expect(() => normalizeAppData(duplicate, preview)).toThrow(
      "Elements can only have one connection per pair",
    );

    const missingEndpoint = structuredClone(current);
    missingEndpoint.canvases[0].mindmapConnections[0].targetId = "missing";
    expect(() => normalizeAppData(missingEndpoint, preview)).toThrow(
      "Connection endpoints must reference connectable elements",
    );

    const textCardEndpoint = structuredClone(current);
    textCardEndpoint.canvases[0].mindmapConnections[0].targetId =
      textCardEndpoint.canvases[0].textCards.find((card) => card.kind !== "mindmap")!.id;
    expect(() => normalizeAppData(textCardEndpoint, preview)).toThrow(
      "Connection endpoints must reference connectable elements",
    );
  });

  it("converts old mindmap records into textcard-based mindmaps", () => {
    const current = structuredClone(sharedAppDataFixture);
    Reflect.set(current.canvases[0], "mindmaps", [
      {
        id: "old-mindmap-one",
        text: "Migrated one",
        x: 100,
        y: 200,
        width: 180,
        height: 60,
        accent: "#476FA8",
      },
      {
        id: "old-mindmap-two",
        text: "Migrated two",
        x: 400,
        y: 200,
        width: 180,
        height: 60,
        accent: "#476FA8",
      },
    ]);
    Reflect.set(current.canvases[0], "mindmapConnections", [
      {
        id: "old-connection",
        sourceId: "old-mindmap-one",
        sourcePort: "right",
        targetId: "old-mindmap-two",
        targetPort: "left",
      },
    ]);

    const normalized = normalizeAppData(current, preview);

    expect(normalized.canvases[0]).not.toHaveProperty("mindmaps");
    expect(normalized.canvases[0].textCards).toContainEqual({
      id: "old-mindmap-one",
      kind: "mindmap",
      text: "Migrated one",
      x: 100,
      y: 200,
      accent: "#476FA8",
    });
    expect(normalized.canvases[0].mindmapConnections).toEqual([
      {
        id: "old-connection",
        sourceId: "old-mindmap-one",
        sourcePort: "right",
        targetId: "old-mindmap-two",
        targetPort: "left",
      },
    ]);
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

  it("validates Command Runner data and rejects Checkbox conflicts", () => {
    const current = structuredClone(sharedAppDataFixture) as unknown as AppData;
    current.canvases[0].textCards[0].extensions = {
      commandRunner: {
        commands: [{ command: "npm test", workingDirectory: "C:\\project", runMode: "background" }],
      },
    };
    expect(normalizeAppData(current, preview).canvases[0].textCards[0].extensions).toEqual(
      current.canvases[0].textCards[0].extensions,
    );

    current.canvases[0].textCards[0].extensions.checkbox = { checked: false };
    expect(() => normalizeAppData(current, preview)).toThrow(
      "Checkbox and Command Runner cannot both be installed",
    );

    delete current.canvases[0].textCards[0].extensions.checkbox;
    current.canvases[0].textCards[0].extensions.commandRunner!.commands[0].command = "   ";
    expect(() => normalizeAppData(current, preview)).toThrow("Command must not be empty");
  });
});
