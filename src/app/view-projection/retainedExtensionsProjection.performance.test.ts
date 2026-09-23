// @vitest-environment node
import { produce } from "immer";
import { describe, expect, it, vi } from "vitest";
import { createRetainedCanvasProjection } from "./createRetainedCanvasProjection";
import type { RetainedCanvasProjectionResult } from "./retainedCanvasProjectionTypes";
import {
  createCardContainerInput,
  TEST_IDS as ids,
  validated,
} from "../../elements/cardContainerTestFixtures";
import { createValidDocumentInput } from "../../domain/document/documentTestFixtures";
import { lockConfigurationSchema } from "../../extensions/lock/lockDefinition";
import { createCanvasInteractionController } from "../interactions/canvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";

function fixture() {
  const input = createCardContainerInput();
  input.extensionInstallations = createValidDocumentInput().extensionInstallations;
  Object.assign(input.extensionInstallations[ids.extensionA], {
    extensionId: "lock",
    configuration: { enabled: true },
  });
  input.extensionInstallations[ids.extensionB] = {
    ...input.extensionInstallations[ids.extensionA],
    id: ids.extensionB,
    target: { kind: "element", elementId: ids.elementB },
  };
  return validated(input);
}
function view(result: RetainedCanvasProjectionResult) {
  if (!result.ok) throw new Error("Expected projection");
  return result;
}

describe("retained extension cache dependencies", () => {
  it("does no parsing or serialization across actual pan/zoom samples", () => {
    const document = fixture();
    const projection = createRetainedCanvasProjection();
    const first = projection.project(document);
    const controller = createCanvasInteractionController({
      canvasKey: ids.canvasA,
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
      commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder: vi.fn() },
    });
    const spies = [vi.spyOn(lockConfigurationSchema, "safeParse"), vi.spyOn(JSON, "stringify")];
    try {
      controller.beginPan(1, { x: 0, y: 0 });
      for (let frame = 1; frame <= 100; frame++) {
        controller.updatePointer({ pointerId: 1, screen: { x: frame, y: frame }, snapping: false });
        expect(projection.project(document)).toBe(first);
      }
      controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
      for (let frame = 0; frame < 100; frame++) {
        controller.wheelZoom({ x: 500, y: 400 }, -1);
        expect(projection.project(document)).toBe(first);
      }
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      controller.dispose();
      projection.clear();
    }
  });

  it("reuses configuration and unrelated views on geometry-only changes", () => {
    const document = fixture();
    const projection = createRetainedCanvasProjection();
    const before = view(projection.project(document));
    const changed = produce(document, (draft) => {
      draft.elements[ids.elementA].geometry.x++;
    });
    const parse = vi.spyOn(lockConfigurationSchema, "safeParse");
    try {
      const after = view(projection.project(changed));
      expect(after.canvases[0].containers[0].extensions).toBe(
        before.canvases[0].containers[0].extensions,
      );
      expect(after.canvases[0].textCards[0]).toBe(before.canvases[0].textCards[0]);
      expect(after.extensionInstallations[0]).toBe(before.extensionInstallations[0]);
      expect(parse).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it.each(["configure", "disable", "remove"])(
    "updates only the target on %s with unchanged elements",
    (action) => {
      const document = fixture();
      const projection = createRetainedCanvasProjection();
      const before = view(projection.project(document));
      const changed =
        action === "configure"
          ? {
              ...document,
              extensionInstallations: {
                ...document.extensionInstallations,
                [ids.extensionA]: {
                  ...document.extensionInstallations[ids.extensionA],
                  configuration: { enabled: false },
                },
              },
            }
          : produce(document, (draft) => {
              if (action === "remove") delete draft.extensionInstallations[ids.extensionA];
              else draft.extensionInstallations[ids.extensionA].enabled = false;
            });
      expect(changed.elements).toBe(document.elements);
      const after = view(projection.project(changed));
      expect(after.canvases[0].containers[0]).not.toBe(before.canvases[0].containers[0]);
      expect(after.canvases[0].textCards[0]).toBe(before.canvases[0].textCards[0]);
      expect(after.canvases[0].containers[0].extensions).toEqual(
        action === "remove" ? undefined : action === "disable" ? {} : { lock: { enabled: false } },
      );
      expect(view(projection.project(document)).canvases[0].containers[0].extensions).toEqual({
        lock: { enabled: true },
      });
    },
  );

  it("rechecks cached target compatibility after type changes", () => {
    const document = fixture();
    const projection = createRetainedCanvasProjection();
    projection.project(document);
    const changed = produce(document, (draft) => {
      draft.elements[ids.elementA].type = "unknown";
    });
    const after = projection.project(changed);
    if (after.ok) throw new Error("Expected rejection");
    expect(after.issues).toContainEqual({
      code: "incompatible-extension-target",
      extensionInstanceId: ids.extensionA,
    });
  });

  it("clears all configuration and view caches with the session owner", () => {
    const document = fixture();
    const projection = createRetainedCanvasProjection();
    const before = view(projection.project(document));
    projection.clear();
    const after = view(projection.project(document));
    expect(after).toEqual(before);
    expect(after.extensionInstallations[0]).not.toBe(before.extensionInstallations[0]);
    expect(after.canvases[0].containers[0].extensions).not.toBe(
      before.canvases[0].containers[0].extensions,
    );
  });
});
