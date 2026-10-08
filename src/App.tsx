import { PointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RetainedExtensionKey } from "./extensions/retainedExtensionDefinition";
import { captureRetainedViewJsonEdit } from "./legacy/retainedViewJsonEdit";
import { useRetainedImageImport } from "./legacy/useRetainedImageImport";
import type { RetainedImageView } from "./elements/image/imageViewProjection";
import { canvasMindMapConnections } from "./elements/mind-map/mindMapConnectionViewProjection";
import { ToastStack } from "./components/ToastStack";
import { getTextCardAccent } from "./constants";
import { clamp } from "./canvasMath";
import { ContainerElement, TextBlockElement, TextCardElement } from "./types";
import { commandErrorMessage } from "./app/commandError";
import { useImageCache } from "./hooks/useImageCache";
import { useAppUpdates } from "./hooks/useAppUpdates";
import { useCanvasDocument } from "./hooks/useCanvasDocument";
import {
  useRetainedDocumentConnections,
  type RetainedCanvasContextValue,
} from "./legacy/RetainedCanvasContext";
import { useLegacyCanvasSettings } from "./legacy/useLegacyCanvasSettings";
import type { ElementId, ConnectionId } from "./domain/ids/entityIds";
import { useRetainedInlineEdit } from "./legacy/useRetainedInlineEdit";
import { useElementPresenceMarks } from "./legacy/useElementPresenceMarks";
import { useCanvasMenus } from "./legacy/useCanvasMenus";
import { useConnectionDrawing } from "./legacy/useConnectionDrawing";
import { useCanvasGestures } from "./legacy/useCanvasGestures";
import type { DropBounds } from "./legacy/extensionDropTarget";
import { useToastQueue } from "./components/useToastQueue";
import {
  clipToContainer,
  connectableBounds,
  connectableElementBounds,
  containerRowSize,
  looseCardBounds,
  measureRenderedCard,
  useMeasuredTextCardSizes,
} from "./legacy/canvasElementBounds";
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
import { useCanvasDeletion } from "./legacy/useCanvasDeletion";
import { useCanvasInteraction } from "./legacy/useCanvasInteraction";
import { useCanvasScene } from "./legacy/useCanvasScene";
import { useContainerCardScroll } from "./legacy/useContainerCardScroll";
import { useLayeredCanvasElements } from "./legacy/useLayeredCanvasElements";
import { RetainedCanvasStage } from "./legacy/RetainedCanvasStage";
import type { ContainerCardLayout } from "./legacy/RetainedContainerLayer";
import {
  CONTAINER_TEXT_CARD_ROW_HEIGHT,
  containerCardStackTop,
  containerViewportHeight,
} from "./legacy/containerCardLayout";
import { elementShadows } from "./legacy/RetainedElementLayers";
import type { RetainedElementPresentation } from "./legacy/retainedElementPresentation";
import {
  contextActionIds,
  useRetainedExtensionCommands,
} from "./legacy/useRetainedExtensionCommands";
import { useCopyPasteJsonFlow } from "./extensions/copy-paste-json/useCopyPasteJsonFlow";
import { useWorkflowEditorFlow } from "./extensions/workflow/useWorkflowEditorFlow";
import { useWorkflowRuns } from "./extensions/workflow/useWorkflowRuns";
import type { InteractionElement } from "./app/interactions/canvasInteractionTypes";
import { viewportWorldRectangle } from "./canvas/geometry/viewportMath";
import { rectanglesIntersect } from "./canvas/geometry/canvasGeometry";
import { getLegacyInteractionElements } from "./legacy/interactions/legacyCanvasGeometry";
import { applyLegacyTextCardShiftTransition } from "./legacy/interactions/legacyTextCardModifierTransition";
import { WorkspaceRoot, WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS } from "./ui/patterns/workspace";
import { isModalPresenceBlocking } from "./ui/patterns/overlays";
import { deletionProtectedIds, isLocked } from "./extensions/lock/lockRule";

// Retained images resolve media through session leases; the legacy hash cache holds nothing.
const NO_CACHED_IMAGES: { hash: string; format?: string }[] = [];

const CANVAS_MANAGER_ANIMATION_MS = WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS;

const isEditableKeyboardTarget = (target: HTMLElement | null) =>
  target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

