import { afterEach, describe, expect, it, vi } from "vitest";
import type { BenchmarkElementModel } from "./benchmarkTypes";
import {
  LiquidDynamicCanvasRuntime,
  type DynamicCanvasNodeFactories,
} from "./liquidDynamicCanvasRuntime";

interface FakeLiquidNode {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  zIndex: number;
  parent: FakeLiquidNode | null;
}

const liquid = {
  groups: [] as FakeLiquidNode[],
  html: [] as Array<FakeLiquidNode & { host: HTMLDivElement }>,
};

class FakeNode {
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  scaleX = 1;
  scaleY = 1;
  zIndex = 0;
  parent: FakeNode | null = null;
  children: FakeNode[] = [];
  constructor(options?: unknown) {
    Object.assign(this, options);
  }
  add<T>(child: T) {
    if (child instanceof FakeNode) {
      child.remove();
      child.parent = this;
      this.children.push(child);
    }
    return child;
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
}

class FakeGroup extends FakeNode {
  constructor(options?: unknown) {
    super(options);
    liquid.groups.push(this);
  }
}

class FakeHtml extends FakeNode {
  readonly host = document.createElement("div");
  constructor(element: HTMLDivElement, zIndex: number) {
    super({ zIndex });
    this.host.append(element);
    liquid.html.push(this);
  }
}

const scene = new FakeNode();
const factories: DynamicCanvasNodeFactories = {
  createGroup: (parent, options) => (parent as FakeGroup).add(new FakeGroup(options)) as FakeGroup,
  createHtml: (parent, host, zIndex) =>
    (parent as FakeGroup).add(new FakeHtml(host, zIndex)) as FakeHtml,
  createStackingContext: (options) => scene.add(new FakeGroup(options)),
};

afterEach(() => {
  liquid.groups.length = 0;
  liquid.html.length = 0;
  scene.children.length = 0;
});

const element = (overrides: Partial<BenchmarkElementModel> = {}): BenchmarkElementModel => ({
  id: "text-card-1",
  kind: "text-card",
  x: 120,
  y: 160,
  width: 248,
  height: 164,
  z: 10,
  ordinal: 0,
  ...overrides,
});

describe("Liquid dynamic Canvas runtime", () => {
  it("creates one stable Html membership and moves only its Liquid Group", () => {
    const invalidate = vi.fn();
    const runtime = new LiquidDynamicCanvasRuntime(invalidate, factories);
    const model = element();

    expect(runtime.reconcile([{ element: model, positionOnly: true }])).toBe(true);
    const elementGroup = liquid.groups[1];
    const html = liquid.html[0];
    expect(runtime.getHost(model.id)).toBeInstanceOf(HTMLDivElement);
    expect(html).toMatchObject({ width: 248, height: 164, zIndex: 10 });
    expect(runtime.getHost(model.id)?.style).toMatchObject({ width: "248px", height: "164px" });

    runtime.presentElementPosition(model.id, 154, 160);
    expect(elementGroup).toMatchObject({ x: 154, y: 160 });
    expect(html).toMatchObject({ width: 248, height: 164 });
    expect(runtime.reconcile([{ element: model, positionOnly: true }])).toBe(false);
    expect(liquid.html).toHaveLength(1);
    expect(runtime.getCounts()).toMatchObject({
      promotedElementCount: 1,
      dynamicAttachTotal: 1,
      dynamicDetachTotal: 0,
      dynamicTransformUpdates: 1,
    });
  });

  it("filters transform-only host paint after the initial capture but permits GIF descendants", () => {
    const runtime = new LiquidDynamicCanvasRuntime(vi.fn(), factories);
    runtime.reconcile([{ element: element(), positionOnly: true }]);
    const captureHost = liquid.html[0]?.host;
    const first = paintEvent([captureHost]);
    const subsequent = paintEvent([captureHost]);

    expect(runtime.isCaptureHostOnlyPaint(first)).toBe(false);
    expect(runtime.isCaptureHostOnlyPaint(subsequent)).toBe(true);

    const gif = document.createElement("img");
    runtime.getHost("text-card-1")?.append(gif);
    const gifPaint = paintEvent([gif]);
    expect(runtime.isCaptureHostOnlyPaint(gifPaint)).toBe(false);
    expect(runtime.paintTouchesCapture(gifPaint)).toBe(true);
  });

  it("updates the camera Group and restores static representation with one detach", () => {
    const runtime = new LiquidDynamicCanvasRuntime(vi.fn(), factories);
    runtime.reconcile([{ element: element(), positionOnly: true }]);

    runtime.presentCamera({
      pan: { x: 48, y: -30 },
      zoom: 1.25,
      screen: { width: 900, height: 700 },
    });
    expect(liquid.groups[0]).toMatchObject({ x: 48, y: -30, scaleX: 1.25, scaleY: 1.25 });
    expect(runtime.reconcile([])).toBe(true);
    expect(runtime.hasElement("text-card-1")).toBe(false);
    expect(runtime.getCounts()).toMatchObject({
      promotedElementCount: 0,
      dynamicAttachTotal: 1,
      dynamicDetachTotal: 1,
      dynamicTransformUpdates: 1,
    });
  });
});

function paintEvent(changedElements: Array<Element | undefined>) {
  const event = new Event("paint");
  Object.defineProperty(event, "changedElements", {
    value: changedElements.filter((element): element is Element => Boolean(element)),
  });
  return event;
}
