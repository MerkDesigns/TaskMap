// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import { connectionIds, targetCompletion, nodeCompletion } from "./retainedConnectionTestSupport";

it.each([
  "self",
  "ordinary-card",
  "missing-target",
  "bad-port",
  "missing-source",
  "duplicate-pair",
  "reversed-pair",
])("rejects %s edges without partial state", async (reason) => {
  const setup = await callbackSetup();
  if (reason === "duplicate-pair" || reason === "reversed-pair")
    setup.actions.captureConnection(ids.mindmap, "right")!.complete(targetCompletion());
  const source = reason === "reversed-pair" ? ids.container : ids.mindmap;
  const captured = setup.actions.captureConnection(source, "right")!;
  if (reason === "missing-source") setup.actions.captureDelete([source])!.complete();
  const target =
    reason === "self"
      ? source
      : reason === "ordinary-card"
        ? ids.card
        : reason === "missing-target"
          ? connectionIds.newNode
          : reason === "reversed-pair"
            ? ids.mindmap
            : ids.container;
  const completion = {
    connectionId: connectionIds.secondEdge,
    target: { elementId: target, portId: reason === "bad-port" ? "invalid" : "left" },
  };
  const before = setup.store.getState().documentWorkspace;
  expect(captured.complete(completion as ReturnType<typeof targetCompletion>)).toEqual({
    ok: false,
    code: "command-failed",
  });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});

it.each([
  "non-node-source",
  "duplicate-edge-id",
  "duplicate-node-id",
  "invalid-node-data",
  "invalid-geometry",
])("rolls back node and edge together for %s", async (reason) => {
  const setup = await callbackSetup();
  if (reason === "duplicate-edge-id")
    setup.actions.captureConnection(ids.mindmap, "right")!.complete(targetCompletion());
  const completion = nodeCompletion();
  if (reason === "duplicate-node-id") completion.newNode.id = ids.mindmap;
  if (reason === "invalid-node-data") completion.newNode.data.accent = "";
  if (reason === "invalid-geometry") completion.newNode.geometry.width = -1;
  const before = setup.store.getState().documentWorkspace;
  const source = reason === "non-node-source" ? ids.container : ids.mindmap;
  expect(setup.actions.captureConnection(source, "right")!.complete(completion)).toEqual({
    ok: false,
    code: "command-failed",
  });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(
    setup.store.getState().documentWorkspace.document!.elements[connectionIds.newNode],
  ).toBeUndefined();
  await setup.dispose();
});

it("rejects invalid captures and cannot delete an edge retargeted under the same ID", async () => {
  const setup = await callbackSetup();
  expect(setup.actions.captureConnection(connectionIds.newNode, "left")).toBeNull();
  expect(setup.actions.captureConnection(ids.mindmap, "invalid")).toBeNull();
  expect(setup.actions.captureConnectionDelete(connectionIds.edge)).toBeNull();
  setup.actions.captureConnection(ids.mindmap, "right")!.complete(targetCompletion());
  const deletion = setup.actions.captureConnectionDelete(connectionIds.edge)!;
  const connection =
    setup.store.getState().documentWorkspace.document!.connections[connectionIds.edge];
  setup.store.workspace.dispatchCommand({
    type: "document.connection.remove",
    payload: { connectionId: connectionIds.edge },
  });
  setup.store.workspace.dispatchCommand({
    type: "document.connection.insert",
    payload: { connection: { ...connection, target: { elementId: ids.block, portId: "top" } } },
  });
  const before = setup.store.getState().documentWorkspace;
  expect(deletion.complete()).toEqual({ ok: false, code: "command-failed" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await setup.dispose();
});
