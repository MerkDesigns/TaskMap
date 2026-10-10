import type { CSSProperties, MouseEvent, RefObject } from "react";
import type { CanvasInteractionController } from "../app/interactions/canvasInteractionTypes";
import type { SnapGuide } from "../app/interactions/canvasInteractionTypes";
import { ExtensionDropRipples } from "../components/ExtensionDropRipples";
import type { ImageMediaLeases } from "../elements/image/ImageRenderer";
import { MindMapConnections } from "../elements/mind-map/MindMapConnections";
import type { ExtensionCommands } from "../extensions/extensionCommands";
import type { CanvasGridStyle, TextCardElement } from "../types";
import { CanvasFrame, WorkspaceBackdropLayer } from "../ui/patterns/workspace";
import { CanvasSnapGuides } from "./CanvasSnapGuides";
import { LegacyCanvasVisibility } from "./interactions/LegacyCanvasVisibility";
import { RetainedCanvasOverlays, type RetainedCanvasOverlaysProps } from "./RetainedCanvasOverlays";
import { ContainerLayer, type ContainerCardLayout } from "./RetainedContainerLayer";
import {
  ElementShadowLayer,
  ImageLayer,
  LooseTextCardLayer,
  TextBlockLayer,
  type ElementShadowRectangle,
} from "./RetainedElementLayers";
import type { RetainedElementPresentation } from "./retainedElementPresentation";
import type { useCanvasGestures } from "./useCanvasGestures";
import type { useExtensionDrop } from "./useExtensionDrop";
import type { useLayeredCanvasElements } from "./useLayeredCanvasElements";
import type { useRetainedElementActions } from "./useRetainedElementActions";

const CANVAS_CONTENT_INSET = 1;

type ConnectionsProps = Parameters<typeof MindMapConnections>[0];

export interface RetainedCanvasStageProps {
  readonly stageRef: RefObject<HTMLDivElement | null>;
  readonly worldRef: RefObject<HTMLDivElement | null>;
  readonly selectionRef: RefObject<HTMLDivElement | null>;
  readonly controller: CanvasInteractionController;
  readonly gestures: ReturnType<typeof useCanvasGestures>;
  /** A pan or move is running, so the stage shows the grabbing cursor. */
  readonly grabbing: boolean;
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly gridStyle: CanvasGridStyle;
    /** Grid opacity in percent. */
    readonly gridOpacity: number;
    readonly imageUrlVersion: number;
  };
  readonly onCanvasContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  readonly snapGuides: readonly SnapGuide[];
  readonly ripples: ReturnType<typeof useExtensionDrop>["ripples"];
  readonly connections: Omit<ConnectionsProps, "canvasWidth" | "canvasHeight">;
  readonly layers: ReturnType<typeof useLayeredCanvasElements>;
  /** Elements rendered even when culled: selected, edited or being dragged. */
  readonly pinnedIds: ReadonlySet<string>;
  readonly shadows: {
    /** Shadows sit in a shared layer under the elements instead of on each element. */
    readonly underElements: boolean;
    readonly rectangles: readonly ElementShadowRectangle[];
    readonly draggedIds: readonly string[];
  };
  readonly presentation: RetainedElementPresentation;
  readonly containerLayout: ContainerCardLayout;
  readonly actions: ReturnType<typeof useRetainedElementActions>;
  readonly extensionCommands: ExtensionCommands;
  readonly media: ImageMediaLeases;
  /** Loose cards an overlay draws instead (held or settling after a drag). */
  readonly overlaidCardIds: readonly string[];
  readonly cardPosition: (card: TextCardElement) => { x: number; y: number } | undefined;
  readonly overlays: Pick<
    RetainedCanvasOverlaysProps,
    "heldCards" | "releasedCards" | "cardById" | "outlinedIds" | "connectionPorts"
  >;
  readonly selectionVisible: boolean;
}

/**
 * The canvas under the chrome: the stage that takes pointer gestures, the camera-transformed
 * canvas frame with its grid, guides, ripples, connections and culled element layers, the
 * overlays drawn above it and the box selection rectangle.
 */