const EMPTY_IDS: string[] = [];

type CallbackMap = Record<string, (...args: never[]) => unknown>;

const useStableCallbacks = <T extends CallbackMap>(callbacks: T): T => {
  const callbacksRef = useRef<T | null>(callbacks);
  const stableCallbacksRef = useRef<T | null>(null);
  callbacksRef.current = callbacks;
  useLayoutEffect(() => {
    callbacksRef.current = callbacks;
    return () => {
      callbacksRef.current = null;
    };
  });

  if (!stableCallbacksRef.current) {
    stableCallbacksRef.current = Object.fromEntries(
      Object.keys(callbacks).map((name) => [
        name,
        (...args: never[]) => callbacksRef.current?.[name](...args),
      ]),
    ) as T;
  }

  return stableCallbacksRef.current;
};

const useRevisionToken = (dependencies: readonly unknown[]) => {
  const revisionRef = useRef<{ dependencies: readonly unknown[]; token: object } | undefined>(
    undefined,
  );
  const previous = revisionRef.current;
  const changed =
    !previous ||
    previous.dependencies.length !== dependencies.length ||
    dependencies.some((dependency, index) => !Object.is(dependency, previous.dependencies[index]));

  if (changed) {
    revisionRef.current = { dependencies, token: {} };
  }

  return revisionRef.current!.token;
};

interface AppProps {
  readonly useSettings: typeof useLegacyCanvasSettings;
  readonly useDocument: typeof useCanvasDocument;
  /** The open database's canvas: the document, its commands and its view projection. */
  readonly retained: RetainedCanvasContextValue;
}

