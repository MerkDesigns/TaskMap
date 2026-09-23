// @vitest-environment node
import { expect, it } from "vitest";
import { callbackSetup } from "./retainedCallbackTestSupport";
import { geometryIds as ids } from "./retainedGeometryTestSupport";
import {
  resolveRetainedTextCardDrop,
  type CapturedPlacementChild,
  type ResolvedTextCardDrop,
} from "./retainedTextCardDrop";

const children: CapturedPlacementChild[] = [
  { elementId: ids.image, type: "image", placement: { containerId: ids.container, order: 2 } },
  { elementId: ids.card, type: "text-card", placement: { containerId: ids.container, order: 5 } },
  { elementId: ids.block, type: "text-card", placement: { containerId: ids.container, order: 8 } },
  { elementId: ids.mindmap, type: "image", placement: { containerId: ids.container, order: 11 } },
];
const decision: ResolvedTextCardDrop = {
  draggedIds: [ids.card],
  targetContainerId: ids.container,
  realIndex: 0,
  loosePositions: [{ id: ids.card, x: 10, y: 20 }],
};

it.each([
  [0, 1],
  [1, 3],
])("maps card slot %s to full slot %s after removing the bundle", (realIndex, index) => {
  expect(
    resolveRetainedTextCardDrop(children, [ids.card], { ...decision, realIndex }).target,
  ).toEqual({ containerId: ids.container, index });
});

it("appends to image-only destinations and preserves explicit root decisions", () => {
  expect(
    resolveRetainedTextCardDrop(
      children.filter((item) => item.elementId !== ids.block),
      [ids.card],
      decision,
    ).target?.index,
  ).toBe(2);
  expect(
    resolveRetainedTextCardDrop(children, [ids.card], {
      ...decision,
      targetContainerId: null,
      realIndex: null,
    }).target,
  ).toBeNull();
});

it.each([
  "missing-position",
  "duplicate-position",
  "outside-position",
  "nonfinite-position",
  "wrong-order",
  "negative-slot",
  "fractional-slot",
  "large-slot",
  "missing-slot",
  "root-slot",
])("rejects %s decisions atomically and consumes the capture", async (kind) => {
  const setup = await callbackSetup();
  const capture = setup.actions.captureMove(ids.card, [ids.card], [ids.card])!;
  let drop: ResolvedTextCardDrop = { ...decision };
  if (kind === "missing-position") drop = { ...drop, loosePositions: [] };
  if (kind === "duplicate-position")
    drop = { ...drop, loosePositions: [...drop.loosePositions, ...drop.loosePositions] };
  if (kind === "outside-position")
    drop = { ...drop, loosePositions: [{ id: ids.image, x: 10, y: 20 }] };
  if (kind === "nonfinite-position")
    drop = { ...drop, loosePositions: [{ id: ids.card, x: Infinity, y: 20 }] };
  if (kind === "wrong-order") drop = { ...drop, draggedIds: [ids.image] };
  if (kind === "negative-slot") drop = { ...drop, realIndex: -1 };
  if (kind === "fractional-slot") drop = { ...drop, realIndex: 0.5 };
  if (kind === "large-slot") drop = { ...drop, realIndex: 2 };
  if (kind === "missing-slot") drop = { ...drop, realIndex: null };
  if (kind === "root-slot") drop = { ...drop, targetContainerId: null };
  const before = setup.store.getState().documentWorkspace;
  const completion = {
    operation: { ...setup.move(), completionBehavior: "place" as const },
    textCardDrop: drop,
  };
  expect(capture.complete(completion)).toEqual({ ok: false, code: "invalid-action" });
  expect(capture.complete(completion)).toEqual({ ok: false, code: "expired-action" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  expect(setup.scheduler.size).toBe(0);
  await setup.dispose();
});

it("rejects ambiguous, missing and below-threshold decisions and image/node captures", async () => {
  const setup = await callbackSetup();
  for (const id of [ids.image, ids.mindmap])
    expect(setup.actions.captureMove(id, [id], [id], "text-card")).toBeNull();
  for (const completion of [
    { operation: { ...setup.move(), completionBehavior: "place" as const }, textCardDrop: null },
    {
      operation: { ...setup.move(), completionBehavior: "place" as const },
      textCardDrop: decision,
      target: null,
    },
    {
      operation: { ...setup.move(), completionBehavior: "place" as const, screenDistance: 2 },
      textCardDrop: decision,
    },
  ])
    expect(
      setup.actions.captureMove(ids.card, [ids.card], [ids.card])!.complete(completion),
    ).toEqual({ ok: false, code: "invalid-action" });
  expect(setup.scheduler.size).toBe(0);
  await setup.dispose();
});
