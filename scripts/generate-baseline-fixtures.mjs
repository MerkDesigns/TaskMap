import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputDirectory = path.join(process.cwd(), "fixtures", "baseline");
await mkdir(outputDirectory, { recursive: true });

function createDocument(name, elementCount) {
  const containers = [];
  const textCards = [];
  const textBlocks = [];
  const images = [];
  const columns = Math.max(1, Math.ceil(Math.sqrt(elementCount)));

  for (let index = 0; index < elementCount; index += 1) {
    const x = 120 + (index % columns) * 220;
    const y = 120 + Math.floor(index / columns) * 120;
    const kind = index % 4;
    if (kind === 0) {
      containers.push({
        id: `container-${index}`,
        name: `Container ${index}`,
        x,
        y,
        width: 380,
        height: 260,
        accent: "#476FA8",
        extensions: {},
      });
    } else if (kind === 1) {
      textCards.push({
        id: `card-${index}`,
        text: `Card ${index}`,
        x,
        y,
        accent: "#476FA8",
        extensions: {},
      });
    } else if (kind === 2) {
      textBlocks.push({
        id: `text-block-${index}`,
        name: `Text block ${index}`,
        text: `Baseline text ${index}`,
        x,
        y,
        width: 320,
        height: 180,
        accent: "#476FA8",
        extensions: {},
      });
    } else {
      images.push({
        id: `image-${index}`,
        x,
        y,
        width: 320,
        height: 180,
        accent: "#476FA8",
        background: true,
        extensions: {},
      });
    }
  }

  return {
    schemaVersion: 2,
    activeCanvasId: "canvas-1",
    canvases: [
      {
        id: "canvas-1",
        name,
        width: Math.max(3000, columns * 240 + 240),
        height: Math.max(3000, Math.ceil(elementCount / columns) * 140 + 240),
        containers,
        textCards,
        textBlocks,
        images,
        mindmapConnections: [],
        pan: { x: -520, y: -420 },
        zoom: 1,
        previewViewport: { width: 1280, height: 820 },
      },
    ],
    canvasGridStyle: "dots",
    canvasGridOpacity: { dots: 50, lines: 15 },
    defaultElementColors: {
      container: "#476FA8",
      textCard: "#476FA8",
      textBlock: "#476FA8",
      image: "#476FA8",
      mindmap: "#476FA8",
    },
    recentColors: [],
    shadowsUnderElements: false,
    allowLockedElementDeletion: true,
    discordRpcEnabled: false,
    discordRpcShowCanvas: true,
    minimapEnabled: true,
    privacyModeEnabled: false,
    toolbarButtonsVisible: false,
  };
}

const fixtures = [
  ["small.json", createDocument("Small baseline", 40)],
  ["normal.json", createDocument("Normal baseline", 2000)],
  ["stress.json", createDocument("Stress baseline", 10000)],
];

for (const [fileName, document] of fixtures) {
  await writeFile(path.join(outputDirectory, fileName), `${JSON.stringify(document, null, 2)}\n`);
}

console.log(`Generated ${fixtures.length} deterministic fixtures in fixtures/baseline/.`);
