import { CANVAS_BROWSER_LAYOUT, canvasBrowserPanelHeight } from "./canvasBrowserLayout";
import type { CanvasBrowserCardRecord } from "./canvasBrowserRuntimeTypes";
import { notifyWorkspacePanelContentSizeChanged } from "./workspacePanelContentSize";
import { supplyMaterialSurfaceSize } from "../../materials/materialGeometryInvalidation";
import { MaterialGeometryFrame } from "../../materials/materialGeometryScheduler";
import { writeGlassListEffectsClip } from "./glassListGeometry";

export function readCanvasBrowserDragFrame(viewport: HTMLElement, card?: HTMLElement) {
  const frame = new MaterialGeometryFrame();
  // Read shared coordinate spaces before presentation writes, including activation's card rect.
  frame.rectangle(viewport);
  if (card) frame.rectangle(card);
  return frame;
}

export function writeCanvasBrowserContentHeight(
  panel: HTMLElement,
  cardsLayer: HTMLElement,
  contentHeight: number,
) {
  const panelHeight = canvasBrowserPanelHeight(contentHeight);
  const nextPanelHeight = `${panelHeight}px`;
  cardsLayer.style.height = `${contentHeight}px`;
  if (panel.style.getPropertyValue("--taskmap-canvas-browser-content-height") === nextPanelHeight) {
    return;
  }
  panel.style.setProperty("--taskmap-canvas-browser-content-height", nextPanelHeight);
  notifyWorkspacePanelContentSizeChanged(panel, panelHeight);
}

export function measureCanvasBrowserCard<Id extends string>(record: CanvasBrowserCardRecord<Id>) {
  const mode = record.card.dataset.canvasCardMode;
  const fallback =
    mode === "minimal" ? CANVAS_BROWSER_LAYOUT.compactCardHeight : CANVAS_BROWSER_LAYOUT.cardHeight;
  const content = record.card.querySelector<HTMLElement>(".taskmap-canvas-browser-card__content");
  const editorHeight =
    mode === "editor" ? Math.max(content?.scrollHeight ?? 0, content?.offsetHeight ?? 0) : 0;
  record.height = Math.max(1, editorHeight || fallback);
}

export function canvasBrowserCardRectangle<Id extends string>(record: CanvasBrowserCardRecord<Id>) {
  const rectangle = record.card.getBoundingClientRect();
  const top = rectangle.top;
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
  record.host.style.width = `${rectangle.width || CANVAS_BROWSER_LAYOUT.cardWidth}px`;
  record.host.style.height = `${record.height}px`;
  record.host.style.setProperty(
    "--taskmap-canvas-card-y",
    `${rectangle.top - ownerRectangle.top}px`,
  );
  record.host.style.top = "0px";
  record.host.dataset.dragging = "true";
}

export function writeDraggingCardTop<Id extends string>(
  record: CanvasBrowserCardRecord<Id>,
  top: number,
) {
  record.host.style.setProperty("--taskmap-canvas-card-y", `${top}px`);
}

export function restoreSettledCardHost<Id extends string>(record: CanvasBrowserCardRecord<Id>) {
  record.host.classList.remove("taskmap-canvas-browser-card-host--dragging");
  record.host.style.left = "";
  record.host.style.top = "";
  record.host.style.width = "";
  record.host.style.height = `${record.height}px`;
  delete record.host.dataset.dragging;
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
  record.host.style.setProperty("--taskmap-canvas-card-y", `${top}px`);
  writeGlassListEffectsClip(record.host, top, record.height, viewportHeight);
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
  supplyMaterialSurfaceSize(record.card, {
    width: CANVAS_BROWSER_LAYOUT.cardWidth,
    height: record.height,
  })?.();
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
