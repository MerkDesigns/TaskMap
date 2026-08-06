export const TEST_IDS = Object.freeze({
  document: "document-00000000-0000-4000-8000-000000000001",
  database: "database-00000000-0000-4000-8000-000000000002",
  canvasA: "canvas-00000000-0000-4000-8000-000000000003",
  canvasB: "canvas-00000000-0000-4000-8000-000000000004",
  elementA: "element-00000000-0000-4000-8000-000000000005",
  elementB: "element-00000000-0000-4000-8000-000000000006",
  connection: "connection-00000000-0000-4000-8000-000000000007",
  extensionA: "extension-instance-00000000-0000-4000-8000-000000000008",
  extensionB: "extension-instance-00000000-0000-4000-8000-000000000009",
  media: "abcdefghijklmnopqrstuvwx",
});

interface TestCanvasInput {
  id: string;
  name: string;
  settings: { width: number; height: number };
  elementOrder: string[];
}

interface TestElementInput {
  id: string;
  canvasId: string;
  type: string;
  geometry: { x: number; y: number; width: number; height: number };
  data: Record<string, unknown>;
}

interface TestExtensionInput {
  id: string;
  extensionId: string;
  target: Record<string, string>;
  enabled: boolean;
  configuration: Record<string, unknown>;
}

export interface TestDocumentInput {
  schemaVersion: number;
  id: string;
  databaseId: string;
  databasePurpose: string;
  activeCanvasId: string | null;
  canvasOrder: string[];
  canvases: Record<string, TestCanvasInput>;
  elements: Record<string, TestElementInput>;
  connections: Record<string, unknown>;
  mediaReferences: Record<string, Record<string, unknown>>;
  extensionInstallations: Record<string, TestExtensionInput>;
  documentSettings: Record<string, unknown>;
}

export function createValidDocumentInput(): TestDocumentInput {
  return {
    schemaVersion: 1,
    id: TEST_IDS.document,
    databaseId: TEST_IDS.database,
    databasePurpose: "development",
    activeCanvasId: TEST_IDS.canvasA,
    canvasOrder: [TEST_IDS.canvasA],
    canvases: {
      [TEST_IDS.canvasA]: {
        id: TEST_IDS.canvasA,
        name: "First canvas",
        settings: { width: 3_000, height: 3_000 },
        elementOrder: [TEST_IDS.elementA, TEST_IDS.elementB],
      },
    },
    elements: {
      [TEST_IDS.elementA]: {
        id: TEST_IDS.elementA,
        canvasId: TEST_IDS.canvasA,
        type: "test-card",
        geometry: { x: 10, y: 20, width: 240, height: 120 },
        data: { text: "First" },
      },
      [TEST_IDS.elementB]: {
        id: TEST_IDS.elementB,
        canvasId: TEST_IDS.canvasA,
        type: "test-card",
        geometry: { x: 300, y: 20, width: 240, height: 120 },
        data: { text: "Second" },
      },
    },
    connections: {
      [TEST_IDS.connection]: {
        id: TEST_IDS.connection,
        canvasId: TEST_IDS.canvasA,
        type: "mind-map",
        source: { elementId: TEST_IDS.elementA, portId: "right" },
        target: { elementId: TEST_IDS.elementB, portId: "left" },
        data: { color: "#ffffff" },
      },
    },
    mediaReferences: {
      [TEST_IDS.media]: {
        id: TEST_IDS.media,
        mimeType: "image/png",
        byteLength: 1_024,
        pixelWidth: 640,
        pixelHeight: 480,
        altText: "Diagram",
      },
    },
    extensionInstallations: {
      [TEST_IDS.extensionA]: {
        id: TEST_IDS.extensionA,
        extensionId: "checkbox",
        target: { kind: "element", elementId: TEST_IDS.elementA },
        enabled: true,
        configuration: { checked: false },
      },
    },
    documentSettings: {
      grid: { style: "dots", opacityPercent: { dots: 50, lines: 15 } },
      showElementShadows: false,
      allowLockedElementDeletion: true,
      minimapEnabled: true,
    },
  };
}
