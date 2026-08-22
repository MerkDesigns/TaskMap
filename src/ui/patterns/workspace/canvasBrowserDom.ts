import { CANVAS_BROWSER_LAYOUT, canvasBrowserPanelHeight } from "./canvasBrowserLayout";
import type { CanvasBrowserCardRecord } from "./canvasBrowserRuntimeTypes";

export function createCanvasBrowserDragLayer(owner: HTMLElement) {
  const layer = document.createElement("div");
  layer.className = "taskmap-canvas-browser-drag-layer";
  layer.dataset.canvasBrowserDragLayer = "true";
  owner.append(layer);
  return layer;
}

export function writeCanvasBrowserContentHeight(
  panel: HTMLElement,
  cardsLayer: HTMLElement,
  contentHeight: number,
) {
  cardsLayer.style.height = `${contentHeight}px`;
  panel.style.setProperty(
    "--taskmap-canvas-browser-content-height",
    `${canvasBrowserPanelHeight(contentHeight)}px`,
  );
}

export function measureCanvasBrowserCard<Id extends string>(record: CanvasBrowserCardRecord<Id>) {
  const rectangle = record.card.getBoundingClientRect();
  const mode = record.card.dataset.canvasCardMode;
  const fallback =
    mode === "minimal" ? CANVAS_BROWSER_LAYOUT.compactCardHeight : CANVAS_BROWSER_LAYOUT.cardHeight;
  const content = record.card.querySelector<HTMLElement>(".taskmap-canvas-browser-card__content");
  const editorHeight =
    mode === "editor"
      ? Math.max(
          content?.scrollHeight ?? 0,
          content?.offsetHeight ?? 0,
          content?.getBoundingClientRect().height ?? 0,
        )
      : 0;
  record.height = Math.max(1, editorHeight || fallback);
  record.host.style.height = `${record.height}px`;
  const clipOffset = Number.parseFloat(
    record.host.style.getPropertyValue("--taskmap-canvas-card-clip-offset") || "0",
  );
  const top = rectangle.top - clipOffset;
  return {
    x: rectangle.x,
    y: top,
    left: rectangle.left,
    top,
    right: rectangle.right,
    bottom: top + record.height,
    width: rectangle.width || CANVAS_BROWSER_LAYOUT.cardWidth,
    height: record.height,
    toJSON: () => ({}),
  } satisfies DOMRect;
}

export function writeDraggingCardHost<Id extends string>(
  record: CanvasBrowserCardRecord<Id>,
  rectangle: DOMRect,
  ownerRectangle: DOMRect,
) {
  writeCanvasBrowserCardViewport(record, 0, record.height, true);
  record.host.classList.add("taskmap-canvas-browser-card-host--dragging");
  record.host.style.left = `${rectangle.left - ownerRectangle.left}px`;
  record.host.style.top = `${rectangle.top - ownerRectangle.top}px`;
  record.host.style.width = `${rectangle.width || CANVAS_BROWSER_LAYOUT.cardWidth}px`;
  record.host.style.height = `${record.height}px`;
  record.host.style.transform = "none";
  record.host.dataset.dragging = "true";
  record.card.dataset.materialMotion = "active";
}

export function writeDraggingCardTop<Id extends string>(
  record: CanvasBrowserCardRecord<Id>,
  top: number,
) {
  record.host.style.top = `${top}px`;
}

export function restoreSettledCardHost<Id extends string>(record: CanvasBrowserCardRecord<Id>) {
  record.host.classList.remove("taskmap-canvas-browser-card-host--dragging");
  record.host.style.left = "";
  record.host.style.top = "";
  record.host.style.width = "";
  record.host.style.height = `${record.height}px`;
  record.host.style.transform = `translate3d(0, ${record.y}px, 0)`;
  delete record.host.dataset.dragging;
  delete record.card.dataset.materialMotion;
}

export function syncCanvasBrowserCardViewport<Id extends string>(
  record: CanvasBrowserCardRecord<Id>,
  scrollTop: number,
  viewportHeight: number,
) {
  const top = record.y - scrollTop;
  const clippedTop = Math.max(top, 0);
  const clippedBottom = Math.min(top + record.height, viewportHeight);
  const visibleHeight = Math.max(0, clippedBottom - clippedTop);
  const clipOffset = visibleHeight > 0 ? clippedTop - top : 0;
  writeCanvasBrowserCardViewport(record, clipOffset, visibleHeight, visibleHeight > 0);
}

export function writeCanvasBrowserCardViewport<Id extends string>(
  record: CanvasBrowserCardRecord<Id>,
  clipOffset: number,
  visibleHeight: number,
  visible: boolean,
) {
  record.host.style.setProperty("--taskmap-canvas-card-clip-offset", `${clipOffset}px`);
  record.host.style.setProperty("--taskmap-canvas-card-visible-height", `${visibleHeight}px`);
  record.host.style.setProperty("--taskmap-canvas-card-full-height", `${record.height}px`);
  record.host.dataset.canvasCardVisible = String(visible);
}

export function reorderCanvasBrowserHosts<Id extends string>(
  order: readonly Id[],
  records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
  cardsLayer: HTMLElement,
) {
  order.forEach((id) => {
    const host = records.get(id)?.host;
    if (host && host.parentElement === cardsLayer) cardsLayer.append(host);
  });
}