export function RetainedCanvasStage({
  stageRef,
  worldRef,
  selectionRef,
  controller,
  gestures,
  grabbing,
  canvas,
  onCanvasContextMenu,
  snapGuides,
  ripples,
  connections,
  layers,
  pinnedIds,
  shadows,
  presentation,
  containerLayout,
  actions,
  extensionCommands,
  media,
  overlaidCardIds,
  cardPosition,
  overlays,
  selectionVisible,
}: RetainedCanvasStageProps) {
  return (
    <WorkspaceBackdropLayer
      ref={stageRef}
      data-stage
      className={grabbing ? "cursor-grabbing" : "cursor-default"}
      onPointerDownCapture={gestures.stagePointerDownCapture}
      onPointerDown={gestures.stagePointerDown}
      onPointerMove={gestures.pointerMove}
      onPointerUp={gestures.pointerUp}
      onPointerCancel={gestures.pointerCancel}
      onLostPointerCapture={gestures.pointerCancel}
      onWheel={gestures.wheel}
      onAuxClick={(event) => event.preventDefault()}
    >
      <CanvasFrame
        ref={worldRef}
        className="absolute"
        data-camera-layer
        data-grid-style={canvas.gridStyle}
        data-image-url-version={canvas.imageUrlVersion}
        style={
          {
            "--taskmap-canvas-grid-opacity": canvas.gridOpacity / 100,
            "--taskmap-canvas-dot-size": "calc(1.25px * var(--taskmap-camera-inverse-zoom, 1))",
            width: canvas.width,
            height: canvas.height,
            transform: "var(--taskmap-camera-transform)",
            transformOrigin: "0 0",
          } as CSSProperties
        }
        onContextMenu={onCanvasContextMenu}
        onPointerDown={gestures.worldPointerDown}
      >
        <CanvasSnapGuides
          guides={snapGuides}
          canvasWidth={canvas.width}
          canvasHeight={canvas.height}
        />
        <ExtensionDropRipples ripples={ripples} />
        <MindMapConnections
          {...connections}
          canvasWidth={canvas.width}
          canvasHeight={canvas.height}
        />
        <LegacyCanvasVisibility
          controller={controller}
          elements={layers.cullable}
          pinnedIds={pinnedIds}
        >
          {(visibleIds) => (
            <>
              {shadows.underElements && (
                <ElementShadowLayer
                  shadows={shadows.rectangles}
                  draggedIds={shadows.draggedIds}
                  visibleIds={visibleIds}
                />
              )}
              <ContainerLayer
                elements={layers.containers}
                visibleIds={visibleIds}
                presentation={presentation}
                layout={containerLayout}
                actions={actions.container}
                cardActions={actions.textCard}
                extensionCommands={extensionCommands}
              />
              <TextBlockLayer
                elements={layers.textBlocks}
                visibleIds={visibleIds}
                presentation={presentation}
                actions={actions.textBlock}
                extensionCommands={extensionCommands}
              />
              <LooseTextCardLayer
                elements={layers.looseCards}
                visibleIds={visibleIds}
                presentation={presentation}
                hiddenIds={overlaidCardIds}
                positionOf={cardPosition}
                actions={actions.textCard}
                extensionCommands={extensionCommands}
              />
              <ImageLayer
                elements={layers.images}
                visibleIds={visibleIds}
                presentation={presentation}
                actions={actions.image}
                leases={media}
              />
            </>
          )}
        </LegacyCanvasVisibility>
      </CanvasFrame>
      <RetainedCanvasOverlays
        {...overlays}
        canvasSize={{ width: canvas.width, height: canvas.height }}
        contentInset={CANVAS_CONTENT_INSET}
        shadowsUnderElements={shadows.underElements}
        cardActions={actions.textCard}
        extensionCommands={extensionCommands}
      />
      {selectionVisible && (
        <div
          ref={selectionRef}
          className="pointer-events-none absolute z-30 rounded-md border border-dashed border-[#2dd8c8]/80 bg-[#2dd8c8]/[0.10] shadow-[0_0_0_1px_rgba(0,0,0,0.22)]"
        />
      )}
    </WorkspaceBackdropLayer>
  );
}
