import { asEntityId } from "../../domain/ids/entityIds";
import { geometryIds } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

export const connectionIds = {
  edge: TEST_IDS.connection,
  secondEdge: asEntityId("connection", "connection-00000000-0000-4000-8000-000000000111"),
  newNode: asEntityId("element", "element-00000000-0000-4000-8000-000000000112"),
};
export const targetCompletion = (id = geometryIds.container) => ({
  connectionId: connectionIds.edge,
  target: { elementId: id, portId: "left" as const },
});
export const nodeCompletion = () => ({
  connectionId: connectionIds.edge,
  newNode: {
    id: connectionIds.newNode,
    geometry: { x: 600, y: 500, width: 200, height: 100 },
    data: { text: "Mindmap", accent: "#abc" },
  },
});