function App({ useDocument, useSettings, retained }: AppProps) {
  const completeRetainedContent = (id: string, to: Record<string, string | boolean | null>) =>
    retained.runtime.callbacks
      .captureContent([{ elementId: id as ElementId, fields: Object.keys(to) }])
      ?.complete([{ elementId: id as ElementId, to }]);
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
  const rename = useRetainedInlineEdit(retained.runtime.callbacks, "name");
  const { editingId: renamingId, draft: renameDraft, end: endRename } = rename;
  const textCardEdit = useRetainedInlineEdit(retained.runtime.callbacks, "text");
  const { editingId: editingTextCardId, draft: textCardDraft } = textCardEdit;
  const textBlockEdit = useRetainedInlineEdit(retained.runtime.callbacks, "text");
  const { editingId: editingTextBlockId, draft: textBlockDraft } = textBlockEdit;
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
  const { textCards: enteringTextCardIds } = presenceMarks.entering;
  const {
    containers: deletingIds,
    textCards: deletingTextCardIds,
    textBlocks: deletingTextBlockIds,
    images: deletingImageIds,
  } = presenceMarks.deleting;
  const { textCards: pulsingTextCardIds } = presenceMarks.pulsing;
  const snapGuides = interactionSnapshot.snapGuides;

  const scene = useCanvasScene({
    containers: elements,
    textBlocks,
    textCards,
    images,
    connections: mindmapConnections,
  });
  const { containersById, textBlocksById, textCardsById, imagesById } = scene;
  const { looseCards: looseTextCards, looseImages } = scene;
  const cardScroll = useContainerCardScroll(textCards, (id) => containersById.get(id));
  const cardLayout = cardScroll.layout;
  const interactionElements = useMemo(
    () => getLegacyInteractionElements(activeCanvas, measuredInteractionCardSizes),
    [activeCanvas, measuredInteractionCardSizes],
  );
  const isElementLocked = (id: string) =>
    isLocked(
      containersById.get(id) ??
        textBlocksById.get(id) ??
        textCardsById.get(id) ??
        imagesById.get(id),
    );
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
    boundsOf: (id) => getConnectableElementBounds(id),
    connected: (first, second) =>
      mindmapConnections.some(
        (connection) =>
          (connection.sourceId === first && connection.targetId === second) ||
          (connection.sourceId === second && connection.targetId === first),
      ),
    isMindmapNode: (id) => textCardsById.get(id)?.kind === "mindmap",
    canvasPoint: (clientX, clientY) => canvasPointFromEvent({ clientX, clientY }),
    canvasSize: () => ({ width: canvasWidth, height: canvasHeight }),
    mindmapAccent: () => defaultElementColors.mindmap,
    onNodeCreated: (id) => animateTextCardIn(id),
    closeContextMenus: () => closeContextMenus(),
  });
  const draggedTextCardIds =
    interactionSnapshot.activeInteraction?.kind === "move"
      ? interactionSnapshot.activeInteraction.targetIds.filter((id) => textCardsById.has(id))
      : EMPTY_IDS;
  const activeTextCardPresentation = textCardInteractionSnapshot.active;
  const releasingTextCardIds =
    textCardInteractionSnapshot.release?.cards.map(({ card }) => card.id) ?? EMPTY_IDS;
  const renderedLooseTextCards = looseTextCards;

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

  const lifecycleActions = useStableCallbacks({
    getCanvasBrowserCanvases: () =>
      canvases.map((canvas) =>
        canvas.id === activeCanvas.id ? { ...activeCanvas, previewViewport: stageSize } : canvas,
      ),
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

  useEffect(() => {
    const htmlSpellCheck = document.documentElement.getAttribute("spellcheck");
    const bodySpellCheck = document.body.getAttribute("spellcheck");

    document.documentElement.setAttribute("spellcheck", "false");
    document.body.setAttribute("spellcheck", "false");

    return () => {
      if (htmlSpellCheck === null) {
        document.documentElement.removeAttribute("spellcheck");
      } else {
        document.documentElement.setAttribute("spellcheck", htmlSpellCheck);
      }

      if (bodySpellCheck === null) {
        document.body.removeAttribute("spellcheck");
      } else {
        document.body.setAttribute("spellcheck", bodySpellCheck);
      }
    };
  }, []);

  const closeContextMenus = menus.closeAll;

  const minimap = useMinimapPresence(
    minimapEnabled,
    interactionSnapshot.activeInteraction?.kind === "pan",
  );
  const showMinimap = minimap.show;

  const canvasPointFromEvent = (event: { clientX: number; clientY: number }) => {
    const { zoom } = interactionController.getSnapshot().viewport;
    const worldRect = worldRef.current?.getBoundingClientRect();
    if (!worldRect) {
      return { x: 0, y: 0 };
    }

    return {
      x: clamp((event.clientX - worldRect.left) / zoom, 0, canvasWidth),
      y: clamp((event.clientY - worldRect.top) / zoom, 0, canvasHeight),
    };
  };

  const isElementVisible = (element: ContainerElement | TextBlockElement) =>
    rectanglesIntersect(
      viewportWorldRectangle(interactionController.getSnapshot().viewport),
      element,
    );

  const interactionGeometryById = new Map(
    interactionSnapshot.geometryPreviews.map((preview) => [preview.id, preview.geometry]),
  );

  const getTextCardRenderPosition = (card: TextCardElement) => {
    const preview = interactionGeometryById.get(card.id);
    if (preview) return { x: preview.x, y: preview.y };
    if (!card.containerId) return undefined;
    const container = containersById.get(card.containerId);
    return container ? cardLayout.cardPosition(container, card) : { x: card.x, y: card.y };
  };

  const getLayerActionIds = (id: string, predicate: (actionId: string) => boolean) =>
    (selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id]).filter(predicate);

  const moveCanvasLayers = (id: string, direction: "back" | "backward" | "forward" | "front") => {
    interactionController.reorder(getLayerActionIds(id, layers.isTopLevel), direction);
    rename.end();
  };

  const layers = useLayeredCanvasElements({
    containers: elements,
    textBlocks,
    textCards,
    images,
    looseCards: renderedLooseTextCards,
    looseImages,
    previews: interactionSnapshot.geometryPreviews,
  });

  const animateContainerIn = (id: string) => presenceMarks.animateIn("containers", id);

  const animateTextCardIn = (id: string) => presenceMarks.animateIn("textCards", id);

  const animateTextBlockIn = (id: string) => presenceMarks.animateIn("textBlocks", id);

  const animateImageIn = (id: string) => presenceMarks.animateIn("images", id);

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
    endEditing: () => {
      rename.end();
      textCardEdit.end();
      textBlockEdit.end();
    },
  });

  const getLooseTextCardSelectionBounds = (card: TextCardElement) =>
    looseCardBounds(card, measuredInteractionCardSizes.get(card.id));

  const getConnectableElementBounds = (id: string) =>
    connectableElementBounds(
      id,
      {
        element: (elementId) =>
          scene.find.container(elementId) ??
          scene.find.textBlock(elementId) ??
          scene.find.image(elementId),
        card: (cardId) => textCardsById.get(cardId),
      },
      getLooseTextCardSelectionBounds,
    );

  const getTextCardRippleBounds = (card: TextCardElement): DropBounds | null => {
    const measured = measureRenderedCard(
      worldRef.current,
      interactionController.getSnapshot().viewport.zoom,
      card.id,
    );
    if (!card.containerId) {
      return measured ?? { ...getLooseTextCardSelectionBounds(card), borderRadius: 8 };
    }
    const container = containersById.get(card.containerId);
    const position = getTextCardRenderPosition(card);
    if (!container || !position) return null;
    if (!cardLayout.visible(container).some(({ id }) => id === card.id)) return null;
    return clipToContainer(
      container,
      measured ?? { left: position.x, top: position.y, ...containerRowSize(container) },
    );
  };

  const selectionBounds = interactionSnapshot.selectionRectangle
    ? {
        left: interactionSnapshot.selectionRectangle.x,
        top: interactionSnapshot.selectionRectangle.y,
        width: interactionSnapshot.selectionRectangle.width,
        height: interactionSnapshot.selectionRectangle.height,
      }
    : null;
  const outlinedIds = interactionSnapshot.selectionRectangle
    ? interactionSnapshot.selectionPreviewIds
    : selectedIds.length > 1
      ? selectedIds
      : [];

  const createElement = useCanvasElementCreation({
    callbacks: retained.runtime.callbacks,
    activeCanvasId: () => activeCanvas.id,
    canvasPoint: (clientX, clientY) => canvasPointFromEvent({ clientX, clientY }),
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
    canvasPoint: (clientX, clientY) => canvasPointFromEvent({ clientX, clientY }),
    images: () => looseImages,
    accent: () => defaultElementColors.image,
    showToast,
  });
  const pickImageForElement = imageImport.pick;
  const loadingImageIds = imageImport.importingIds;

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.target !== worldRef.current) {
      return;
    }

    menus.openCanvas(event.clientX, event.clientY);
  };

  const suppressContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const handleMainPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    // Quick Extensions owns its outside-click close so its exit animation can run.

    if (!target?.closest("[data-text-block-content]") && !isEditableKeyboardTarget(target)) {
      window.getSelection()?.removeAllRanges();
    }

    const focusedControl = target?.closest("button, [role='button'], a, select, [tabindex]");
    if (focusedControl instanceof HTMLElement && !isEditableKeyboardTarget(focusedControl)) {
      requestAnimationFrame(() => focusedControl.blur());
    }

    if (renamingId && !target?.closest("[data-container-rename-input]")) {
      elementActions.saveRename();
    }

    // A menu's own trigger toggles it on click; closing it here first would reopen it.
    if (target?.closest("[data-context-menu], [data-context-menu-trigger]")) {
      return;
    }

    closeContextMenus();
  };

  const getGestureElement = (
    id: string,
    includeContainedCard = false,
  ): InteractionElement | null => {
    const generic = interactionElements.find((element) => element.id === id);
    if (generic) return generic;
    const card = textCardsById.get(id);
    if (!card || !includeContainedCard) return null;
    const position = cardScroll.restingPosition(card);
    const measuredSize = measuredInteractionCardSizes.get(id);
    return {
      id,
      geometry: {
        x: position.x,
        y: position.y,
        width: measuredSize?.width ?? CONTAINER_TEXT_CARD_ROW_HEIGHT * 5,
        height: measuredSize?.height ?? CONTAINER_TEXT_CARD_ROW_HEIGHT,
      },
      locked: isElementLocked(id),
      movable: true,
      resizable: false,
      centerSnapping: card.kind === "mindmap",
    };
  };

  const startMindmapConnection = connectionDrawing.start;

  const openMindmapConnectionMenu = (event: PointerEvent<SVGPathElement>, connectionId: string) =>
    menus.openConnection(event, connectionId);

  const getTextCardCopyPosition = (card: TextCardElement) => {
    const position = getTextCardRenderPosition(card) ?? cardScroll.restingPosition(card);
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
    canvasPoint: (clientX, clientY) => canvasPointFromEvent({ clientX, clientY }),
    containerCardIndex: (containerId, point) => {
      const container = containersById.get(containerId);
      return container ? cardLayout.dropIndex(container, point, textCards, "") : undefined;
    },
    deleteElements: (ids) => deleteContextSelection(ids[0], [...ids]),
    closeContextMenus,
    onPasted: (inserted) => {
      setSelectedIds(inserted.filter((entry) => entry.root).map((entry) => entry.id));
      inserted.forEach((entry) => {
        if (entry.type === "container") animateContainerIn(entry.id);
        else if (entry.type === "image") animateImageIn(entry.id);
        else if (entry.type === "text-block") animateTextBlockIn(entry.id);
        else animateTextCardIn(entry.id);
      });
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

  const getContextActionIds = (id: string) => [...contextActionIds(selectedIds, id)];

  const isMultiContextAction = (id: string) => selectedIds.length > 1 && selectedIds.includes(id);

  /** Extensions installed on any of a context menu's targets. */
  const getContextInstalledExtensions = (id: string): ReadonlySet<RetainedExtensionKey> => {
    const installed = new Set<RetainedExtensionKey>();
    for (const targetId of getContextActionIds(id)) {
      const extensions = scene.element(targetId)?.extensions;
      for (const [key, state] of Object.entries(extensions ?? {}))
        if (state) installed.add(key as RetainedExtensionKey);
    }
    return installed;
  };

  const updateContextAccent = (id: string, accent: string) =>
    extensionCommands.updateSelectionAccent(id, accent);

  const deleteContextSelection = (id: string, actionIdsOverride?: string[]) => {
    const actionIds = actionIdsOverride ?? getContextActionIds(id);
    deletion.remove(actionIds);
    closeContextMenus();
    rename.end();
  };

  const copyPasteJson = useCopyPasteJsonFlow({
    getJson: (id) => retained.runtime.callbacks.getContainerJsonForAi(id as ElementId),
    captureReplace: (id) =>
      captureRetainedViewJsonEdit(
        retained.runtime.callbacks,
        retained.runtime.controller.store.getState().documentWorkspace.document,
        id as ElementId,
        { nextUuid: () => crypto.randomUUID() },
      ),
    containerName: (id) => {
      const container = containersById.get(id);
      return container?.extensions?.copyPasteJson ? container.name : null;
    },
    onReplaced: (id) => {
      cardScroll.reset([id]);
      setSelectedIds([id]);
      textCardEdit.end();
      rename.end();
    },
    showToast,
  });
  useEffect(
    () => retained.runtime.callbacks.subscribeInvalidation(copyPasteJson.closeEditor),
    [retained, copyPasteJson.closeEditor],
  );
  const workflowEditor = useWorkflowEditorFlow({
    getLines: (id) => textCardsById.get(id)?.extensions?.workflow?.lines ?? null,
    getCardName: (id) => textCardsById.get(id)?.text ?? "",
    saveLines: (id, lines) =>
      retained.runtime.callbacks
        .captureExtensionConfiguration("workflow", id as ElementId)
        ?.complete({ lines }).ok ?? false,
    saveCardName: (id, name) => Boolean(completeRetainedContent(id, { text: name })?.ok),
    trust: async (lines) => (await retained.runtime.workflows.trust(lines)).ok,
    chooseFolder: async () => {
      const chosen = await retained.runtime.workflows.chooseFolder();
      return chosen.ok ? chosen.value : null;
    },
  });
  useEffect(
    () => retained.runtime.callbacks.subscribeInvalidation(workflowEditor.closeEditor),
    [retained, workflowEditor.closeEditor],
  );
  const workflowRuns = useWorkflowRuns({
    getLines: (id) => textCardsById.get(id)?.extensions?.workflow?.lines ?? null,
    client: retained.runtime.workflows,
  });
  useEffect(
    () => retained.runtime.callbacks.subscribeInvalidation(workflowRuns.reset),
    [retained, workflowRuns.reset],
  );

  const extensionCommands = useRetainedExtensionCommands({
    callbacks: retained.runtime.callbacks,
    selection: () => interactionController.getSnapshot().selectedIds,
    rememberRecentColor: (color) => rememberRecentColor(color),
    resetContainerScroll: cardScroll.reset,
    closeContextMenus,
    copyPasteJson,
    openWorkflowEditor: workflowEditor.openWorkflowEditor,
    workflowRuns,
  });

  const extensionDrop = useExtensionDrop({
    callbacks: retained.runtime.callbacks,
    document: () => retained.runtime.controller.store.getState().documentWorkspace.document,
    canvasPoint: (clientX, clientY) => canvasPointFromEvent({ clientX, clientY }),
    scene: () => ({
      containers: elements,
      textBlocks,
      looseCards: looseTextCards,
      images: looseImages,
    }),
    find: scene.find,
    cardLayout: () => cardLayout,
    cardBounds: getTextCardRippleBounds,
    looseCardEstimate: getLooseTextCardSelectionBounds,
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
    rename.end();
    textCardEdit.end();
    textBlockEdit.end();
    closeContextMenus();
  };

  const redo = () => {
    retained.runtime.callbacks.redo();
    rename.end();
    textCardEdit.end();
    textBlockEdit.end();
    closeContextMenus();
  };

  const resetCanvasPresentation = () => {
    deletion.cancelPending(activeCanvas.id);
    textCardInteraction.reset();
    setSelectedIds([]);
    presenceMarks.clearDeleting();
    rename.end();
    textCardEdit.end();
    textBlockEdit.end();
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
    gestureElement: getGestureElement,
    scene: () => ({ containers: elements, textBlocks, textCards }),
    isLocked: isElementLocked,
    isFrameVisible: isElementVisible,
    canvasPoint: canvasPointFromEvent,
    canvasSize: () => ({ width: canvasWidth, height: canvasHeight }),
    cardPosition: (card) => cardScroll.restingPosition(card),
    containerCardCandidates: (container) =>
      cardLayout.visible(container).flatMap((card) => {
        const bounds = getTextCardRippleBounds(card);
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
    endEditing: () => {
      rename.end();
      textCardEdit.end();
      textBlockEdit.end();
    },
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
      updateAccent: updateContextAccent,
      cut: clipboard.cut,
      copy: clipboard.copy,
      moveLayer: moveCanvasLayers,
      remove: deleteContextSelection,
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
  const editingTextCardContainerId = editingTextCardId
    ? textCardsById.get(editingTextCardId)?.containerId
    : undefined;
  const containerContentRevision = useRevisionToken([
    cardScroll.offsets,
    deletingTextCardIds,
    draggedTextCardIds,
    interactionSnapshot.activeInteraction?.kind,
    activeTextCardPresentation,
    textCardInteractionSnapshot.release,
    enteringTextCardIds,
    outlinedIds,
    pulsingTextCardIds,
    selectedIds.length,
    textCards,
  ]);

  const canvasWidth = activeCanvas.width;
  const canvasHeight = activeCanvas.height;
  const dragPinnedIds =
    interactionSnapshot.activeInteraction?.kind === "move" ||
    interactionSnapshot.activeInteraction?.kind === "resize"
      ? interactionSnapshot.activeInteraction.targetIds
      : EMPTY_IDS;
  const pinnedRenderIds = useMemo(() => {
    const ids = new Set(selectedIds);
    [renamingId, editingTextBlockId, editingTextCardId].forEach((id) => {
      if (id) ids.add(id);
    });
    dragPinnedIds.forEach((id) => ids.add(id));
    return ids;
  }, [dragPinnedIds, editingTextBlockId, editingTextCardId, renamingId, selectedIds]);
  const minimapViewportWorld = viewportWorldRectangle(interactionSnapshot.viewport);
  const connectableBoundsById = connectableBounds(
    {
      containers: elements,
      textBlocks,
      images: looseImages,
      mindmapNodes: looseTextCards.filter((card) => card.kind === "mindmap"),
    },
    getLooseTextCardSelectionBounds,
    (id) => interactionGeometryById.get(id),
  );
  const overlaidTextCardIds = [...(activeTextCardPresentation?.ids ?? []), ...releasingTextCardIds];
  const canvasElementShadows = elementShadows(layers, {
    deleting: presenceMarks.deleting,
    overlaidCardIds: overlaidTextCardIds,
    draggedCardIds: draggedTextCardIds,
    cardSize: getLooseTextCardSelectionBounds,
    preview: (id) => interactionGeometryById.get(id),
    chromeless: (image) =>
      Boolean((image as unknown as RetainedImageView).media) &&
      !loadingImageIds.includes(image.id) &&
      image.background === false,
  });
  const canvasManagerCanvases = useMemo(
    () => lifecycleActions.getCanvasBrowserCanvases(),
    // The stable callback reads these document revisions. Camera frames are excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeCanvas,
      canvases,
      stageSize,
      deletingIds,
      deletingTextCardIds,
      deletingTextBlockIds,
      deletingImageIds,
      lifecycleActions,
    ],
  );
  const elementPresentation: RetainedElementPresentation = {
    outlinedIds,
    selectedIds,
    draggedIds: dragPinnedIds,
    primaryMoveId:
      interactionSnapshot.activeInteraction?.kind === "move"
        ? (interactionSnapshot.activeInteraction.targetIds[0] ?? null)
        : null,
    shadowsUnderElements,
    recentColors,
    entering: presenceMarks.entering,
    deleting: presenceMarks.deleting,
    pulsing: presenceMarks.pulsing,
    textCardEdit: { id: editingTextCardId, draft: textCardDraft },
    textBlockEdit: { id: editingTextBlockId, draft: textBlockDraft },
    rename: { id: renamingId, draft: renameDraft },
    importingImageIds: loadingImageIds,
  };
  const containerCardLayout: ContainerCardLayout = {
    cardsOf: (container) =>
      (cardScroll.grouped.get(container.id) ?? []).filter(
        (card) => !draggedTextCardIds.includes(card.id),
      ),
    visibleCards: (container, cards) => cardLayout.visible(container, [...cards]),
    scrollOffset: cardLayout.scrollOffset,
    viewportHeight: containerViewportHeight,
    stackTop: containerCardStackTop,
    insertion: {
      containerId: activeTextCardPresentation?.targetContainerId ?? null,
      index: activeTextCardPresentation?.insertionIndex ?? null,
      count: activeTextCardPresentation?.ids.length ?? 0,
    },
    releasingIds: releasingTextCardIds,
    contentRevision: containerContentRevision,
    contentEditRevision: (containerId) =>
      editingTextCardContainerId === containerId
        ? `${editingTextCardId}\u0000${textCardDraft}`
        : "",
  };

  return (
    <WorkspaceRoot
      className="taskmap-workspace-root--canvas"
      spellCheck={false}
      onContextMenu={suppressContextMenu}
      onPointerDownCapture={handleMainPointerDownCapture}
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
            onCanvasContextMenu={handleCanvasContextMenu}
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
            pinnedIds={pinnedRenderIds}
            shadows={{
              underElements: shadowsUnderElements,
              rectangles: canvasElementShadows,
              draggedIds: dragPinnedIds,
            }}
            presentation={elementPresentation}
            containerLayout={containerCardLayout}
            actions={elementActions}
            extensionCommands={extensionCommands}
            media={retained.runtime.media}
            overlaidCardIds={overlaidTextCardIds}
            cardPosition={getTextCardRenderPosition}
            overlays={{
              heldCards: activeTextCardPresentation,
              releasedCards: textCardInteractionSnapshot.release,
              cardById: (id) => textCardsById.get(id),
              outlinedIds,
              connectionPorts: connectionDrawing.mode
                ? {
                    bounds: connectableBoundsById,
                    accentOf: (ownerId) => {
                      const mindmap = textCardsById.get(ownerId);
                      return (
                        containersById.get(ownerId)?.accent ??
                        textBlocksById.get(ownerId)?.accent ??
                        imagesById.get(ownerId)?.accent ??
                        (mindmap?.kind === "mindmap"
                          ? getTextCardAccent(mindmap.accent)
                          : defaultElementColors.mindmap)
                      );
                    },
                    drag: connectionDrawing.draft,
                    onStartConnection: startMindmapConnection,
                  }
                : null,
            }}
            selectionVisible={Boolean(selectionBounds)}
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
            isMultiTarget={isMultiContextAction}
            installedOnTargets={getContextInstalledExtensions}
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

          {copyPasteJson.editorWindow}
          {workflowEditor.editorWindow}
          {workflowRuns.reviewDialog}

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
