import { asEntityId } from "../../domain/ids/entityIds";
import { createCardContainerInput, TEST_IDS } from "../cardContainerTestFixtures";

export const MIND_MAP_TEST_IDS = {
  block: asEntityId("element", "element-00000000-0000-4000-8000-000000000010"),
  node: asEntityId("element", "element-00000000-0000-4000-8000-000000000011"),
  connectionB: asEntityId("connection", "connection-00000000-0000-4000-8000-000000000012"),
};

export function createMindMapInput() {
  const input = createCardContainerInput();
  const { block, node } = MIND_MAP_TEST_IDS;
  input.elements[block] = {
    id: block,
    canvasId: TEST_IDS.canvasA,
    type: "text-block",
    geometry: { x: 50, y: 90, width: 400, height: 300 },
    data: {
      name: "Notes 📃",
      text: "# Heading\n第二行",
      accent: "#abc",
      headerButtonsVisible: false,
    },
  };
  input.elements[node] = {
    id: node,
    canvasId: TEST_IDS.canvasA,
    type: "mind-map-node",
    geometry: { x: 500, y: 500, width: 240, height: 120 },
    data: { text: "Idea\n💡", accent: "#def" },
  };
  input.canvases[TEST_IDS.canvasA].elementOrder.push(block, node);
  input.connections[TEST_IDS.connection] = {
    id: TEST_IDS.connection,
    canvasId: TEST_IDS.canvasA,
    type: "mind-map",
    source: { elementId: node, portId: "right" },
    target: { elementId: block, portId: "left" },
    data: {},
  };
  return input;
}
