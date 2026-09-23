// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  placementCommand,
  placementIds as ids,
  placementSetup,
} from "./retainedPlacementTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";

type Payload = ReturnType<typeof placementCommand>["payload"];
const invalid: [string, (payload: Payload) => void][] = [
  [
    "duplicate moving member",
    (p) => {
      p.moving.push(p.moving[0]);
    },
  ],
  [
    "duplicate geometry member",
    (p) => {
      p.updates.push(p.updates[0]);
    },
  ],
  [
    "missing geometry member",
    (p) => {
      p.updates[0].elementId = ids.image;
    },
  ],
  [
    "empty move",
    (p) => {
      p.moving = [];
    },
  ],
  [
    "unknown canvas",
    (p) => {
      p.canvasId = TEST_IDS.canvasB;
    },
  ],
  [
    "missing moving member",
    (p) => {
      p.moving[0].elementId = ids.target;
    },
  ],
  [
    "block cannot be contained",
    (p) => {
      p.moving[0] = { elementId: ids.block, from: null };
    },
  ],
  [
    "mindmap cannot be contained",
    (p) => {
      p.moving[0] = { elementId: ids.mindmap, from: null };
    },
  ],
  [
    "target is not a container",
    (p) => {
      p.target!.containerId = ids.card;
    },
  ],
  [
    "target is missing",
    (p) => {
      p.target!.containerId = "element-00000000-0000-4000-8000-000000000099" as typeof ids.card;
    },
  ],
  [
    "index too large",
    (p) => {
      p.target!.index = 2;
    },
  ],
  [
    "negative index",
    (p) => {
      p.target!.index = -1;
    },
  ],
  [
    "fractional index",
    (p) => {
      p.target!.index = 0.5;
    },
  ],
  [
    "stale moving parent",
    (p) => {
      p.moving[0].from = null;
    },
  ],
  [
    "stale moving order",
    (p) => {
      p.moving[0].from = { containerId: ids.container, order: 2 };
    },
  ],
  [
    "stale sibling order",
    (p) => {
      p.expectedSiblings[0] = {
        ...p.expectedSiblings[0],
        placement: { containerId: ids.container, order: 2 },
      };
    },
  ],
  [
    "omitted sibling",
    (p) => {
      p.expectedSiblings.pop();
    },
  ],
  [
    "duplicate sibling",
    (p) => {
      p.expectedSiblings.push(p.expectedSiblings[0]);
    },
  ],
  [
    "extra sibling",
    (p) => {
      p.expectedSiblings.push({
        elementId: ids.block,
        placement: { containerId: ids.target, order: 2 },
      });
    },
  ],
  [
    "stale geometry",
    (p) => {
      p.updates[0].from.x++;
    },
  ],
  [
    "measured card dimensions",
    (p) => {
      p.updates[0].to.width = 77;
    },
  ],
  [
    "unknown payload field",
    (p) => {
      Object.assign(p, { pointerX: 100 });
    },
  ],
];

describe("placement preconditions and rollback", () => {
  it.each(invalid)("rejects %s with no partial geometry/order/history/save", (_name, change) => {
    const { store, scheduler, saveDocument } = placementSetup();
    const before = store.getState().documentWorkspace;
    const command = placementCommand(before.document!);
    command.payload.updates[0].to.y += 25;
    change(command.payload);
    expect(store.workspace.dispatchCommand(command).ok).toBe(false);
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(0);
    expect(saveDocument).not.toHaveBeenCalled();
    store.disposeWorkspace();
  });

  it("rejects a captured drop after another valid sibling reorder without disturbing its pending save", () => {
    const { store, scheduler } = placementSetup();
    const document = store.getState().documentWorkspace.document!;
    const stale = placementCommand(document);
    expect(
      store.workspace.dispatchCommand(
        placementCommand(document, [ids.image], { containerId: ids.container, index: 0 }),
      ).ok,
    ).toBe(true);
    const before = store.getState().documentWorkspace;
    expect(store.workspace.dispatchCommand(stale).ok).toBe(false);
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(1);
    store.disposeWorkspace();
  });

  it("rejects a mid-gesture lock and retains that valid transaction", () => {
    const { store, scheduler } = placementSetup();
    const command = placementCommand(store.getState().documentWorkspace.document!);
    expect(
      store.workspace.dispatchCommand({
        type: "document.extension.install",
        payload: {
          installation: {
            id: TEST_IDS.extensionA,
            extensionId: "lock",
            enabled: true,
            target: { kind: "element", elementId: ids.card },
            configuration: { enabled: true },
          },
        },
      }).ok,
    ).toBe(true);
    const before = store.getState().documentWorkspace;
    expect(store.workspace.dispatchCommand(command).ok).toBe(false);
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(1);
    store.disposeWorkspace();
  });

  it("does not overwrite unrelated content edits made during the gesture", () => {
    const { store } = placementSetup();
    const document = store.getState().documentWorkspace.document!;
    const command = placementCommand(document);
    expect(
      store.workspace.dispatchCommand({
        type: "document.element.replace-data",
        payload: {
          elementId: ids.card,
          data: { ...document.elements[ids.card].data, text: "New content" },
        },
      }).ok,
    ).toBe(true);
    expect(store.workspace.dispatchCommand(command).ok).toBe(true);
    expect(store.getState().documentWorkspace.document!.elements[ids.card].data.text).toBe(
      "New content",
    );
    store.disposeWorkspace();
  });
});
