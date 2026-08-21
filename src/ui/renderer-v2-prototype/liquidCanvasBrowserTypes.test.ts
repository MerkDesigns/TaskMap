import { describe, expect, expectTypeOf, it } from "vitest";
import { reorderCanvasCardToIndex } from "./benchmarkCanvasCardInteraction";
import type { LiquidCanvasBrowserRuntime } from "./liquidCanvasBrowserRuntime";
import type { CanvasBrowserCardPresentation } from "./liquidCanvasBrowserPresentation";
import type { CanvasCardDragState } from "./liquidCanvasBrowserTypes";
import type { LiquidCanvasCardRecord } from "./liquidCanvasCardGeometry";

type BrandedCanvasId = string & { readonly canvasIdBrand: unique symbol };

describe("Canvas Browser ID contract", () => {
  it("preserves branded strings through reusable collections and callbacks", () => {
    type Runtime = LiquidCanvasBrowserRuntime<BrandedCanvasId>;
    type Presentation = CanvasBrowserCardPresentation<BrandedCanvasId>;
    type Drag = CanvasCardDragState<BrandedCanvasId>;

    expectTypeOf<Parameters<Runtime["reconcile"]>[0]>().toEqualTypeOf<readonly BrandedCanvasId[]>();
    expectTypeOf<Parameters<Runtime["getCardHost"]>[0]>().toEqualTypeOf<BrandedCanvasId>();
    expectTypeOf<Parameters<Runtime["attachOrderCommit"]>[0]>().toEqualTypeOf<
      (order: readonly BrandedCanvasId[]) => void
    >();
    expectTypeOf<Parameters<Presentation["apply"]>[0]>().toEqualTypeOf<
      ReadonlyMap<BrandedCanvasId, LiquidCanvasCardRecord<BrandedCanvasId>>
    >();
    expectTypeOf<Drag["id"]>().toEqualTypeOf<BrandedCanvasId>();
    expectTypeOf<Drag["order"]>().toEqualTypeOf<readonly BrandedCanvasId[]>();

    const first = "canvas-1" as BrandedCanvasId;
    const second = "canvas-2" as BrandedCanvasId;
    const reordered = reorderCanvasCardToIndex([first, second], first, 1);
    expectTypeOf(reordered).toMatchTypeOf<readonly BrandedCanvasId[]>();
    expect(reordered).toEqual([second, first]);
  });
});
