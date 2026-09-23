import type { DocumentElement, TaskMapDocument } from "../../domain/document/documentTypes";
import type { CanvasId, ElementId } from "../../domain/ids/entityIds";
import { projectContainer } from "../../elements/container/containerViewProjection";
import { projectTextCard } from "../../elements/text-card/textCardViewProjection";
import { projectTextBlock } from "../../elements/text-block/textBlockViewProjection";
import { projectMindMapNode } from "../../elements/mind-map/mindMapNodeViewProjection";
import type { ContainerElement, TextBlockElement, TextCardElement } from "../../types";
import { createMindMapConnectionsProjection } from "./createMindMapConnectionsProjection";
import { createImageMediaProjection } from "./createImageMediaProjection";
import { createRetainedExtensionsProjection } from "./createRetainedExtensionsProjection";
import type { RetainedExtensionView } from "../../extensions/retainedExtensionDefinition";
import {
  projectImage,
  MissingImageMediaError,
  type RetainedImageView,
} from "../../elements/image/imageViewProjection";
import type { ImageMediaMetadata } from "../../elements/image/imageModel";
import type {
  RetainedCanvasView,
  RetainedCanvasProjectionIssue,
  RetainedCanvasProjectionResult,
} from "./retainedCanvasProjectionTypes";

type ProjectedElement =
  | { readonly kind: "image"; readonly value: RetainedImageView }
  | { readonly kind: "container"; readonly value: Readonly<ContainerElement> }
  | { readonly kind: "text-block"; readonly value: Readonly<TextBlockElement> }
  | { readonly kind: "mind-map-node"; readonly value: Readonly<TextCardElement> }
  | { readonly kind: "text-card"; readonly value: Readonly<TextCardElement> };

