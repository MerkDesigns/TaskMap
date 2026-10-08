import { PointerEvent, useMemo, useRef, useState } from "react";
import { useRetainedImageImport } from "./legacy/useRetainedImageImport";
import type { RetainedImageView } from "./elements/image/imageViewProjection";
import { canvasMindMapConnections } from "./elements/mind-map/mindMapConnectionViewProjection";
import { ToastStack } from "./components/ToastStack";
import type { TextCardElement } from "./types";
import { commandErrorMessage } from "./app/commandError";
import { useImageCache } from "./hooks/useImageCache";
import { useAppUpdates } from "./hooks/useAppUpdates";
import { useCanvasDocument } from "./hooks/useCanvasDocument";
import {
  useRetainedDocumentConnections,
  type RetainedCanvasContextValue,
} from "./legacy/RetainedCanvasContext";
import { useLegacyCanvasSettings } from "./legacy/useLegacyCanvasSettings";
import type { ConnectionId } from "./domain/ids/entityIds";
import { useRetainedInlineEdits } from "./legacy/useRetainedInlineEdit";
import { useElementPresenceMarks } from "./legacy/useElementPresenceMarks";
import { useCanvasMenus } from "./legacy/useCanvasMenus";
import { useConnectionDrawing } from "./legacy/useConnectionDrawing";
import { useCanvasGestures } from "./legacy/useCanvasGestures";
import { useToastQueue } from "./components/useToastQueue";
import { useMeasuredTextCardSizes } from "./legacy/canvasElementBounds";
import { RetainedSettingsDialog } from "./legacy/RetainedSettingsDialog";
import { RetainedWorkspaceChrome } from "./legacy/RetainedWorkspaceChrome";
import { useMinimapPresence } from "./legacy/useMinimapPresence";
import { useCanvasElementCreation } from "./legacy/useCanvasElementCreation";
import { useCanvasManagement } from "./legacy/useCanvasManagement";
import { useLeftPanel } from "./legacy/useLeftPanel";
import { RetainedCanvasMenus } from "./legacy/RetainedCanvasMenus";
import { useCanvasShortcuts } from "./legacy/useCanvasShortcuts";
import { useRetainedClipboard } from "./legacy/useRetainedClipboard";
import { useRetainedElementActions } from "./legacy/useRetainedElementActions";
import { useExtensionDrop } from "./legacy/useExtensionDrop";
import { useRetainedExtensionFlows } from "./legacy/useRetainedExtensionFlows";
import { useCanvasDeletion } from "./legacy/useCanvasDeletion";
import { useCanvasInteraction } from "./legacy/useCanvasInteraction";
import { useCanvasScene } from "./legacy/useCanvasScene";
import { createCanvasGeometry } from "./legacy/canvasGeometry";
import { useCanvasPresentation } from "./legacy/useCanvasPresentation";
import { createContextTargets } from "./legacy/contextTargets";
import { useWorkspacePointerPolicy } from "./legacy/useWorkspacePointerPolicy";
import { useContainerCardScroll } from "./legacy/useContainerCardScroll";
import { useLayeredCanvasElements } from "./legacy/useLayeredCanvasElements";
import { RetainedCanvasStage } from "./legacy/RetainedCanvasStage";
import { useContainerLayerLayout } from "./legacy/RetainedContainerLayer";
import { elementShadows } from "./legacy/RetainedElementLayers";
import { viewportWorldRectangle } from "./canvas/geometry/viewportMath";
import { getLegacyInteractionElements } from "./legacy/interactions/legacyCanvasGeometry";
import { applyLegacyTextCardShiftTransition } from "./legacy/interactions/legacyTextCardModifierTransition";
import { WorkspaceRoot, WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS } from "./ui/patterns/workspace";
import { isModalPresenceBlocking } from "./ui/patterns/overlays";
import { deletionProtectedIds, isLocked } from "./extensions/lock/lockRule";

// Retained images resolve media through session leases; the legacy hash cache holds nothing.
const NO_CACHED_IMAGES: { hash: string; format?: string }[] = [];

const CANVAS_MANAGER_ANIMATION_MS = WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS;

