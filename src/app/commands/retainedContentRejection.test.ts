// @vitest-environment node
import { expect, it } from "vitest";
import { geometryIds as ids, geometrySetup } from "./retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

it.each([
  ["text-card", ids.card, { text: "stale" }, { text: "New" }],
  ["text-card", ids.card, {}, { text: "New" }],
  ["text-card", ids.card, { text: "First line\n第二行" }, {}],
  ["image", ids.card, { accent: "#fedcba" }, { accent: "red" }],
  ["mind-map-node", ids.mindmap, { link: null }, { link: "url" }],
  ["text-card", ids.card, { text: "First line\n第二行" }, { text: 3 }],
  ["text-card", ids.card, { placement: null }, { placement: null }],
  ["text-card", ids.card, { accent: "#fedcba" }, { accent: "" }],
  ["image", ids.image, { mediaId: TEST_IDS.media }, { mediaId: null }],
  ["text-block", ids.block, { headerButtonsVisible: true }, { headerButtonsVisible: "yes" }],
  ["container", ids.container, { unknown: true }, { unknown: false }],
  ["unsupported", ids.container, {}, {}],
])("rejects invalid/stale %s content atomically (%s)", (type, elementId, from, to) => {
  const { store, scheduler } = geometrySetup();
  const before = store.getState().documentWorkspace;
  expect(
    store.workspace.dispatchCommand({
      type: "document.elements.edit-content",
      payload: {
        canvasId: TEST_IDS.canvasA,
        updates: [
          {
            elementId: ids.image,
            type: "image",
            from: { accent: before.document!.elements[ids.image].data.accent },
            to: { accent: "purple" },
          },
          { elementId, type, from, to },
        ],
      },
    }).ok,
  ).toBe(false);
  expect(store.getState().documentWorkspace).toBe(before);
  expect(scheduler.size).toBe(0);
  store.disposeWorkspace();
});

it.each(["duplicate", "missing", "canvas", "empty", "extra"])(
  "rejects %s content targets",
  (kind) => {
    const { store, scheduler } = geometrySetup();
    const before = store.getState().documentWorkspace;
    const update = {
      elementId: ids.card,
      type: "text-card",
      from: { accent: before.document!.elements[ids.card].data.accent },
      to: { accent: "purple" },
    };
    const payload = { canvasId: TEST_IDS.canvasA, updates: [update] };
    if (kind === "duplicate") payload.updates.push(update);
    if (kind === "missing")
      update.elementId = "element-00000000-0000-4000-8000-000000000099" as typeof ids.card;
    if (kind === "canvas") payload.canvasId = TEST_IDS.canvasB;
    if (kind === "empty") payload.updates = [];
    if (kind === "extra") Object.assign(payload, { force: true });
    expect(
      store.workspace.dispatchCommand({ type: "document.elements.edit-content", payload }).ok,
    ).toBe(false);
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(0);
    store.disposeWorkspace();
  },
);

it.each(["media", "placement", "unknown", "missing"])(
  "full replacement cannot bypass %s content rules",
  (kind) => {
    const { store } = geometrySetup();
    const before = store.getState().documentWorkspace;
    const data: Record<string, unknown> = { ...before.document!.elements[ids.image].data };
    if (kind === "media") data.mediaId = null;
    if (kind === "placement") data.placement = null;
    if (kind === "unknown") data.path = "not a media reference";
    if (kind === "missing") delete data.background;
    expect(
      store.workspace.dispatchCommand({
        type: "document.element.replace-data",
        payload: { elementId: ids.image, data },
      }).ok,
    ).toBe(false);
    expect(store.getState().documentWorkspace).toBe(before);
    store.disposeWorkspace();
  },
);
