import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  readNativeGlassDiagnostics,
  SharedSmallGlassPlane,
  writeSharedSmallGlassShapes,
} from "../../materials/SharedSmallGlassPlane";
import {
  LEFT_CHROME_GLASS_BATCH,
  RIGHT_CHROME_GLASS_BATCH,
  WorkspaceChromeGlassBatches,
} from "./WorkspaceChromeGlassBatches";

describe("WorkspaceChromeGlassBatches", () => {
  it("shares one two-pass Large source across nearby left chrome and isolates the right batch", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.testTarget === "toolbar-a") return rectangle(16, 16, 160, 42);
      if (this.dataset.testTarget === "toolbar-b") return rectangle(188, 16, 88, 42);
      if (this.dataset.testTarget === "panel") return rectangle(16, 70, 288, 420);
      if (this.dataset.testTarget === "controls") return rectangle(860, 16, 140, 42);
      return rectangle(0, 0, 0, 0);
    });
    const { container } = render(
      <div>
        <WorkspaceChromeGlassBatches />
        <div data-test-target="toolbar-a" data-glass-batch-target={LEFT_CHROME_GLASS_BATCH} />
        <div data-test-target="toolbar-b" data-glass-batch-target={LEFT_CHROME_GLASS_BATCH} />
        <div data-test-target="panel" data-glass-batch-target={LEFT_CHROME_GLASS_BATCH} />
        <div data-test-target="controls" data-glass-batch-target={RIGHT_CHROME_GLASS_BATCH} />
      </div>,
    );

    const left = container.querySelector<HTMLElement>(
      `[data-glass-batch-id="${LEFT_CHROME_GLASS_BATCH}"]`,
    )!;
    const right = container.querySelector<HTMLElement>(
      `[data-glass-batch-id="${RIGHT_CHROME_GLASS_BATCH}"]`,
    )!;
    expect(left).toHaveAttribute("data-glass-batch-state", "active");
    expect(left.querySelectorAll("rect")).toHaveLength(3);
    expect(left.querySelectorAll("[data-native-filter-layer]")).toHaveLength(2);
    expect(right).toHaveAttribute("data-glass-batch-state", "active");
    expect(right.querySelectorAll("rect")).toHaveLength(1);
    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      activeDepthCount: 1,
      activeGlassBatchCount: 2,
      localMaterialBackdropFilterCount: 0,
      nativeBackdropFilterLayerCount: 4,
    });
  });

  it("holds the complete Canvas Browser pipeline at three batches and five filter layers during drag", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.testTarget === "left") return rectangle(16, 16, 288, 480);
      if (this.dataset.testTarget === "right") return rectangle(860, 16, 140, 42);
      return rectangle(0, 0, 0, 0);
    });
    const { container } = render(
      <div>
        <WorkspaceChromeGlassBatches />
        <div data-test-target="left" data-glass-batch-target={LEFT_CHROME_GLASS_BATCH} />
        <div data-test-target="right" data-glass-batch-target={RIGHT_CHROME_GLASS_BATCH} />
        <SharedSmallGlassPlane />
      </div>,
    );
    const small = container.querySelector<HTMLElement>("[data-shared-small-glass-plane]")!;
    writeSharedSmallGlassShapes(small, [{ x: 12, y: 58, width: 264, height: 84, radius: 13.5 }]);
    const beforeDrag = readNativeGlassDiagnostics(container);
    small.dataset.glassDragRegionActive = "true";
    const duringDrag = readNativeGlassDiagnostics(container);

    expect(beforeDrag).toMatchObject({
      activeDepthCount: 2,
      activeGlassBatchCount: 3,
      nativeBackdropFilterLayerCount: 5,
      sharedSmallBatchCount: 1,
      temporaryDragBatchActive: false,
    });
    expect(duringDrag).toMatchObject({
      activeGlassBatchCount: 3,
      nativeBackdropFilterLayerCount: 5,
      temporaryDragBatchActive: true,
    });
  });
});

function rectangle(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  };
}
