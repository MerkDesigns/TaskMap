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
  const origin = frame.rectangle(plane.parentElement ?? viewport);
  const relative = (element: HTMLElement): MaterialRectangle => {
    const rectangle = frame.rectangle(element);
    return {
      left: rectangle.left - origin.left,
      top: rectangle.top - origin.top,
      width: rectangle.width,
      height: rectangle.height,
    };
  };
  const scrollChain = (element: HTMLElement | null): ScrollPosition[] => {
    const chain: ScrollPosition[] = [];
    for (let parent = element; parent && viewport.contains(parent); parent = parent.parentElement) {
      chain.push({ element: parent, left: parent.scrollLeft, top: parent.scrollTop });
    }
    return chain;
  };
  const rootClip = { rectangle: relative(viewport), scroll: [] };
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
        clip = { rectangle: relative(parent), scroll: scrollChain(parent.parentElement) };
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
  return cards.flatMap((card) => {
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
    return shape ? [shape] : [];
  });
}