// Transitional, unmounted read-only adapter, not a renderer/element registry. Only call with the
// workspace's structurally and semantically validated immutable current-version document.
// Product data acceptance reuses these checks; action-specific command/callback guards still
// precede editable activation.
export function createRetainedCanvasProjection() {
  const connections = createMindMapConnectionsProjection();
  const imageMedia = createImageMediaProjection();
  const extensions = createRetainedExtensionsProjection();
  let previousDocument: TaskMapDocument | undefined;
  let previousResult: RetainedCanvasProjectionResult | undefined;
  let elements = new WeakMap<
    DocumentElement,
    {
      layer: number;
      view: ProjectedElement;
      media?: ImageMediaMetadata;
      extensions?: RetainedExtensionView;
    }
  >();

  function clear() {
    previousDocument = undefined;
    previousResult = undefined;
    elements = new WeakMap();
    connections.clear();
    imageMedia.clear();
    extensions.clear();
  }

  function project(document: TaskMapDocument): RetainedCanvasProjectionResult {
    if (document === previousDocument && previousResult) return previousResult;
    const issues: RetainedCanvasProjectionIssue[] = [];
    const projectedExtensions = extensions.project(document);
    issues.push(...projectedExtensions.issues);
    const projectedMedia = imageMedia.project(document.mediaReferences);
    issues.push(...projectedMedia.issues);

    const canvases: Omit<RetainedCanvasView, "mindmapConnections">[] = [];
    const endpointCanvases = new Map<ElementId, CanvasId>();
    for (const canvasId of document.canvasOrder) {
      const canvas = document.canvases[canvasId];
      const containers: Readonly<ContainerElement>[] = [];
      const textCards: Readonly<TextCardElement>[] = [];
      const textBlocks: Readonly<TextBlockElement>[] = [];
      const images: RetainedImageView[] = [];
      const parentIds = new Set<string>();
      for (const [layer, elementId] of canvas.elementOrder.entries()) {
        const element = document.elements[elementId];
        const cached = elements.get(element);
        const extensionView = projectedExtensions.byElement.get(elementId);
        const media =
          element.type === "image" && typeof element.data.mediaId === "string"
            ? projectedMedia.byId.get(element.data.mediaId)
            : undefined;
        let view =
          cached?.layer === layer && cached.media === media && cached.extensions === extensionView
            ? cached.view
            : undefined;
        if (!view) {
          try {
            // The supported cases stay local to this temporary adapter. No placeholder Renderer
            // definitions or registration of incomplete feature modules in the production registry.
            switch (element.type) {
              case "image":
                view = { kind: "image", value: projectImage(element, layer, media) };
                break;
              case "container":
                view = { kind: "container", value: projectContainer(element, layer) };
                break;
              case "text-card":
                view = { kind: "text-card", value: projectTextCard(element, layer) };
                break;
              case "text-block":
                view = { kind: "text-block", value: projectTextBlock(element, layer) };
                break;
              case "mind-map-node":
                view = { kind: "mind-map-node", value: projectMindMapNode(element, layer) };
                break;
              default:
                issues.push({ code: "unsupported-element", elementId });
                continue;
            }
          } catch (error) {
            // Do not expose Zod messages/paths or arbitrary document content to UI/logging.
            issues.push({
              code:
                error instanceof MissingImageMediaError
                  ? "missing-image-media"
                  : "invalid-element-data",
              elementId,
            });
            continue;
          }
          if (extensionView) {
            // Every retained shape accepts these validated optional props; preserve its kind/value
            // correlation while attaching them once, independently of the element codec.
            view = {
              ...view,
              value: Object.freeze({ ...view.value, extensions: extensionView }),
            } as ProjectedElement;
          }
          elements.set(element, { layer, view, media, extensions: extensionView });
        }
        if (view.kind === "container") {
          containers.push(view.value);
          parentIds.add(elementId);
        } else if (view.kind === "image") images.push(view.value);
        else if (view.kind === "text-block") textBlocks.push(view.value);
        else textCards.push(view.value);
        if (
          view.kind === "container" ||
          view.kind === "text-block" ||
          view.kind === "mind-map-node" ||
          view.kind === "image"
        ) {
          endpointCanvases.set(elementId, canvasId);
        }
      }

      const childOrders = new Map<string, Set<number>>();
      for (const card of [...textCards, ...images]) {
        if (card.containerId === undefined) continue;
        const elementId = card.id as ElementId;
        if (!parentIds.has(card.containerId)) {
          issues.push({ code: "invalid-container-parent", elementId });
          continue;
        }
        const orders = childOrders.get(card.containerId) ?? new Set<number>();
        // A validated placement always supplies both fields.
        const order = card.order!;
        if (orders.has(order)) issues.push({ code: "duplicate-child-order", elementId });
        orders.add(order);
        childOrders.set(card.containerId, orders);
      }
      canvases.push(
        Object.freeze({
          id: canvasId,
          name: canvas.name,
          width: canvas.settings.width,
          height: canvas.settings.height,
          containers: Object.freeze(containers),
          textCards: Object.freeze(textCards),
          textBlocks: Object.freeze(textBlocks),
          images: Object.freeze(images),
        }),
      );
    }

    const projectedConnections = connections.project(document, endpointCanvases);
    issues.push(...projectedConnections.issues);
    previousDocument = document;
    previousResult = issues.length
      ? Object.freeze({
          ok: false,
          issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
        })
      : Object.freeze({
          ok: true,
          mediaReferences: projectedMedia.metadata,
          extensionInstallations: projectedExtensions.installations,
          canvases: Object.freeze(
            canvases.map((canvas) =>
              Object.freeze({
                ...canvas,
                mindmapConnections: Object.freeze(
                  projectedConnections.byCanvas.get(canvas.id) ?? [],
                ),
              }),
            ),
          ),
        });
    return previousResult;
  }

  // Every consumer must clear on session revocation; createRetainedCanvasBinding owns the view lifetime.
  return Object.freeze({ project, clear });
}
