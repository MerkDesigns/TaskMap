// @vitest-environment node
import { expect, it } from "vitest";
import { createRetainedInteractionGeometry } from "./retainedInteractionGeometry";
import { dropInput, dropView, dropIds as ids } from "./retainedDropTestSupport";
import { geometryLock } from "../../app/commands/retainedGeometryTestSupport";

it("keeps contained cards/images out of root targets and preserves node bounds/capabilities", () => {
  const geometry = createRetainedInteractionGeometry(dropView());
  expect(geometry.roots.map((item) => item.id)).toEqual([
    ids.container,
    ids.target,
    ids.block,
    ids.mindmap,
  ]);
  expect(geometry.gestureElement(ids.card)).toBeNull();
  expect(geometry.gestureElement(ids.image, true)).toBeNull();
  expect(geometry.gestureElement(ids.mindmap)).toMatchObject({
    centerSnapping: true,
    resizable: false,
    geometry: { width: 84, height: 43 },
  });
  expect(geometry.gestureElement(ids.container)).toMatchObject({ resizable: true });
});

it("uses measured loose/node sizes and visible scrolled card positions without changing the view", () => {
  const view = dropView();
  const geometry = createRetainedInteractionGeometry(
    view,
    new Map([
      [ids.sibling, { width: 123, height: 45 }],
      [ids.mindmap, { width: 345, height: 67 }],
    ]),
    { [ids.target]: 30 },
  );
  expect(geometry.gestureElement(ids.sibling, true)?.geometry).toEqual({
    x: 517,
    y: 77,
    width: 123,
    height: 45,
  });
  expect(geometry.gestureElement(ids.mindmap)?.geometry).toMatchObject({ width: 345, height: 67 });
  expect(geometry.gestureElement(ids.hidden, true)?.geometry).toEqual({
    x: 517,
    y: 77,
    width: 215,
    height: 43,
  });
  expect(view.textCards.find((card) => card.id === ids.sibling)?.x).toBe(300);
});

it("prepares source-order bundles independent of primary pickup order and skips locked cards", () => {
  const geometry = createRetainedInteractionGeometry(dropView(geometryLock(dropInput(), ids.card)));
  const plan = geometry.prepareMove(ids.bundle, [ids.bundle, ids.card]);
  expect(plan.targets.map((item) => item.id)).toEqual([ids.bundle]);
  expect(plan).toMatchObject({
    completionBehavior: "place",
    commitThresholdScreen: 3,
    selectionAfterStart: [],
  });
  expect(geometry.prepareMove(ids.card, [ids.bundle, ids.card]).targets).toEqual([]);
});

it("preserves root group translation, single-node translation and contained bundle selection", () => {
  const input = dropInput();
  input.elements[ids.card].data.placement = null;
  const geometry = createRetainedInteractionGeometry(dropView(input));
  expect(geometry.prepareMove(ids.card, [ids.card, ids.container])).toMatchObject({
    completionBehavior: "translate",
    commitThresholdScreen: 0,
    selectionAfterStart: [ids.card, ids.container],
  });
  expect(geometry.prepareMove(ids.mindmap, [])).toMatchObject({
    completionBehavior: "translate",
    commitThresholdScreen: 3,
  });
  const bundled = createRetainedInteractionGeometry(dropView()).prepareMove(ids.bundle, [
    ids.bundle,
    ids.card,
  ]);
  expect(bundled.targets.map((item) => item.id)).toEqual([ids.card, ids.bundle]);
  expect(bundled.selectionAfterStart).toEqual([ids.card, ids.bundle]);
});

it("uses the picked card's actual bounds without changing other bundle members", () => {
  const geometry = createRetainedInteractionGeometry(dropView());
  const bounds = { x: 17, y: 116, width: 187, height: 42 };
  const plan = geometry.prepareMove(ids.bundle, [ids.card, ids.bundle], bounds);
  expect(plan.targets[1].geometry).toBe(bounds);
  expect(plan.targets[0].geometry.width).toBe(215);
});

it("reuses visibility/type-specific snap filtering and does not cascade parent locks", () => {
  const geometry = createRetainedInteractionGeometry(
    dropView(geometryLock(dropInput(), ids.container)),
    new Map(),
    {},
    new Set([ids.container]),
  );
  expect(geometry.gestureElement(ids.container)?.locked).toBe(true);
  expect(geometry.gestureElement(ids.card, true)?.locked).toBe(false);
  expect(geometry.snapTargets.map((item) => item.id)).toEqual([ids.container, ids.mindmap]);
  expect(geometry.resizeSnapTargets(ids.target, "container").map((item) => item.id)).toEqual([
    ids.container,
  ]);
  expect(geometry.resizeSnapTargets(ids.block, "text-block")).toEqual([]);
  expect(geometry.resizeSnapTargets(ids.image, "image").map((item) => item.id)).toEqual([
    ids.container,
    ids.mindmap,
  ]);
});