interface AppProps {
  readonly useSettings: typeof useLegacyCanvasSettings;
  readonly useDocument: typeof useCanvasDocument;
  /** The open database's canvas: the document, its commands and its view projection. */
  readonly retained: RetainedCanvasContextValue;
}

function App({ useDocument, useSettings, retained }: AppProps) {
  const worldRef = useRef<HTMLDivElement>(null);
  const {
    activeCanvas,
    canvases,
    elements,
    images,
    mindmapConnections,
    textBlocks,
    textCards,
    zoom: legacyZoom,
  } = useDocument();
  const {
    stageRef,
    selectionRef,
    stageSize,
    lastPointer: lastPointerPositionRef,
    controller: interactionController,
    snapshot: interactionSnapshot,
    selectedIds,
    setSelection: setSelectedIds,
    cardDrags: textCardInteraction,
    cardDragSnapshot: textCardInteractionSnapshot,
  } = useCanvasInteraction(retained);
  const menus = useCanvasMenus({
    selection: () => interactionController.getSnapshot().selectedIds,
    select: (ids) => setSelectedIds(ids),
    endRename: () => rename.end(),
    endTextCardEdit: () => textCardEdit.end(),
    connectionMode: () => connectionDrawing.mode,
  });
  const edits = useRetainedInlineEdits(retained.runtime.callbacks);
  const { rename, card: textCardEdit, block: textBlockEdit } = edits;
  const { editingId: renamingId, end: endRename } = rename;
  const { editingId: editingTextCardId } = textCardEdit;
  const { editingId: editingTextBlockId } = textBlockEdit;
  const measuredCards = useMeasuredTextCardSizes(activeCanvas.id);
  const measuredInteractionCardSizes = measuredCards.sizes;
  const settings = useSettings();
  const {
    canvasGridStyle,
    canvasGridOpacity,
    defaultElementColors,
    recentColors,
    setRecentColors,
    shadowsUnderElements,
    allowLockedElementDeletion,
    minimapEnabled,
    dismissedUpdateVersion,
    setDismissedUpdateVersion,
  } = settings;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fpsCounterVisible, setFpsCounterVisible] = useState(false);
  const { toasts, showToast, dismissToast } = useToastQueue();
  const leftPanel = useLeftPanel(CANVAS_MANAGER_ANIMATION_MS);
  const [quickExtensionsMenu, setQuickExtensionsMenu] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const presenceMarks = useElementPresenceMarks();
  const {
    containers: deletingIds,
    textCards: deletingTextCardIds,
    textBlocks: deletingTextBlockIds,
    images: deletingImageIds,
  } = presenceMarks.deleting;
  const snapGuides = interactionSnapshot.snapGuides;

  const scene = useCanvasScene({
    containers: elements,
    textBlocks,
    textCards,
    images,
    connections: mindmapConnections,
  });
  const { containersById, textCardsById } = scene;
  const { looseCards: looseTextCards, looseImages } = scene;
  const cardScroll = useContainerCardScroll(textCards, (id) => containersById.get(id));
  const cardLayout = cardScroll.layout;
  const interactionElements = useMemo(
    () => getLegacyInteractionElements(activeCanvas, measuredInteractionCardSizes),
    [activeCanvas, measuredInteractionCardSizes],
  );
  const isElementLocked = (id: string) => isLocked(scene.element(id));
  const geometry = createCanvasGeometry({
    worldRef,
    controller: interactionController,
    canvas: activeCanvas,
    scene,
    cardLayout,
    restingPosition: cardScroll.restingPosition,
    measuredCardSizes: measuredInteractionCardSizes,
    interactionElements,
    previews: interactionSnapshot.geometryPreviews,
    isLocked: isElementLocked,
  });
  const deletionProtected = useMemo(
    () =>
      deletionProtectedIds(
        [...elements, ...textBlocks, ...textCards, ...images],
        allowLockedElementDeletion,
      ),
    [elements, textBlocks, textCards, images, allowLockedElementDeletion],
  );
  const isElementDeletionLocked = (id: string) => deletionProtected.has(id);
  const connectionDrawing = useConnectionDrawing({
    callbacks: retained.runtime.callbacks,
    boundsOf: (id) => geometry.connectableBoundsOf(id),
    connected: (first, second) =>
      mindmapConnections.some(
        (connection) =>
          (connection.sourceId === first && connection.targetId === second) ||
          (connection.sourceId === second && connection.targetId === first),
      ),
    isMindmapNode: (id) => textCardsById.get(id)?.kind === "mindmap",
    canvasPoint: (clientX, clientY) => geometry.canvasPoint({ clientX, clientY }),
    canvasSize: () => ({ width: canvasWidth, height: canvasHeight }),
    mindmapAccent: () => defaultElementColors.mindmap,
    onNodeCreated: (id) => presenceMarks.animateIn("textCards", id),
    closeContextMenus: () => closeContextMenus(),
  });

  const { imageUrlVersion } = useImageCache({
    activeImages: NO_CACHED_IMAGES,
    onStoreError: (error) => {
      showToast({
        tone: "error",
        title: "Could not add image",
        message: commandErrorMessage(error),
      });
    },
  });

  const updates = useAppUpdates({
    // App mounts once the database is open; the storage-free preview never checks.
    checkOnStartup: import.meta.env.MODE !== "storage-preview",
    dismissedUpdateVersion,
    onDismissUpdateVersion: setDismissedUpdateVersion,
    saveCurrentData: async () => {
      const result = await retained.runtime.controller.prepareWindowClose();
      if (!result.ok) throw new Error("The database could not be saved before updating.");
    },
    showToast,
  });

  const closeContextMenus = menus.closeAll;

  const minimap = useMinimapPresence(
    minimapEnabled,
    interactionSnapshot.activeInteraction?.kind === "pan",
  );
  const showMinimap = minimap.show;

  const layers = useLayeredCanvasElements({
    containers: elements,
    textBlocks,
    textCards,
    images,
    looseCards: looseTextCards,
    looseImages,
    previews: interactionSnapshot.geometryPreviews,
  });

  const removeMindmapConnection = (id: string) => {
    retained.runtime.callbacks.captureConnectionDelete(id as ConnectionId)?.complete();
    menus.closeConnection();
  };

  const deletion = useCanvasDeletion({
    callbacks: retained.runtime.callbacks,
    activeCanvas: () => activeCanvas,
    isDeletionLocked: isElementDeletionLocked,
    markDeleting: presenceMarks.markDeleting,
    clearDeleting: presenceMarks.clearDeleting,
    clearSelection: () => setSelectedIds([]),
    closeContextMenus,
    endEditing: edits.endAll,
  });

  const createElement = useCanvasElementCreation({
    callbacks: retained.runtime.callbacks,
    activeCanvasId: () => activeCanvas.id,
    canvasPoint: (clientX, clientY) => geometry.canvasPoint({ clientX, clientY }),
    canvasSize: () => ({ width: canvasWidth, height: canvasHeight }),
    colors: () => defaultElementColors,
    containers: () => elements,
    textBlocks: () => textBlocks,
    textCards: () => textCards,
    cardLayout: () => cardLayout,
    scrollContainer: cardScroll.scrollTo,
    select: setSelectedIds,
    animateIn: presenceMarks.animateIn,
    closeContextMenus,
    rename,
    cardEdit: textCardEdit,
    blockEdit: textBlockEdit,
  });

  const imageImport = useRetainedImageImport({
    runtime: retained.runtime,
    canvasPoint: (clientX, clientY) => geometry.canvasPoint({ clientX, clientY }),
    images: () => looseImages,
    accent: () => defaultElementColors.image,
    showToast,
  });
  const pickImageForElement = imageImport.pick;
  const loadingImageIds = imageImport.importingIds;
  const canvasPresentation = useCanvasPresentation({
    interaction: interactionSnapshot,
    cardDrags: textCardInteractionSnapshot,
    isCard: (id) => textCardsById.has(id),
    rename,
    cardEdit: textCardEdit,
    blockEdit: textBlockEdit,
    marks: presenceMarks,
    shadowsUnderElements,
    recentColors,
    importingImageIds: loadingImageIds,
  });
  const { outlinedIds } = canvasPresentation.presentation;
  const draggedTextCardIds = canvasPresentation.draggedCardIds;

  const startMindmapConnection = connectionDrawing.start;

  const openMindmapConnectionMenu = (event: PointerEvent<SVGPathElement>, connectionId: string) =>
    menus.openConnection(event, connectionId);

  const getTextCardCopyPosition = (card: TextCardElement) => {
    const position = geometry.renderPosition(card) ?? cardScroll.restingPosition(card);
    return { x: position.x, y: position.y };
  };

  const clipboard = useRetainedClipboard({
    callbacks: retained.runtime.callbacks,
    document: () => retained.runtime.controller.store.getState().documentWorkspace.document,
    selection: () => interactionController.getSnapshot().selectedIds,
    isDeletionLocked: isElementDeletionLocked,
    cardPosition: (id) => {
      const card = textCardsById.get(id);
      return card ? getTextCardCopyPosition(card) : undefined;
    },
    canvasPoint: (clientX, clientY) => geometry.canvasPoint({ clientX, clientY }),
    containerCardIndex: (containerId, point) => {
      const container = containersById.get(containerId);
      return container ? cardLayout.dropIndex(container, point, textCards, "") : undefined;
    },
    deleteElements: (ids) => contextTargets.remove(ids[0], [...ids]),
    closeContextMenus,
    onPasted: (inserted) => {
      setSelectedIds(inserted.filter((entry) => entry.root).map((entry) => entry.id));
      inserted.forEach((entry) =>
        presenceMarks.animateIn(
          entry.type === "container"
            ? "containers"
            : entry.type === "image"
              ? "images"
              : entry.type === "text-block"
                ? "textBlocks"
                : "textCards",
          entry.id,
        ),
      );
      closeContextMenus();
      rename.end();
    },
    onPasteFailed: () =>
      showToast({
        tone: "error",
        title: "Could not paste",
        message: "The copied selection is no longer available. Copy it again and retry.",
      }),
  });

  const contextTargets = createContextTargets({
    selection: selectedIds,
    element: scene.element,
    isTopLevel: layers.isTopLevel,
    reorder: (ids, direction) => interactionController.reorder([...ids], direction),
    updateAccent: (id, accent) => extensionCommands.updateSelectionAccent(id, accent),
    remove: deletion.remove,
    closeContextMenus,
    endRename: () => rename.end(),
  });
  const pointerPolicy = useWorkspacePointerPolicy({
    worldRef,
    renamingId: () => renamingId,
    saveRename: () => elementActions.saveRename(),
    closeContextMenus,
    openCanvasMenu: menus.openCanvas,
  });

  const extensionFlows = useRetainedExtensionFlows({
    retained,
    container: scene.find.container,
    card: scene.find.card,
    selection: () => interactionController.getSnapshot().selectedIds,
    select: setSelectedIds,
    resetContainerScroll: cardScroll.reset,
    endEditing: () => {
      textCardEdit.end();
      rename.end();
    },
    rememberRecentColor: (color) => rememberRecentColor(color),
    closeContextMenus,
    showToast,
  });
  const extensionCommands = extensionFlows.commands;

  const extensionDrop = useExtensionDrop({
    callbacks: retained.runtime.callbacks,
    document: () => retained.runtime.controller.store.getState().documentWorkspace.document,
    canvasPoint: (clientX, clientY) => geometry.canvasPoint({ clientX, clientY }),
    scene: () => ({
      containers: elements,
      textBlocks,
      looseCards: looseTextCards,
      images: looseImages,
    }),
    find: scene.find,
    cardLayout: () => cardLayout,
    cardBounds: geometry.cardRippleBounds,
    looseCardEstimate: geometry.looseCard,
    selection: () => selectedIds,
    select: setSelectedIds,
    closeContextMenus,
  });

  const resetZoom = () => {
    interactionController.resetZoom();
    showMinimap();
  };

  const undo = () => {
    retained.runtime.callbacks.undo();
    edits.endAll();
    closeContextMenus();
  };

  const redo = () => {
    retained.runtime.callbacks.redo();
    edits.endAll();
    closeContextMenus();
  };

  const resetCanvasPresentation = () => {
    deletion.cancelPending(activeCanvas.id);
    textCardInteraction.reset();
    setSelectedIds([]);
    presenceMarks.clearDeleting();
    edits.endAll();
    connectionDrawing.cancel();
    closeContextMenus();
  };

  const canvasManagement = useCanvasManagement({
    callbacks: retained.runtime.callbacks,
    activeCanvasId: () => activeCanvas.id,
    canvasIds: () => canvases.map((canvas) => canvas.id),
    resetPresentation: resetCanvasPresentation,
    leftPanel,
    closeQuickExtensions: () => setQuickExtensionsMenu(null),
  });

  useCanvasShortcuts({
    modalOpen: () =>
      settingsOpen ||
      deletion.clearDialogOpen ||
      updates.updateModalOpen ||
      isModalPresenceBlocking(),
    setConnectionMode: connectionDrawing.setConnectionMode,
    setShiftHeld: (held) =>
      applyLegacyTextCardShiftTransition(interactionController, textCardInteraction, held),
    openQuickExtensionsAtPointer: () =>
      setQuickExtensionsMenu({
        left: lastPointerPositionRef.current.x,
        top: lastPointerPositionRef.current.y,
      }),
    closeQuickExtensions: () => setQuickExtensionsMenu(null),
    leftPanel,
    closeContextMenus,
    endRename,
    deleteSelection: () => deletion.remove(selectedIds),
    copySelection: clipboard.copySelection,
    canPaste: () => clipboard.hasCopy,
    pasteAtPointer: () => {
      const { x, y } = lastPointerPositionRef.current;
      clipboard.paste(x, y);
    },
    undo,
    redo,
    cycleCanvases: canvasManagement.cycle,
    cyclingCanvases: canvasManagement.cycling,
    finishCanvasCycle: canvasManagement.finishCycle,
  });

  const rememberRecentColor = (color?: string) => {
    if (!color) {
      return;
    }

    const normalized = color.toUpperCase();
    setRecentColors((current) =>
      [
        normalized,
        ...current.filter((recentColor) => recentColor.toUpperCase() !== normalized),
      ].slice(0, 8),
    );
  };

  const gestures = useCanvasGestures({
    retained,
    controller: interactionController,
    cardDrags: textCardInteraction,
    connections: connectionDrawing,
    world: () => worldRef.current,
    selection: () => interactionController.getSnapshot().selectedIds,
    interactionElements: () => interactionElements,
    gestureElement: geometry.gestureElement,
    scene: () => ({ containers: elements, textBlocks, textCards }),
    isLocked: isElementLocked,
    isFrameVisible: geometry.isFrameVisible,
    canvasPoint: geometry.canvasPoint,
    canvasSize: () => ({ width: canvasWidth, height: canvasHeight }),
    cardPosition: (card) => cardScroll.restingPosition(card),
    containerCardCandidates: (container) =>
      cardLayout.visible(container).flatMap((card) => {
        const bounds = geometry.cardRippleBounds(card);
        return bounds
          ? [
              {
                id: card.id,
                geometry: {
                  x: bounds.left,
                  y: bounds.top,
                  width: bounds.width,
                  height: bounds.height,
                },
                locked: isElementLocked(card.id),
                movable: true,
                resizable: false,
              },
            ]
          : [];
      }),
    containerScrollOffsets: cardScroll.currentOffsets,
    camera: () => ({ pan: activeCanvas.pan, zoom: activeCanvas.zoom }),
    editingCardId: () => editingTextCardId,
    saveOpenEdits: () => {
      if (editingTextCardId) elementActions.saveCardEdit(editingTextCardId);
      if (editingTextBlockId) elementActions.saveBlockEdit(editingTextBlockId);
    },
    saveTextBlockEdit: () => {
      if (editingTextBlockId) elementActions.saveBlockEdit(editingTextBlockId);
    },
    endEditing: edits.endAll,
    endRename: () => rename.end(),
    closeContextMenus,
    showMinimap: () => showMinimap(),
  });
  const elementActions = useRetainedElementActions({
    callbacks: retained.runtime.callbacks,
    find: scene.find,
    menus,
    gestures,
    rename,
    cardEdit: textCardEdit,
    blockEdit: textBlockEdit,
    select: (ids, additive) =>
      setSelectedIds((current) => (additive ? Array.from(new Set([...current, ...ids])) : ids)),
    pulse: presenceMarks.pulse,
    context: {
      updateAccent: contextTargets.updateAccent,
      cut: clipboard.cut,
      copy: clipboard.copy,
      moveLayer: contextTargets.moveLayer,
      remove: contextTargets.remove,
    },
    pickImage: pickImageForElement,
    wheelContainer: cardScroll.wheel,
    rememberCardSize: measuredCards.remember,
  });
  const documentConnections = useRetainedDocumentConnections();
  const activeMindMapConnections = useMemo(
    () => canvasMindMapConnections(documentConnections, activeCanvas.id),
    [documentConnections, activeCanvas.id],
  );
  const canvasWidth = activeCanvas.width;
  const canvasHeight = activeCanvas.height;
  const minimapViewportWorld = viewportWorldRectangle(interactionSnapshot.viewport);
  const connectableBoundsById = geometry.connectableBounds();
  const canvasElementShadows = elementShadows(layers, {
    deleting: presenceMarks.deleting,
    overlaidCardIds: canvasPresentation.overlaidCardIds,
    draggedCardIds: draggedTextCardIds,
    cardSize: geometry.looseCard,
    preview: (id) => geometry.preview(id),
    chromeless: (image) =>
      Boolean((image as unknown as RetainedImageView).media) &&
      !loadingImageIds.includes(image.id) &&
      image.background === false,
  });
  const canvasManagerCanvases = useMemo(
    () =>
      canvases.map((canvas) =>
        canvas.id === activeCanvas.id ? { ...activeCanvas, previewViewport: stageSize } : canvas,
      ),
    // Deletions refresh the previews; camera frames do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeCanvas,
      canvases,
      stageSize,
      deletingIds,
      deletingTextCardIds,
      deletingTextBlockIds,
      deletingImageIds,
    ],
  );
  const containerCardLayout = useContainerLayerLayout({
    cardScroll,
    textCards,
    presentation: canvasPresentation.presentation,
    interactionKind: interactionSnapshot.activeInteraction?.kind,
    draggedCardIds: draggedTextCardIds,
    heldCards: canvasPresentation.heldCards,
    cardRelease: textCardInteractionSnapshot.release,
    releasingCardIds: canvasPresentation.releasingCardIds,
    editingCardContainerId: editingTextCardId
      ? textCardsById.get(editingTextCardId)?.containerId
      : undefined,
  });

  return (
    <WorkspaceRoot
      className="taskmap-workspace-root--canvas"
      spellCheck={false}
      onContextMenu={pointerPolicy.suppressContextMenu}
      onPointerDownCapture={pointerPolicy.onPointerDownCapture}
    >
      <div className="h-full">
        <section className="relative h-full overflow-hidden">
          <RetainedWorkspaceChrome
            controller={interactionController}
            settings={settings}
            leftPanel={leftPanel}
            canvases={canvasManagerCanvases}
            activeCanvasId={activeCanvas.id}
            canvasManagement={canvasManagement}
            viewportSize={stageSize}
            onDropExtension={extensionDrop.drop}
            minimap={{
              presence: minimap,
              elements,
              textBlocks,
              textCards: looseTextCards,
              images: looseImages,
              mindmapConnections,
              canvasWidth,
              canvasHeight,
              zoom: legacyZoom,
              viewportWorld: minimapViewportWorld,
              onResetZoom: resetZoom,
            }}
            historyStore={retained.runtime.controller.store}
            onUndo={undo}
            onRedo={redo}
            onOpenSettings={() => setSettingsOpen(true)}
            quickExtensions={quickExtensionsMenu}
            onCloseQuickExtensions={() => setQuickExtensionsMenu(null)}
            fpsCounterVisible={fpsCounterVisible}
          />
          <RetainedCanvasStage
            stageRef={stageRef}
            worldRef={worldRef}
            selectionRef={selectionRef}
            controller={interactionController}
            gestures={gestures}
            grabbing={
              interactionSnapshot.activeInteraction?.kind === "pan" ||
              interactionSnapshot.activeInteraction?.kind === "move"
            }
            canvas={{
              width: canvasWidth,
              height: canvasHeight,
              gridStyle: canvasGridStyle,
              gridOpacity: canvasGridOpacity[canvasGridStyle],
              imageUrlVersion,
            }}
            onCanvasContextMenu={pointerPolicy.onCanvasContextMenu}
            snapGuides={snapGuides}
            ripples={extensionDrop.ripples}
            connections={{
              connections: activeMindMapConnections,
              connectableBoundsById,
              connectionMode: connectionDrawing.mode,
              preview: connectionDrawing.draft,
              onConnectionClick: openMindmapConnectionMenu,
            }}
            layers={layers}
            pinnedIds={canvasPresentation.pinnedIds}
            shadows={{
              underElements: shadowsUnderElements,
              rectangles: canvasElementShadows,
              draggedIds: canvasPresentation.presentation.draggedIds,
            }}
            presentation={canvasPresentation.presentation}
            containerLayout={containerCardLayout}
            actions={elementActions}
            extensionCommands={extensionCommands}
            media={retained.runtime.media}
            overlaidCardIds={canvasPresentation.overlaidCardIds}
            cardPosition={geometry.renderPosition}
            overlays={{
              heldCards: canvasPresentation.heldCards,
              releasedCards: textCardInteractionSnapshot.release,
              cardById: (id) => textCardsById.get(id),
              outlinedIds,
              connectionPorts: connectionDrawing.mode
                ? {
                    bounds: connectableBoundsById,
                    accentOf: (ownerId) =>
                      scene.portAccent(ownerId) ?? defaultElementColors.mindmap,
                    drag: connectionDrawing.draft,
                    onStartConnection: startMindmapConnection,
                  }
                : null,
            }}
            selectionVisible={canvasPresentation.selectionVisible}
          />

          <RetainedCanvasMenus
            containerMenus={menus.pairs.container}
            textCardMenus={menus.pairs.textCard}
            textBlockMenus={menus.pairs.textBlock}
            imageMenus={menus.pairs.image}
            containerContentMenus={menus.pairs.containerContent}
            canvasMenus={menus.pairs.canvas}
            connectionMenu={
              menus.connection && scene.connectionsById.has(menus.connection.id)
                ? menus.connection
                : null
            }
            elementOf={scene.element}
            isMultiTarget={contextTargets.isMulti}
            installedOnTargets={contextTargets.installedExtensions}
            extensionCommands={extensionCommands}
            recentColors={recentColors}
            containerActions={elementActions.containerMenu}
            textCardActions={elementActions.textCardMenu}
            textBlockActions={elementActions.textBlockMenu}
            imageActions={elementActions.imageMenu}
            hasCopiedItem={clipboard.hasCopy}
            onPaste={clipboard.paste}
            onCreateTextCardInContainer={createElement.containerCard}
            canvasActions={{
              onCreateContainer: createElement.container,
              onCreateTextCard: createElement.textCard,
              onCreateTextBlock: createElement.textBlock,
              onCreateImage: createElement.imagePlaceholder,
              onCreateMindmap: createElement.mindmapNode,
              onClear: deletion.requestClear,
            }}
            onDeleteConnection={removeMindmapConnection}
          />

          {deletion.clearDialog}

          {extensionFlows.windows}

          <RetainedSettingsDialog
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            updates={updates}
            session={retained.runtime.controller}
            onRememberRecentColor={rememberRecentColor}
            fpsCounterVisible={fpsCounterVisible}
            onFpsCounterVisibleChange={setFpsCounterVisible}
          />

          <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </section>
      </div>
    </WorkspaceRoot>
  );
}

export default App;
