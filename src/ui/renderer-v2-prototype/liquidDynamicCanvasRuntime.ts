import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import type { BenchmarkElementModel } from "./benchmarkTypes";
import type { DynamicElementClassification } from "./dynamicCanvasIslands";

interface DynamicCanvasElementRecord {
  readonly id: string;
  readonly group: DynamicGroupNode;
  readonly html: DynamicHtmlNode;
  readonly host: HTMLDivElement;
  positionOnly: boolean;
}

export interface DynamicGroupNode {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  remove(): void;
}

export interface DynamicHtmlNode {
  width: number;
  height: number;
  zIndex: number;
  readonly host: HTMLDivElement;
  remove(): void;
}

export interface DynamicCanvasNodeFactories {
  createGroup(parent: DynamicGroupNode, options: { x: number; y: number }): DynamicGroupNode;
  createHtml(parent: DynamicGroupNode, host: HTMLDivElement, zIndex: number): DynamicHtmlNode;
  createStackingContext(options: {
    zIndex: number;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  }): DynamicGroupNode;
}

export interface DynamicCanvasRuntimeCounts {
  readonly promotedElementCount: number;
  readonly dynamicTransformUpdates: number;
  readonly dynamicAttachTotal: number;
  readonly dynamicDetachTotal: number;
}

export class LiquidDynamicCanvasRuntime {
  private cameraGroup: DynamicGroupNode | null = null;
  private camera = { x: 0, y: 0, zoom: 1 };
  private readonly records = new Map<string, DynamicCanvasElementRecord>();
  private readonly initializedCaptureHosts = new Set<Element>();
  private transformUpdates = 0;
  private attachTotal = 0;
  private detachTotal = 0;

  constructor(
    private readonly invalidate: () => void,
    private readonly factories: DynamicCanvasNodeFactories,
  ) {}

  reconcile(classifications: readonly DynamicElementClassification[]) {
    let changed = false;
    const desiredIds = new Set(classifications.map(({ element }) => element.id));
    for (const [id, record] of this.records) {
      if (desiredIds.has(id)) continue;
      this.removeRecord(record);
      this.records.delete(id);
      changed = true;
    }
    for (const classification of classifications) {
      const { element, positionOnly } = classification;
      const current = this.records.get(element.id);
      if (current) {
        current.positionOnly = positionOnly;
        this.syncGeometry(current, element);
        continue;
      }
      this.records.set(element.id, this.createRecord(element, positionOnly));
      changed = true;
    }
    if (this.records.size === 0 && this.cameraGroup) {
      this.cameraGroup.remove();
      this.cameraGroup = null;
    }
    if (changed) this.invalidate();
    return changed;
  }

  presentCamera(viewport: CanvasViewport) {
    const { x, y } = viewport.pan;
    this.camera = { x, y, zoom: viewport.zoom };
    const cameraGroup = this.cameraGroup;
    if (!cameraGroup) return;
    const changed =
      cameraGroup.x !== x ||
      cameraGroup.y !== y ||
      cameraGroup.scaleX !== viewport.zoom ||
      cameraGroup.scaleY !== viewport.zoom;
    if (!changed) return;
    Object.assign(cameraGroup, {
      x,
      y,
      scaleX: viewport.zoom,
      scaleY: viewport.zoom,
    });
    this.transformUpdates += 1;
    this.invalidate();
  }

  presentElementPosition(id: string, x: number, y: number) {
    const record = this.records.get(id);
    if (!record || (record.group.x === x && record.group.y === y)) return;
    record.group.x = x;
    record.group.y = y;
    this.transformUpdates += 1;
    this.invalidate();
  }

  syncElement(element: BenchmarkElementModel) {
    const record = this.records.get(element.id);
    if (!record) return;
    this.syncGeometry(record, element);
    this.invalidate();
  }

  hasElement(id: string) {
    return this.records.has(id);
  }

  getHost(id: string) {
    return this.records.get(id)?.host ?? null;
  }

  classifyCaptureSource(source: unknown) {
    for (const record of this.records.values()) {
      if (source === record.html.host) return { positionOnly: record.positionOnly };
    }
    return null;
  }

  paintTouchesCapture(event: Event) {
    const changedElements = readChangedElements(event);
    if (!changedElements) return true;
    return changedElements.some((element) =>
      [...this.records.values()].some(
        (record) => element === record.html.host || record.html.host.contains(element),
      ),
    );
  }

  isCaptureHostOnlyPaint(event: Event) {
    const changedElements = readChangedElements(event);
    if (
      !changedElements?.length ||
      !changedElements.every((element) => this.ownsCaptureHost(element))
    ) {
      return false;
    }
    const initialized = changedElements.every((element) =>
      this.initializedCaptureHosts.has(element),
    );
    changedElements.forEach((element) => this.initializedCaptureHosts.add(element));
    return initialized;
  }

  getCounts(): DynamicCanvasRuntimeCounts {
    return {
      promotedElementCount: this.records.size,
      dynamicTransformUpdates: this.transformUpdates,
      dynamicAttachTotal: this.attachTotal,
      dynamicDetachTotal: this.detachTotal,
    };
  }

  resetCounters() {
    this.transformUpdates = 0;
    this.attachTotal = 0;
    this.detachTotal = 0;
  }

  destroy() {
    for (const record of this.records.values()) this.removeRecord(record);
    this.records.clear();
    this.initializedCaptureHosts.clear();
    this.cameraGroup?.remove();
    this.cameraGroup = null;
  }

  private createRecord(element: BenchmarkElementModel, positionOnly: boolean) {
    const group = this.factories.createGroup(this.ensureCameraGroup(), {
      x: element.x,
      y: element.y,
    });
    const host = document.createElement("div");
    host.className = "renderer-benchmark__liquid-element-host";
    const html = this.factories.createHtml(group, host, element.z);
    const record = { id: element.id, group, html, host, positionOnly };
    this.syncGeometry(record, element);
    this.attachTotal += 1;
    return record;
  }

  private syncGeometry(record: DynamicCanvasElementRecord, element: BenchmarkElementModel) {
    record.group.x = element.x;
    record.group.y = element.y;
    record.html.width = element.width;
    record.html.height = element.height;
    record.html.zIndex = element.z;
    record.host.style.width = `${element.width}px`;
    record.host.style.height = `${element.height}px`;
  }

  private removeRecord(record: DynamicCanvasElementRecord) {
    this.initializedCaptureHosts.delete(record.html.host);
    record.html.remove();
    record.group.remove();
    record.host.remove();
    this.detachTotal += 1;
  }

  private ownsCaptureHost(element: Element) {
    for (const record of this.records.values()) if (record.html.host === element) return true;
    return false;
  }

  private ensureCameraGroup() {
    if (!this.cameraGroup) {
      // The local stacking context stays below application glass (z >= 40). It cannot interleave
      // static and promoted elements across the single coarse texture.
      this.cameraGroup = this.factories.createStackingContext({
        zIndex: 1,
        x: this.camera.x,
        y: this.camera.y,
        scaleX: this.camera.zoom,
        scaleY: this.camera.zoom,
      });
    }
    return this.cameraGroup;
  }
}

function readChangedElements(event: Event) {
  const value = (event as Event & { changedElements?: unknown }).changedElements;
  if (!Array.isArray(value)) return null;
  return value.filter((element): element is Element => element instanceof Element);
}
