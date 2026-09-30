import type {
  MaterialGeometryFrame,
  MaterialSize,
} from "../../materials/materialGeometryScheduler";
import type { MaterialRectangle } from "../../materials/materialSamplingBoundary";
import type { SharedSmallGlassShape } from "../../materials/SharedSmallGlassPlane";
import { glassListShape } from "./glassListGeometry";

interface ScrollPosition {
  readonly element: HTMLElement;
  readonly left: number;
  readonly top: number;
}

interface ListClip {
  readonly rectangle: MaterialRectangle;
  readonly scroll: readonly ScrollPosition[];
}

interface ListCard {
  readonly element: HTMLElement;
  readonly size: MaterialSize;
  readonly shape: SharedSmallGlassShape;
  readonly scroll: readonly ScrollPosition[];
  readonly clips: readonly ListClip[];
}

/** Layout snapshots are replaced on size/content/tuning changes, not native scroll events. */
export function readGlassListLayout(
  frame: MaterialGeometryFrame,
  viewport: HTMLElement,
  plane: HTMLElement,
  selector: string,
): readonly ListCard[] {
  const owner = plane.parentElement ?? viewport;
  const origin = frame.rectangle(owner);
  // Measured rectangles include ancestor transforms (e.g. a presence scale-in); convert them back
  // to the owner's local, untransformed coordinates so the snapshot stays valid once it settles.
  const layoutWidth = frame.size(owner).width;
  const measuredScale = layoutWidth > 0 && origin.width > 0 ? origin.width / layoutWidth : 1;
  const scale = Math.abs(measuredScale - 1) < 0.001 ? 1 : measuredScale;
  const relative = (element: HTMLElement): MaterialRectangle => {
    const rectangle = frame.rectangle(element);
    return {
      left: (rectangle.left - origin.left) / scale,
      top: (rectangle.top - origin.top) / scale,
      width: rectangle.width / scale,
      height: rectangle.height / scale,
    };
  };
  // A viewport's padding is an effects gutter (shadows), not visible list area: clip to content box.
  const contentBox = (element: HTMLElement): MaterialRectangle => {
    const box = relative(element);
    const style = frame.style(element);
    const inset = (side: string) =>
      Number.parseFloat(style.getPropertyValue(`padding-${side}`)) || 0;
    const top = inset("top");
    const left = inset("left");
    return {
      left: box.left + left,
      top: box.top + top,
      width: Math.max(0, box.width - left - inset("right")),
      height: Math.max(0, box.height - top - inset("bottom")),
    };
  };
  const scrollChain = (element: HTMLElement | null): ScrollPosition[] => {
    const chain: ScrollPosition[] = [];
    for (let parent = element; parent && viewport.contains(parent); parent = parent.parentElement) {
      chain.push({ element: parent, left: parent.scrollLeft, top: parent.scrollTop });
    }
    return chain;
  };
  const rootClip = { rectangle: contentBox(viewport), scroll: [] };
  const clips = new Map<HTMLElement, ListClip>();
  return [...viewport.querySelectorAll<HTMLElement>(selector)].map((element) => {
    const rectangle = relative(element);
    const boundaries: ListClip[] = [rootClip];
    for (
      let parent = element.parentElement;
      parent && parent !== viewport;
      parent = parent.parentElement
    ) {
      if (!parent.hasAttribute("data-shared-small-glass-viewport")) continue;
      let clip = clips.get(parent);
      if (!clip) {
        clip = { rectangle: contentBox(parent), scroll: scrollChain(parent.parentElement) };
        clips.set(parent, clip);
      }
      boundaries.push(clip);
    }
    return {
      element,
      size: frame.size(element),
      scroll: scrollChain(element.parentElement),
      clips: boundaries,
      shape: {
        x: rectangle.left,
        y: rectangle.top,
        width: rectangle.width,
        height: rectangle.height,
        radius: Number.parseFloat(element.style.getPropertyValue("--taskmap-material-radius")) || 0,
      },
    };
  });
}

export function projectGlassListScroll(cards: readonly ListCard[]): SharedSmallGlassShape[] {
  return projectGlassListSlices(cards).flatMap(({ shape }) => (shape ? [shape] : []));
}

export interface GlassListSlice {
  readonly element: HTMLElement;
  readonly size: MaterialSize;
  /** Viewport-clipped shape, or null when the card is scrolled fully out of view. */
  readonly shape: SharedSmallGlassShape | null;
}

/** Projects cached cards through current scroll offsets; no layout reads. */
export function projectGlassListSlices(cards: readonly ListCard[]): GlassListSlice[] {
  const positions = new Map<HTMLElement, { left: number; top: number }>();
  const delta = (chain: readonly ScrollPosition[]) =>
    chain.reduce(
      (sum, initial) => {
        let current = positions.get(initial.element);
        if (!current) {
          current = { left: initial.element.scrollLeft, top: initial.element.scrollTop };
          positions.set(initial.element, current);
        }
        return {
          left: sum.left + current.left - initial.left,
          top: sum.top + current.top - initial.top,
        };
      },
      { left: 0, top: 0 },
    );
  return cards.map((card) => {
    const offset = delta(card.scroll);
    const clips = card.clips.map((clip) => {
      const offset = delta(clip.scroll);
      return {
        ...clip.rectangle,
        left: clip.rectangle.left - offset.left,
        top: clip.rectangle.top - offset.top,
      };
    });
    const shape = glassListShape(
      { ...card.shape, x: card.shape.x - offset.left, y: card.shape.y - offset.top },
      ...clips,
    );
    return { element: card.element, size: card.size, shape };
  });
}

/** Top/right/bottom/left insets from the full card box to its visible slice; null when hidden. */
export function glassListSliceInsets({ shape, size }: GlassListSlice): readonly number[] | null {
  if (!shape) return null;
  const clip = shape.clip ?? {
    left: shape.x,
    top: shape.y,
    width: shape.width,
    height: shape.height,
  };
  return [
    clip.top - shape.y,
    shape.x + size.width - (clip.left + clip.width),
    shape.y + size.height - (clip.top + clip.height),
    clip.left - shape.x,
  ].map((inset) => Math.max(0, inset));
}

export function glassListSlicedSize(card: GlassListSlice): MaterialSize {
  const insets = glassListSliceInsets(card);
  if (!insets) return card.size;
  return {
    width: Math.max(0, card.size.width - insets[1] - insets[3]),
    height: Math.max(0, card.size.height - insets[0] - insets[2]),
  };
}
