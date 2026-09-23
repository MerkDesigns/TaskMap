import { subscribeMaterialTuningChanged } from "./materialGeometryInvalidation";

export interface MaterialSize {
  readonly width: number;
  readonly height: number;
}

/** Read cache for a single geometry transaction. Never retain it across frames. */
export class MaterialGeometryFrame {
  private readonly rectangles = new Map<Element, DOMRect>();
  private readonly styles = new Map<Element, CSSStyleDeclaration>();

  rectangle(element: Element): DOMRect {
    let rectangle = this.rectangles.get(element);
    if (!rectangle) {
      rectangle = element.getBoundingClientRect();
      this.rectangles.set(element, rectangle);
    }
    return rectangle;
  }

  style(element: Element): CSSStyleDeclaration {
    let style = this.styles.get(element);
    if (!style) {
      style = getComputedStyle(element);
      this.styles.set(element, style);
    }
    return style;
  }

  size(element: HTMLElement): MaterialSize {
    const style = this.style(element);
    const extra = (properties: string[]) =>
      properties.reduce(
        (total, property) => total + (Number.parseFloat(style.getPropertyValue(property)) || 0),
        0,
      );
    const borderBox = style.boxSizing === "border-box";
    const width = Number.parseFloat(style.width);
    const height = Number.parseFloat(style.height);
    return {
      width: Number.isFinite(width)
        ? width +
          (borderBox
            ? 0
            : extra(["padding-left", "padding-right", "border-left-width", "border-right-width"]))
        : element.offsetWidth,
      height: Number.isFinite(height)
        ? height +
          (borderBox
            ? 0
            : extra(["padding-top", "padding-bottom", "border-top-width", "border-bottom-width"]))
        : element.offsetHeight,
    };
  }
}

export type MaterialGeometryReason = "layout" | "scroll";

interface GeometryWork {
  readonly read: (
    frame: MaterialGeometryFrame,
    reason: MaterialGeometryReason,
  ) => (() => void) | void;
  /** List owners run before the material consumers of their dimensions. */
  readonly owner?: boolean;
  readonly scrollRoot?: HTMLElement;
  readonly descendantScroll?: boolean;
}

const work = new Set<GeometryWork>();
const dirty = new Map<GeometryWork, MaterialGeometryReason>();
const observed = new Map<Element, Set<GeometryWork>>();
let observer: ResizeObserver | null = null;
let frameHandle: number | null = null;
let flushing = false;
let unsubscribeTuning: (() => void) | undefined;

function schedule(item: GeometryWork, reason: MaterialGeometryReason = "layout") {
  if (!work.has(item)) return;
  dirty.set(item, dirty.get(item) === "layout" ? "layout" : reason);
  if (frameHandle === null && !flushing) frameHandle = requestAnimationFrame(flush);
}

function flush() {
  frameHandle = null;
  flushing = true;
  const frame = new MaterialGeometryFrame();
  const writes: (() => void)[] = [];
  const read = new Set<GeometryWork>();
  try {
    while (dirty.size) {
      const batch = [...dirty].sort(([a], [b]) => Number(!!b.owner) - Number(!!a.owner));
      dirty.clear();
      for (const [item, reason] of batch) {
        if (!work.has(item) || read.has(item)) continue;
        read.add(item);
        const write = item.read(frame, reason);
        if (write) writes.push(write);
      }
    }
    for (const write of writes) write();
  } finally {
    flushing = false;
    if (dirty.size && frameHandle === null) frameHandle = requestAnimationFrame(flush);
  }
}

function invalidateAll() {
  work.forEach((item) => schedule(item));
}

function onScroll(event: Event) {
  const target = event.target;
  for (const item of work) {
    const root = item.scrollRoot;
    if (
      root &&
      (target === document ||
        target === window ||
        (target instanceof Node &&
          (target.contains(root) || (item.descendantScroll && root.contains(target)))))
    )
      schedule(item, "scroll");
  }
}

/** Geometry scheduling only; this does not register or render compositor surfaces. */
export function registerMaterialGeometryWork(item: GeometryWork, elements: readonly Element[]) {
  if (work.size === 0) {
    observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            for (const entry of entries)
              observed.get(entry.target)?.forEach((item) => schedule(item));
          });
    window.addEventListener("resize", invalidateAll);
    window.addEventListener("scroll", onScroll, true);
    if (import.meta.env.DEV) unsubscribeTuning = subscribeMaterialTuningChanged(invalidateAll);
  }
  work.add(item);
  let currentElements = new Set<Element>();
  const observe = (next: readonly Element[]) => {
    const nextSet = new Set(next);
    for (const element of currentElements) {
      const items = observed.get(element);
      if (!nextSet.has(element) && items?.delete(item) && items.size === 0) {
        observed.delete(element);
        observer?.unobserve(element);
      }
    }
    for (const element of nextSet) {
      let items = observed.get(element);
      if (!items) {
        items = new Set();
        observed.set(element, items);
        observer?.observe(element);
      }
      items.add(item);
    }
    currentElements = nextSet;
  };
  observe(elements);
  schedule(item);
  return {
    invalidate: () => schedule(item),
    observe,
    dispose: () => {
      observe([]);
      dirty.delete(item);
      work.delete(item);
      if (work.size) return;
      observer?.disconnect();
      observer = null;
      if (frameHandle !== null) cancelAnimationFrame(frameHandle);
      frameHandle = null;
      window.removeEventListener("resize", invalidateAll);
      window.removeEventListener("scroll", onScroll, true);
      unsubscribeTuning?.();
      unsubscribeTuning = undefined;
    },
  };
}
