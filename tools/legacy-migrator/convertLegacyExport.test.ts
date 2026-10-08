import { describe, expect, it } from "vitest";
import type { DocumentElement } from "../../src/domain/document/documentTypes";
import { convertLegacyExport, type MigrationOptions } from "./convertLegacyExport";

let counter = 0;
const options = (): MigrationOptions => ({
  databaseId: "database-00000000-0000-4000-8000-000000000001",
  databasePurpose: "development",
  ids: {
    nextUuid: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`,
  },
  randomBytes: (length) => Uint8Array.from({ length }, (_, index) => (counter + index) % 256),
});

// Two bytes of fake WebP data: the converter never decodes images, it only carries them.
const webp = { hash: "hash-webp", format: "webp", width: 40, height: 30, data: "UklG" };

const legacyExport = () => ({
  data: {
    schemaVersion: 2,
    activeCanvasId: "second",
    canvasGridStyle: "lines",
    canvasGridOpacity: { dots: 40, lines: 140 },
    defaultElementColors: {},
    recentColors: ["#FF0000"],
    shadowsUnderElements: true,
    allowLockedElementDeletion: false,
    minimapEnabled: false,
    privacyModeEnabled: true,
    toolbarButtonsVisible: false,
    discordRpcEnabled: false,
    discordRpcShowCanvas: false,
    canvases: [
      {
        id: "first",
        name: "  Work  ",
        width: 3000,
        height: 2000,
        pan: { x: 10, y: 20 },
        zoom: 1.5,
        containers: [
          {
            id: "box",
            name: "Groceries",
            x: 10,
            y: 20,
            width: 300,
            height: 200,
            accent: "#476FA8",
            layer: 2,
            extensions: {
              privacy: { enabled: true },
              search: { query: "milk" },
              sorting: { mode: "alphabet", direction: "asc" },
            },
          },
        ],
        textCards: [
          { id: "c2", text: "Bread", x: 0, y: 0, accent: "#111", containerId: "box", order: 7 },
          {
            id: "c1",
            text: "Milk",
            x: 0,
            y: 0,
            accent: "#111",
            containerId: "box",
            order: 3,
            link: "",
            extensions: { checkbox: { checked: true } },
          },
          {
            id: "runner",
            text: "Start dev server",
            x: 500,
            y: 40,
            accent: "",
            layer: 1,
            link: "https://example.com",
            extensions: {
              commandRunner: {
                commands: [
                  { command: "npm run dev", runMode: "background", workingDirectory: " C:\\app " },
                  { command: "start http://localhost:3000", runMode: "terminal", runAsAdmin: true },
                  { command: "cd app && npm test", runMode: "terminal" },
                ],
              },
              dailyReset: { lastResetDate: "2026-01-01" },
            },
          },
          { id: "n1", kind: "mindmap", text: "Idea", x: 100, y: 400, accent: "#222" },
          { id: "n2", kind: "mindmap", text: "Detail", x: 300, y: 400, accent: "#222" },
        ],
        textBlocks: [
          {
            id: "notes",
            name: "Notes",
            text: "Body",
            x: 0,
            y: 600,
            width: 320,
            height: 220,
            accent: "#333",
          },
        ],
        images: [
          {
            id: "pic",
            imageId: "hash-webp",
            x: 700,
            y: 0,
            width: 40,
            height: 30,
            accent: "#444",
            background: false,
          },
          {
            id: "gone",
            imageId: "hash-missing",
            x: 800,
            y: 0,
            width: 40,
            height: 30,
            accent: "#444",
          },
        ],
        mindmapConnections: [
          { id: "k1", sourceId: "n1", sourcePort: "right", targetId: "n2", targetPort: "left" },
          { id: "k2", sourceId: "n2", sourcePort: "left", targetId: "n1", targetPort: "right" },
          { id: "k3", sourceId: "n1", sourcePort: "top", targetId: "deleted", targetPort: "left" },
        ],
      },
      {
        id: "second",
        name: "",
        width: 3000,
        height: 3000,
        pan: { x: 0, y: 0 },
        zoom: 1,
        containers: [],
        textCards: [],
        textBlocks: [],
        images: [],
        mindmapConnections: [],
      },
    ],
  },
  images: [webp],
});

function convert() {
  const result = convertLegacyExport(legacyExport(), options());
  if (!result.ok) throw new Error(result.error);
  return result;
}

const elementsOf = (result: ReturnType<typeof convert>) =>
  Object.values(result.document.elements) as DocumentElement[];
const byText = (result: ReturnType<typeof convert>, text: string) =>
  elementsOf(result).find((element) => element.data.text === text || element.data.name === text)!;

describe("convertLegacyExport", () => {
  it("converts every element type into a document the app accepts", () => {
    const result = convert();

    expect(result.report.counts).toMatchObject({
      canvases: 2,
      containers: 1,
      "text cards": 3,
      "mind-map nodes": 2,
      "text blocks": 1,
      images: 2,
      connections: 1,
    });
    expect(
      elementsOf(result)
        .map(({ type }) => type)
        .sort(),
    ).toEqual([
      "container",
      "image",
      "image",
      "mind-map-node",
      "mind-map-node",
      "text-block",
      "text-card",
      "text-card",
      "text-card",
    ]);
  });

  it("keeps canvases, the open canvas and the document settings", () => {
    const { document } = convert();
    const [first, second] = document.canvasOrder.map((id) => document.canvases[id]!);

    expect(first!.name).toBe("Work");
    expect(second!.name).toBe("Untitled canvas");
    expect(document.activeCanvasId).toBe(second!.id);
    expect(document.documentSettings).toEqual({
      grid: { style: "lines", opacityPercent: { dots: 40, lines: 100 } },
      showElementShadows: true,
      allowLockedElementDeletion: false,
      minimapEnabled: false,
    });
  });

  it("places container cards in their saved order and paints top-level elements by layer", () => {
    const result = convert();
    const box = byText(result, "Groceries");

    expect(byText(result, "Milk").data.placement).toEqual({ containerId: box.id, order: 0 });
    expect(byText(result, "Bread").data.placement).toEqual({ containerId: box.id, order: 1 });
    const order = result.document.canvases[box.canvasId]!.elementOrder;
    expect(order.indexOf(byText(result, "Start dev server").id)).toBeLessThan(
      order.indexOf(box.id),
    );
  });

  it("carries bundled images and leaves missing ones empty", () => {
    const result = convert();
    const [stored] = result.media;
    const images = elementsOf(result).filter(({ type }) => type === "image");

    expect(result.media).toHaveLength(1);
    expect(stored).toMatchObject({ mimeType: "image/webp", base64: "UklG" });
    expect(result.document.mediaReferences[stored!.id as never]).toMatchObject({
      byteLength: 3,
      pixelWidth: 40,
      pixelHeight: 30,
    });
    expect(images.map(({ data }) => data.mediaId)).toEqual([stored!.id, null]);
    expect(images[0]!.data.background).toBe(false);
    expect(result.report.notes.join("\n")).toMatch(/image was missing from the export/);
  });

  it("turns saved commands into workflow lines and reports the ones that cannot run", () => {
    const result = convert();
    const runner = byText(result, "Start dev server");
    const workflow = Object.values(result.document.extensionInstallations).find(
      ({ target }) => target.kind === "element" && target.elementId === runner.id,
    );

    expect(workflow?.extensionId).toBe("workflow");
    expect(workflow?.configuration).toEqual({
      lines: [
        {
          invocations: [{ kind: "run", executable: "npm", arguments: ["run", "dev"] }],
          workingDirectory: "C:\\app",
          display: "background",
        },
        {
          invocations: [{ kind: "open", target: "http://localhost:3000" }],
          workingDirectory: null,
          display: "terminal",
        },
      ],
    });
    const notes = result.report.notes.join("\n");
    expect(notes).toMatch(/cd app && npm test.*cannot run as a workflow/);
    expect(notes).toMatch(/ran as administrator before/);
  });

  it("keeps extensions with their settings and lists removed ones", () => {
    const result = convert();
    const installed = Object.values(result.document.extensionInstallations).map(
      ({ extensionId, configuration }) => [extensionId, configuration],
    );

    expect(installed).toEqual(
      expect.arrayContaining([
        ["privacy", { enabled: true }],
        ["search", { query: "milk" }],
        ["checkbox", { checked: true }],
      ]),
    );
    const notes = result.report.notes.join("\n");
    expect(notes).toMatch(/sorting extension no longer exists/);
    expect(notes).toMatch(/daily reset extension no longer exists/);
  });

  it("drops duplicate and dangling connections", () => {
    const result = convert();

    expect(Object.values(result.document.connections)).toHaveLength(1);
    expect(result.report.notes.join("\n")).toMatch(/connection to a missing or repeated element/);
  });

  it("refuses data that is not a TaskMap 0.3 export", () => {
    expect(convertLegacyExport({ data: { schemaVersion: 1 } }, options()).ok).toBe(false);
  });
});
