import { IconArrowDownRight, IconLoader2, IconPhotoPlus } from "@tabler/icons-react";
import { memo, useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { placementStyle, shallowEqual } from "../elementPlacement";
import type { ImageDocumentElement, ImageMediaMetadata } from "./imageModel";
import "./image.css";

/** Session-bound media URLs; a lease keeps its object URL alive until released. */
export interface ImageMediaLeases {
  readonly acquire: (media: ImageMediaMetadata) => {
    readonly ready: Promise<string | null>;
    readonly release: () => void;
  };
}

/** Transient presentation state of an image; everything persistent is read from its element. */
export interface ImageViewState {
  readonly layer: number;
  /** The stored geometry, or the live preview while the image is moved or resized. */
  readonly geometry: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** The media the element references; null for an empty image. */
  readonly media: ImageMediaMetadata | null;
  /** A picked or dropped file is still being imported. */
  readonly importing: boolean;
  readonly selected: boolean;
  readonly entering: boolean;
  readonly deleting: boolean;
  readonly dragging: boolean;
  /** Moving or resizing: geometry follows the pointer without easing. */
  readonly gesture: boolean;
  readonly shadowsUnderElements: boolean;
}

/** Image actions by element id; callers pass one referentially stable object. */
export interface ImageActions {
  readonly onStartMove: (event: PointerEvent<HTMLElement>, id: string) => void;
  readonly onStartResize: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
  readonly onOpenMenu: (event: MouseEvent<HTMLElement>, id: string) => void;
  /** Opens the file picker for an empty image. */
  readonly onPick: (id: string) => void;
}

export interface ImageRendererProps {
  readonly element: ImageDocumentElement;
  readonly view: ImageViewState;
  readonly actions: ImageActions;
  readonly leases: ImageMediaLeases;
}

/** Two presses this close in time and place on an empty image open the picker. */
const DOUBLE_PRESS_MS = 420;
const DOUBLE_PRESS_DISTANCE = 6;

/** Leases an object URL only while the image is mounted, i.e. visible or about to be. */
function useMediaUrl(media: ImageMediaMetadata | null, leases: ImageMediaLeases) {
  const [loaded, setLoaded] = useState<{ media: ImageMediaMetadata; url: string | null } | null>(
    null,
  );
  useEffect(() => {
    if (!media) return;
    let active = true;
    const lease = leases.acquire(media);
    void lease.ready.then((url) => {
      if (active) setLoaded({ media, url });
    });
    return () => {
      active = false;
      lease.release();
    };
  }, [media, leases]);
  const settled = media !== null && loaded?.media === media;
  return { settled, url: settled ? loaded.url : null };
}

function ImageRendererComponent({ element, view, actions, leases }: ImageRendererProps) {
  const { id, data } = element;
  const { geometry, media } = view;
  const { settled, url } = useMediaUrl(media, leases);
  const loading = view.importing || (media !== null && !settled);
  const empty = media === null;
  const chromeless = !empty && !loading && !data.background;
  const lastEmptyPressRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const startPress = (event: PointerEvent<HTMLElement>) => {
    if (empty && event.button === 0) {
      const now = window.performance.now();
      const last = lastEmptyPressRef.current;
      if (
        last &&
        now - last.time < DOUBLE_PRESS_MS &&
        Math.abs(event.clientX - last.x) < DOUBLE_PRESS_DISTANCE &&
        Math.abs(event.clientY - last.y) < DOUBLE_PRESS_DISTANCE
      ) {
        lastEmptyPressRef.current = null;
        event.preventDefault();
        event.stopPropagation();
        actions.onPick(id);
        return;
      }
      lastEmptyPressRef.current = { time: now, x: event.clientX, y: event.clientY };
    }
    if (empty && event.detail > 1) {
      event.stopPropagation();
      return;
    }
    actions.onStartMove(event, id);
  };

  const shadowClass =
    chromeless || view.shadowsUnderElements
      ? ""
      : ` canvas-attached-shadow-card${view.dragging || view.gesture ? " canvas-attached-drag-shadow" : ""}`;

  return (
    <div
      className={`taskmap-image${shadowClass}`}
      data-chromeless={chromeless || undefined}
      data-dragging={view.dragging || undefined}
      data-gesture={view.gesture || undefined}
      data-entering={view.entering || undefined}
      data-deleting={view.deleting || undefined}
      style={{
        zIndex: view.dragging ? 10000 : 20 + view.layer,
        ...placementStyle(geometry),
        borderColor: chromeless
          ? undefined
          : view.selected
            ? `color-mix(in srgb, ${data.accent} 72%, white 28%)`
            : data.accent,
      }}
      onPointerDown={startPress}
      onContextMenu={(event) => actions.onOpenMenu(event, id)}
    >
      {empty && !loading ? (
        <div className="taskmap-image__status" data-kind="empty">
          <IconPhotoPlus size={28} stroke={2} />
          <span className="taskmap-image__hint">Double-click to add image</span>
          <span className="taskmap-image__subhint">or drop a file here</span>
        </div>
      ) : loading ? (
        <div className="taskmap-image__status" data-kind="loading">
          <IconLoader2 size={30} stroke={2} />
        </div>
      ) : !url ? (
        <div role="status" className="taskmap-image__status">
          Image unavailable
        </div>
      ) : (
        <img src={url} alt="" draggable={false} className="taskmap-image__picture" />
      )}

      <button
        type="button"
        aria-label="Resize image"
        className="taskmap-image__resize"
        onPointerDown={(event) => actions.onStartResize(event, id)}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      >
        <IconArrowDownRight size={16} stroke={2} />
      </button>
      <div
        className={`selection-overlay taskmap-image__selection${
          view.selected ? " selection-overlay-active" : ""
        }`}
      />
    </div>
  );
}

/** Callers rebuild the view state each render; compare it by value so idle images never re-render. */
const areImagePropsEqual = (previous: ImageRendererProps, next: ImageRendererProps) => {
  if (
    previous.element !== next.element ||
    previous.actions !== next.actions ||
    previous.leases !== next.leases
  ) {
    return false;
  }
  const { geometry: previousGeometry, ...previousView } = previous.view;
  const { geometry: nextGeometry, ...nextView } = next.view;
  return shallowEqual(previousView, nextView) && shallowEqual(previousGeometry, nextGeometry);
};

export const ImageRenderer = memo(ImageRendererComponent, areImagePropsEqual);
