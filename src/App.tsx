import {
  PointerEvent,
  SetStateAction,
  Suspense,
  WheelEvent,
  lazy,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ContainerActions } from "./elements/container/containerView";
import type { RetainedExtensionKey } from "./extensions/retainedExtensionDefinition";
import type { ContainerMenuActions } from "./elements/container/ContainerMenu";
import { captureRetainedViewJsonEdit } from "./legacy/retainedViewJsonEdit";
import { FloatingToolbar } from "./components/FloatingToolbar";
import { ExtensionDropRipples, useExtensionDropRipples } from "./components/ExtensionDropRipples";
import type { ImageActions } from "./elements/image/ImageRenderer";
import type { ImageMenuActions } from "./elements/image/ImageMenu";
import { useRetainedImageImport } from "./legacy/useRetainedImageImport";
import type { RetainedImageView } from "./elements/image/imageViewProjection";
import { Minimap } from "./components/Minimap";
import { canvasMindMapConnections } from "./elements/mind-map/mindMapConnectionViewProjection";
import { MindMapConnections } from "./elements/mind-map/MindMapConnections";
import type { TextCardActions } from "./elements/text-card/TextCardRenderer";
import type { TextCardMenuActions } from "./elements/text-card/TextCardMenu";
import type { TextBlockActions } from "./elements/text-block/textBlockView";
import type { TextBlockMenuActions } from "./elements/text-block/TextBlockMenu";
import { ToastStack } from "./components/ToastStack";
import { DEFAULT_ELEMENT_COLORS, getTextCardAccent } from "./constants";
import { clamp } from "./canvasMath";
import {
  AppData,
  ContainerElement,
  ImageElement,
  TaskCanvas,
  TextBlockElement,
  TextCardElement,
} from "./types";
import { commandErrorMessage } from "./app/commandError";
import { planCanvasDeletion } from "./app/canvasDocument";
import { DEFAULT_CANVAS, DEFAULT_GRID_OPACITY } from "./app/defaultData";
import { useImageCache } from "./hooks/useImageCache";
import { useAppUpdates } from "./hooks/useAppUpdates";
import { useCanvasDocument } from "./hooks/useCanvasDocument";
import {
  useRetainedDocumentConnections,
  type RetainedCanvasContextValue,
} from "./legacy/RetainedCanvasContext";
import { createRetainedViewElement } from "./legacy/retainedViewCreation";
import { useLegacyCanvasSettings } from "./legacy/useLegacyCanvasSettings";
import { installRetainedViewExtension } from "./legacy/retainedViewExtensions";
import type { CanvasId, ElementId, ConnectionId } from "./domain/ids/entityIds";
import { captureRetainedLinkEdit } from "./app/commands/retainedEditorCallbacks";
import { useRetainedInlineEdit } from "./legacy/useRetainedInlineEdit";
import { useElementPresenceMarks } from "./legacy/useElementPresenceMarks";
import { useCanvasMenus } from "./legacy/useCanvasMenus";
import { useConnectionDrawing } from "./legacy/useConnectionDrawing";
import { useCanvasGestures } from "./legacy/useCanvasGestures";
import {
  extensionDropTargetIds,
  findExtensionDropTarget,
  type DropBounds,
  type ExtensionDropTarget,
} from "./legacy/extensionDropTarget";
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
import { useCanvasManagement } from "./legacy/useCanvasManagement";
import { useLeftPanel } from "./legacy/useLeftPanel";
import { RetainedCanvasMenus } from "./legacy/RetainedCanvasMenus";
import { RetainedCanvasOverlays } from "./legacy/RetainedCanvasOverlays";
import { useCanvasShortcuts } from "./legacy/useCanvasShortcuts";
import { useRetainedClipboard } from "./legacy/useRetainedClipboard";
import {
  newContainer,
  newImagePlaceholder,
  newLooseTextCard,
  newTextBlock,
} from "./legacy/newCanvasElements";
import { ContainerLayer, type ContainerCardLayout } from "./legacy/RetainedContainerLayer";
import {
  CONTAINER_HEADER_HEIGHT,
  CONTAINER_TEXT_CARD_GAP,
  CONTAINER_TEXT_CARD_PADDING,
  CONTAINER_TEXT_CARD_ROW_HEIGHT,
  containerCardStackTop,
  containerViewportHeight,
  createContainerCardLayout,
  groupContainerCards,
} from "./legacy/containerCardLayout";
import {
  ElementShadowLayer,
  ImageLayer,
  LooseTextCardLayer,
  TextBlockLayer,
} from "./legacy/RetainedElementLayers";
import type { RetainedElementPresentation } from "./legacy/retainedElementPresentation";
import {
  contextActionIds,
  useRetainedExtensionCommands,
} from "./legacy/useRetainedExtensionCommands";
import { isExtensionCompatible, type ExtensionTargetType } from "./extensions/extensionCatalog";
import { useCopyPasteJsonFlow } from "./extensions/copy-paste-json/useCopyPasteJsonFlow";
import { useWorkflowEditorFlow } from "./extensions/workflow/useWorkflowEditorFlow";
import { useWorkflowRuns } from "./extensions/workflow/useWorkflowRuns";
import { addsCardAdornment } from "./extensions/cardAdornmentRegistry";
import type { CanvasInteractionController } from "./app/interactions/canvasInteractionController";
import type { InteractionElement } from "./app/interactions/canvasInteractionTypes";
import { useStableCanvasInteractionController } from "./app/interactions/useStableCanvasInteractionController";
import { viewportWorldRectangle } from "./canvas/geometry/viewportMath";
import { rectanglesIntersect } from "./canvas/geometry/canvasGeometry";
import { LegacyCanvasVisibility } from "./legacy/interactions/LegacyCanvasVisibility";
import { useLegacyInteractionSnapshot } from "./legacy/interactions/useLegacyInteractionSnapshot";
import { useLegacyCameraPresentation } from "./legacy/interactions/useLegacyCameraPresentation";
import { getLegacyInteractionElements } from "./legacy/interactions/legacyCanvasGeometry";
import { projectLegacyGeometry } from "./legacy/interactions/legacyCanvasGeometry";
import { applyLegacySelectionAction } from "./legacy/interactions/legacySelectionCompatibility";
import { createLegacyTextCardInteractionService } from "./legacy/interactions/legacyTextCardInteraction";
import { applyLegacyTextCardShiftTransition } from "./legacy/interactions/legacyTextCardModifierTransition";
import {
  CanvasFrame,
  MINIMAP_VISIBILITY_DURATION_MS,
  WorkspaceBackdropLayer,
  WorkspaceChromeLayer,
  WorkspaceRoot,
  WorkspaceSidePanel,
  WorkspaceSidePanelContentSwitcher,
  WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS,
} from "./ui/patterns/workspace";
import { isModalPresenceBlocking, ModalPresence } from "./ui/patterns/overlays";
import { useChromeAutoHide } from "./ui/patterns/workspace/chromeSleep";
import { setWorkspaceRadii, useWorkspaceRadii } from "./ui/patterns/workspace/workspaceRadii";
import {
  beginWorkspaceOutro,
  cancelWorkspaceOutro,
  useWorkspaceIntroArrival,
  useWorkspaceIntroDeparture,
} from "./ui/patterns/workspace/workspaceIntro";
import { CanvasManager as CanvasManagerView } from "./components/CanvasManager";
import { ExtensionsPanel, QuickExtensionsMenu } from "./components/ExtensionsPanel";
import { ClearCanvasModal, SettingsModal, UpdateAvailableModal } from "./components/Modals";
import { deletionProtectedIds, isLocked } from "./extensions/lock/lockRule";
import { searchRowHeight } from "./extensions/search/searchRule";

// Core surfaces are imported up front: a lazy first open waited on React's ~300 ms Suspense reveal
// throttle (the first Tab took ~306 ms versus ~35 ms afterwards), and the app loads from local disk.
const CanvasManager = memo(
  CanvasManagerView,
  (previous, next) =>
    previous.active === next.active &&
    previous.canvases === next.canvases &&
    previous.activeCanvasId === next.activeCanvasId &&
    previous.cycleHighlightCanvasId === next.cycleHighlightCanvasId &&
    previous.cardRadius === next.cardRadius &&
    previous.closing === next.closing &&
    previous.embedded === next.embedded &&
    previous.sharedPanel === next.sharedPanel &&
    previous.minimalView === next.minimalView &&
    previous.panelRadius === next.panelRadius &&
    previous.viewportWidth === next.viewportWidth &&
    previous.viewportHeight === next.viewportHeight,
);
const DevelopmentFpsCounter = import.meta.env.DEV
  ? lazy(() =>
      import("./components/FpsCounter").then(({ FpsCounter }) => ({ default: FpsCounter })),
    )
  : null;

// Retained images resolve media through session leases; the legacy hash cache holds nothing.
const NO_CACHED_IMAGES: { hash: string; format?: string }[] = [];
const createEntityId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const CANVAS_MANAGER_ANIMATION_MS = WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS;

const isEditableKeyboardTarget = (target: HTMLElement | null) =>
  target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

const CANVAS_CONTENT_INSET = 1;
const EMPTY_IDS: string[] = [];
const LOOSE_TEXT_CARD_RENDER_WIDTH = 540;
const LOOSE_TEXT_CARD_RENDER_HEIGHT = 320;

type Rectangle = { left: number; top: number; width: number; height: number };

type CanvasElementShadow = Rectangle & {
  id: string;
  radius: number;
  strength: "shell" | "card";
};

// Canvas workspace geometry. The matching CSS tokens live on `.taskmap-workspace-root--canvas`.
const CANVAS_PREVIEW_GAP = 9;

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

const useCanvasLayers = <T extends { id: string; layer?: number }>(
  items: T[],
  layerMap: Map<string, number>,
): T[] => {
  const cacheRef = useRef(new Map<string, { source: T; layer?: number; result: T }>());

  return useMemo(() => {
    const activeIds = new Set(items.map((item) => item.id));
    cacheRef.current.forEach((_, id) => {
      if (!activeIds.has(id)) cacheRef.current.delete(id);
    });

    return items.map((item) => {
      const layer = layerMap.get(item.id) ?? item.layer;
      if (layer === item.layer) {
        cacheRef.current.delete(item.id);
        return item;
      }

      const cached = cacheRef.current.get(item.id);
      if (cached?.source === item && cached.layer === layer) {
        return cached.result;
      }

      const result = { ...item, layer };
      cacheRef.current.set(item.id, { source: item, layer, result });
      return result;
    });
  }, [items, layerMap]);
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
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const lastPointerPositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const minimapTimeoutRef = useRef<number | null>(null);
  const minimapUnmountTimeoutRef = useRef<number | null>(null);
  const containerScrollOffsetsRef = useRef<Record<string, number>>({});
  const historyTransactionsRef = useRef<Map<string, Set<string>>>(new Map());
  const dirtyHistoryTransactionsRef = useRef<Set<string>>(new Set());
  const dirtyCanvasVersionsRef = useRef<Map<string, number>>(new Map());
  const pendingDeletionTimeoutsRef = useRef<Map<string, Set<number>>>(new Map());
  const activeCanvasIdRef = useRef(DEFAULT_CANVAS.id);
  const latestDataGetterRef = useRef<() => AppData>(() => latestAppDataRef.current);
  const latestAppDataRef = useRef<AppData>({
    schemaVersion: 2,
    activeCanvasId: DEFAULT_CANVAS.id,
    canvases: [DEFAULT_CANVAS],
    canvasGridStyle: "dots",
    canvasGridOpacity: DEFAULT_GRID_OPACITY,
    defaultElementColors: DEFAULT_ELEMENT_COLORS,
    recentColors: [],
    shadowsUnderElements: false,
    allowLockedElementDeletion: true,
    minimapEnabled: true,
    privacyModeEnabled: false,
    toolbarButtonsVisible: false,
  });
  const appDataLoadedRef = useRef(false);
  const {
    activeCanvas,
    canvases,
    elements,
    images,
    mindmapConnections,
    setActiveCanvas,
    setCamera,
    textBlocks,
    textCards,
    zoom: legacyZoom,
  } = useDocument();
  activeCanvasIdRef.current = activeCanvas.id;
  const interactionBindingsRef = useRef({ activeCanvas, setActiveCanvas, setCamera });
  interactionBindingsRef.current = { activeCanvas, setActiveCanvas, setCamera };
  const textCardInteractionRef = useRef<ReturnType<
    typeof createLegacyTextCardInteractionService
  > | null>(null);
  if (!textCardInteractionRef.current) {
    textCardInteractionRef.current = createLegacyTextCardInteractionService({
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (handle) => window.cancelAnimationFrame(handle),
      setTimer: (callback, delay) => window.setTimeout(callback, delay),
      clearTimer: (handle) => window.clearTimeout(handle),
    });
  }
  const textCardInteraction = textCardInteractionRef.current;
  const interactionControllerRef = useRef<CanvasInteractionController | null>(null);
  const interactionStageSizeRef = useRef(stageSize);
  interactionStageSizeRef.current = stageSize;
  const interactionController = useStableCanvasInteractionController(
    () => retained.binding.interaction,
  );
  interactionControllerRef.current = interactionController;
  const interactionSnapshot = useLegacyInteractionSnapshot(interactionController);
  useLegacyCameraPresentation(interactionController, stageRef, selectionRef);
  const textCardInteractionSnapshot = useSyncExternalStore(
    textCardInteraction.subscribe,
    textCardInteraction.getSnapshot,
    textCardInteraction.getSnapshot,
  );
  useEffect(() => {
    interactionController.resizeViewport(stageSize);
  }, [interactionController, stageSize]);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [minimapMounted, setMinimapMounted] = useState(false);
  const selectedIds = interactionSnapshot.selectedIds as string[];
  const setSelectedIds = (value: SetStateAction<string[]>) => {
    applyLegacySelectionAction(interactionController, value);
  };
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
  useEffect(() => {
    const reset = () => {
      if (!retained.runtime.controller.store.getState().documentWorkspace.document) {
        latestAppDataRef.current = {
          ...latestAppDataRef.current,
          canvases: [],
          activeCanvasId: "",
        };
        latestDataGetterRef.current = () => latestAppDataRef.current;
      }
      textCardInteraction.reset();
    };
    const unsubscribe = retained.runtime.callbacks.subscribeInvalidation(reset);
    return () => {
      unsubscribe();
      reset();
    };
  }, [retained, textCardInteraction]);
  const measuredCards = useMeasuredTextCardSizes(activeCanvas.id);
  const measuredInteractionCardSizes = measuredCards.sizes;
  const {
    canvasGridStyle,
    setCanvasGridStyle,
    canvasGridOpacity,
    setCanvasGridOpacity,
    defaultElementColors,
    setDefaultElementColors,
    recentColors,
    setRecentColors,
    shadowsUnderElements,
    setShadowsUnderElements,
    allowLockedElementDeletion,
    setAllowLockedElementDeletion,
    minimapEnabled,
    setMinimapEnabled,
    privacyModeEnabled,
    setPrivacyModeEnabled,
    toolbarButtonsVisible,
    chromeAutoHideEnabled,
    setChromeAutoHideEnabled,
    chromeAutoHideDelayMs,
    setChromeAutoHideDelayMs,
    chromeRadii,
    setChromeRadii,
    closeToTray,
    setCloseToTray,
    trayLockMinutes,
    setTrayLockMinutes,
    dismissedUpdateVersion,
    setDismissedUpdateVersion,
    gridOpacityEdit,
    settingsError,
  } = useSettings();
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fpsCounterVisible, setFpsCounterVisible] = useState(false);
  const [temporaryPanelsVisible, setTemporaryPanelsVisible] = useState(false);
  const { toasts, showToast, dismissToast } = useToastQueue();
  const leftPanel = useLeftPanel(CANVAS_MANAGER_ANIMATION_MS);
  const { canvasManagerOpen, canvasManagerClosing, extensionsOpen, extensionsClosing } = leftPanel;
  const [canvasManagerMinimalView, setCanvasManagerMinimalView] = useState(false);
  const [quickExtensionsMenu, setQuickExtensionsMenu] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
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
  const dropRipples = useExtensionDropRipples();

  const [containerScrollOffsets, setContainerScrollOffsets] = useState<Record<string, number>>({});
  containerScrollOffsetsRef.current = containerScrollOffsets;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const updateStageSize = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      setStageSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    updateStageSize();
    const observer = new ResizeObserver(updateStageSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      textCardInteraction.cancelScheduledPresentation();
    },
    [textCardInteraction],
  );

  const containersById = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );
  const textCardsById = useMemo(
    () => new Map(textCards.map((card) => [card.id, card])),
    [textCards],
  );
  const textBlocksById = useMemo(
    () => new Map(textBlocks.map((element) => [element.id, element])),
    [textBlocks],
  );
  const orderedTextCardsByContainerId = useMemo(() => groupContainerCards(textCards), [textCards]);
  const looseTextCards = useMemo(() => textCards.filter((card) => !card.containerId), [textCards]);
  const imagesById = useMemo(() => new Map(images.map((image) => [image.id, image])), [images]);
  const mindmapConnectionsById = useMemo(
    () => new Map(mindmapConnections.map((connection) => [connection.id, connection])),
    [mindmapConnections],
  );
  const looseImages = useMemo(() => images.filter((image) => !image.containerId), [images]);
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
  activeCanvasIdRef.current = activeCanvas.id;

  const getActiveCanvasSnapshot = (): TaskCanvas => {
    const live = interactionController.getSnapshot();
    const viewport = live.canvasKey === activeCanvas.id ? live.viewport : activeCanvas;
    const geometryPreviews = live.canvasKey === activeCanvas.id ? live.geometryPreviews : [];
    return {
      ...activeCanvas,
      containers: projectLegacyGeometry(elements, geometryPreviews),
      textCards: projectLegacyGeometry(textCards, geometryPreviews),
      textBlocks: projectLegacyGeometry(textBlocks, geometryPreviews),
      images: projectLegacyGeometry(images, geometryPreviews),
      mindmapConnections,
      pan: viewport.pan,
      zoom: viewport.zoom,
      previewViewport: {
        width: stageRef.current?.clientWidth ?? window.innerWidth,
        height: stageRef.current?.clientHeight ?? window.innerHeight,
      },
    };
  };

  const getPersistedCanvases = () => {
    const snapshot = getActiveCanvasSnapshot();
    return canvases.map((canvas) => (canvas.id === snapshot.id ? snapshot : canvas));
  };

  const getCurrentAppData = (): AppData => ({
    schemaVersion: 2,
    activeCanvasId: activeCanvas.id,
    canvases: getPersistedCanvases(),
    canvasGridStyle,
    canvasGridOpacity,
    defaultElementColors,
    recentColors,
    shadowsUnderElements,
    allowLockedElementDeletion,
    minimapEnabled,
    privacyModeEnabled,
    toolbarButtonsVisible,
    dismissedUpdateVersion,
  });
  latestDataGetterRef.current = getCurrentAppData;

  const updateHistoryState = () => {
    const history = retained.runtime.controller.store.getState().documentWorkspace.history;
    setHistoryState({ canUndo: history.past.length > 0, canRedo: history.future.length > 0 });
  };

  const lifecycleActions = useStableCallbacks({
    getActiveCanvasSnapshot,
    getCanvasBrowserCanvases: () =>
      canvases.map((canvas) =>
        canvas.id === activeCanvas.id ? { ...activeCanvas, previewViewport: stageSize } : canvas,
      ),
    getCurrentAppData,
    updateHistoryState,
  });

  useEffect(() => {
    if (!appDataLoadedRef.current) {
      return;
    }
    const currentVersion = dirtyCanvasVersionsRef.current.get(activeCanvas.id) ?? 0;
    dirtyCanvasVersionsRef.current.set(activeCanvas.id, currentVersion + 1);
  }, [activeCanvas.id, elements, images, mindmapConnections, textBlocks, textCards]);

  useEffect(() => {
    lifecycleActions.updateHistoryState();
    return retained.runtime.controller.store.subscribe(() => lifecycleActions.updateHistoryState());
  }, [lifecycleActions, retained]);

  const {
    appVersion,
    availableUpdate,
    updateModalOpen,
    checkForAppUpdate,
    installAppUpdate,
    dismissUpdateModal,
  } = useAppUpdates({
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
    const pendingDeletionTimeouts = pendingDeletionTimeoutsRef.current;
    const historyTransactions = historyTransactionsRef.current;
    const dirtyHistoryTransactions = dirtyHistoryTransactionsRef.current;
    return () => {
      if (minimapTimeoutRef.current) {
        window.clearTimeout(minimapTimeoutRef.current);
      }
      if (minimapUnmountTimeoutRef.current) {
        window.clearTimeout(minimapUnmountTimeoutRef.current);
      }
      historyTransactions.clear();
      dirtyHistoryTransactions.clear();
      pendingDeletionTimeouts.forEach((timeouts) =>
        timeouts.forEach((timeout) => window.clearTimeout(timeout)),
      );
      pendingDeletionTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (minimapEnabled) {
      return;
    }

    if (minimapTimeoutRef.current) {
      window.clearTimeout(minimapTimeoutRef.current);
      minimapTimeoutRef.current = null;
    }
    if (minimapUnmountTimeoutRef.current) {
      window.clearTimeout(minimapUnmountTimeoutRef.current);
      minimapUnmountTimeoutRef.current = null;
    }
    setMinimapVisible(false);
    setMinimapMounted(false);
  }, [minimapEnabled]);

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

  const showMinimap = () => {
    if (!minimapEnabled) {
      return;
    }

    setMinimapMounted(true);
    setMinimapVisible(true);

    if (minimapTimeoutRef.current) {
      window.clearTimeout(minimapTimeoutRef.current);
    }
    if (minimapUnmountTimeoutRef.current) {
      window.clearTimeout(minimapUnmountTimeoutRef.current);
      minimapUnmountTimeoutRef.current = null;
    }

    minimapTimeoutRef.current = window.setTimeout(() => {
      setMinimapVisible(false);
      minimapUnmountTimeoutRef.current = window.setTimeout(() => {
        setMinimapMounted(false);
        minimapUnmountTimeoutRef.current = null;
      }, MINIMAP_VISIBILITY_DURATION_MS);
    }, 2200);
  };

  const cardLayout = createContainerCardLayout(
    textCards,
    orderedTextCardsByContainerId,
    containerScrollOffsets,
  );
  const getContainerVisibleTextCards = cardLayout.visible;

  const getContainerViewportHeight = containerViewportHeight;

  const getContainerMaxScroll = cardLayout.maxScroll;

  const getContainerScrollOffset = cardLayout.scrollOffset;

  const getScrollOffsetForVisibleCardIndex = cardLayout.revealOffset;

  const getContainerCardStackTop = containerCardStackTop;

  const handleContainerWheel = (event: WheelEvent<HTMLElement>, container: ContainerElement) => {
    const maxScroll = getContainerMaxScroll(container);

    if (maxScroll <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setContainerScrollOffsets((current) => ({
      ...current,
      [container.id]: clamp((current[container.id] ?? 0) + event.deltaY, 0, maxScroll),
    }));
  };

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

  const getOrderedContainerTextCards = (containerId: string, cards = textCards) =>
    cardLayout.ordered(containerId, cards);

  const getTextCardStackPosition = (card: TextCardElement, cards = textCards) => {
    const container = card.containerId ? containersById.get(card.containerId) : null;
    return container ? cardLayout.cardPosition(container, card, cards) : { x: card.x, y: card.y };
  };

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
  const getTextCardDropIndex = cardLayout.dropIndex;

  const normalizeTextCardOrders = (cards: TextCardElement[]) => {
    const nextCards = cards.map((card) => ({ ...card }));
    const containerIds = Array.from(
      new Set(nextCards.map((card) => card.containerId).filter((id): id is string => Boolean(id))),
    );

    containerIds.forEach((containerId) => {
      nextCards
        .filter((card) => card.containerId === containerId)
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
        .forEach((card, index) => {
          card.order = index;
        });
    });

    return nextCards;
  };

  const getLayerActionIds = (id: string, predicate: (actionId: string) => boolean) =>
    (selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id]).filter(predicate);

  const moveCanvasLayers = (id: string, direction: "back" | "backward" | "forward" | "front") => {
    const topLevelItems = [
      ...elements,
      ...textBlocks,
      ...textCards.filter((card) => !card.containerId),
      ...images.filter((image) => !image.containerId),
    ].sort(
      (left, right) =>
        (left.layer ?? Number.MAX_SAFE_INTEGER) - (right.layer ?? Number.MAX_SAFE_INTEGER),
    );
    const topLevelIds = new Set(topLevelItems.map((item) => item.id));
    const actionIds = getLayerActionIds(id, (actionId) => topLevelIds.has(actionId));
    interactionController.reorder(actionIds, direction);
    rename.end();
  };

  const topLevelLayerMap = useMemo(() => {
    const ordered = [
      ...elements,
      ...textBlocks,
      ...textCards.filter((card) => !card.containerId),
      ...images.filter((image) => !image.containerId),
    ].sort(
      (left, right) =>
        (left.layer ?? Number.MAX_SAFE_INTEGER) - (right.layer ?? Number.MAX_SAFE_INTEGER),
    );

    return new Map(ordered.map((item, index) => [item.id, index]));
  }, [elements, images, textBlocks, textCards]);

  const previewGeometries = interactionSnapshot.geometryPreviews;
  const settledLayeredElements = useCanvasLayers(elements, topLevelLayerMap);
  const settledLayeredTextBlocks = useCanvasLayers(textBlocks, topLevelLayerMap);
  const settledLayeredLooseTextCards = useCanvasLayers(renderedLooseTextCards, topLevelLayerMap);
  const settledLayeredLooseImages = useCanvasLayers(looseImages, topLevelLayerMap);
  const layeredElements = useMemo(
    () => projectLegacyGeometry(settledLayeredElements, previewGeometries),
    [previewGeometries, settledLayeredElements],
  );
  const layeredTextBlocks = useMemo(
    () => projectLegacyGeometry(settledLayeredTextBlocks, previewGeometries),
    [previewGeometries, settledLayeredTextBlocks],
  );
  const layeredLooseTextCards = useMemo(
    () => projectLegacyGeometry(settledLayeredLooseTextCards, previewGeometries),
    [previewGeometries, settledLayeredLooseTextCards],
  );
  const layeredLooseImages = useMemo(
    () => projectLegacyGeometry(settledLayeredLooseImages, previewGeometries),
    [previewGeometries, settledLayeredLooseImages],
  );

  const addIdsToSelection = (ids: string[]) => {
    setSelectedIds((current) => Array.from(new Set([...current, ...ids])));
  };

  const applySelection = (ids: string[], additive = false) => {
    if (additive) {
      addIdsToSelection(ids);
      return;
    }

    setSelectedIds(ids);
  };

  const selectCanvasElement = (element: ContainerElement | TextBlockElement, additive = false) => {
    applySelection([element.id], additive);
  };

  const animateContainerIn = (id: string) => presenceMarks.animateIn("containers", id);

  const animateTextCardIn = (id: string) => presenceMarks.animateIn("textCards", id);

  const animateTextBlockIn = (id: string) => presenceMarks.animateIn("textBlocks", id);

  const animateImageIn = (id: string) => presenceMarks.animateIn("images", id);

  const scheduleDeletionCommit = (canvasId: string, commit: () => void, delayMs: number) => {
    const timeout = window.setTimeout(() => {
      const canvasTimeouts = pendingDeletionTimeoutsRef.current.get(canvasId);
      canvasTimeouts?.delete(timeout);
      if (canvasTimeouts?.size === 0) {
        pendingDeletionTimeoutsRef.current.delete(canvasId);
      }
      commit();
    }, delayMs);
    const canvasTimeouts = pendingDeletionTimeoutsRef.current.get(canvasId) ?? new Set<number>();
    canvasTimeouts.add(timeout);
    pendingDeletionTimeoutsRef.current.set(canvasId, canvasTimeouts);
  };

  const cancelPendingDeletionCommits = (canvasId: string) => {
    pendingDeletionTimeoutsRef.current
      .get(canvasId)
      ?.forEach((timeout) => window.clearTimeout(timeout));
    pendingDeletionTimeoutsRef.current.delete(canvasId);
    if (canvasId === activeCanvasIdRef.current) {
      presenceMarks.clearDeleting();
    }
  };

  const pulseTextCard = (id: string) => presenceMarks.pulse("textCards", id);

  const pulseTextBlock = (id: string) => presenceMarks.pulse("textBlocks", id);

  const removeMindmapConnection = (id: string) => {
    retained.runtime.callbacks.captureConnectionDelete(id as ConnectionId)?.complete();
    menus.closeConnection();
  };

  const deleteRetainedSelection = (ids: string[]) => {
    const capture = retained.runtime.callbacks.captureDelete(ids as ElementId[]);
    if (!capture) return;
    const plan = planCanvasDeletion(activeCanvas, ids, isElementDeletionLocked);
    presenceMarks.markDeleting({
      containers: plan.containerIds,
      textCards: plan.textCardIds,
      textBlocks: plan.textBlockIds,
      images: plan.imageIds,
    });
    closeContextMenus();
    scheduleDeletionCommit(
      activeCanvas.id,
      () => {
        capture.complete();
        presenceMarks.clearDeleting();
        setSelectedIds([]);
      },
      180,
    );
  };

  const deleteCanvasSelection = (actionIds: string[]) => {
    deleteRetainedSelection(actionIds);
  };

  const { close: closeLeftPanel, show: switchLeftPanel } = leftPanel;
  const closeCanvasManager = useCallback(() => closeLeftPanel("canvases"), [closeLeftPanel]);
  const closeExtensionsPanel = useCallback(() => closeLeftPanel("extensions"), [closeLeftPanel]);

  useEffect(() => {
    const trackPointer = (event: globalThis.PointerEvent) => {
      lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("pointermove", trackPointer, true);
    return () => window.removeEventListener("pointermove", trackPointer, true);
  }, []);

  const deletionActions = useStableCallbacks({
    deleteCanvasSelection,
  });

  const getLooseTextCardSelectionBounds = (card: TextCardElement) =>
    looseCardBounds(card, measuredInteractionCardSizes.get(card.id));

  const getConnectableElementBounds = (id: string) =>
    connectableElementBounds(
      id,
      {
        element: (elementId) =>
          containersById.get(elementId) ??
          textBlocksById.get(elementId) ??
          imagesById.get(elementId),
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
    if (!getContainerVisibleTextCards(container).some(({ id }) => id === card.id)) return null;
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

  const newElementPlacement = (id: string, clientX: number, clientY: number) => ({
    id,
    point: canvasPointFromEvent({ clientX, clientY }),
    canvas: { width: canvasWidth, height: canvasHeight },
    colors: defaultElementColors,
  });

  const createContainer = (clientX: number, clientY: number) => {
    const id = createEntityId("element");
    const nextElement = newContainer(newElementPlacement(id, clientX, clientY), elements.length);

    if (
      !createRetainedViewElement(retained.runtime.callbacks, activeCanvas.id as CanvasId, {
        type: "container",
        value: nextElement,
      }).ok
    )
      return;
    setSelectedIds([id]);
    animateContainerIn(id);
    closeContextMenus();
    textCardEdit.end();
    rename.begin(id, nextElement.name);
  };

  // Create an empty image placeholder at a canvas point; the caller (or the
  // user clicking it) fills it with a picked/dropped/pasted image afterwards.
  const createImageElement = (clientX: number, clientY: number): string => {
    const id = createEntityId("element");
    const image = newImagePlaceholder(newElementPlacement(id, clientX, clientY));

    const result = createRetainedViewElement(
      retained.runtime.callbacks,
      activeCanvas.id as CanvasId,
      { type: "image", value: image },
    );
    if (!result.ok) throw new Error("The image could not be created.");
    animateImageIn(id);
    setSelectedIds([id]);
    closeContextMenus();
    rename.end();
    return id;
  };

  const imageImport = useRetainedImageImport({
    runtime: retained.runtime,
    canvasPoint: (clientX, clientY) => canvasPointFromEvent({ clientX, clientY }),
    images: () => looseImages,
    accent: () => defaultElementColors.image,
    showToast,
  });
  const pickImageForElement = imageImport.pick;
  const loadingImageIds = imageImport.importingIds;

  // Canvas menu "Image": drop an empty placeholder. The user fills it by
  // double-clicking inside (or dropping a file onto it).
  const createImageFromMenu = (clientX: number, clientY: number) => {
    createImageElement(clientX, clientY);
  };

  const toggleImageBackground = (id: string) => {
    completeRetainedContent(id, { background: imagesById.get(id)?.background === false });
    closeContextMenus();
  };

  const createLooseTextCard = (
    clientX: number,
    clientY: number,
    text: string,
    kind?: TextCardElement["kind"],
    startEditing = true,
  ) => {
    const id = createEntityId("element");
    const card = newLooseTextCard(newElementPlacement(id, clientX, clientY), text, kind);

    if (
      !createRetainedViewElement(retained.runtime.callbacks, activeCanvas.id as CanvasId, {
        type: "text-card",
        value: card,
      }).ok
    )
      return;
    animateTextCardIn(id);
    if (startEditing) textCardEdit.begin(id, card.text);
    else textCardEdit.end();
    setSelectedIds([]);
    closeContextMenus();
    rename.end();
    return id;
  };

  const createTextCard = (clientX: number, clientY: number) => {
    createLooseTextCard(clientX, clientY, "Text card");
  };

  const createMindmap = (clientX: number, clientY: number) => {
    createLooseTextCard(clientX, clientY, "Mindmap", "mindmap");
  };

  const createTextBlock = (clientX: number, clientY: number) => {
    const id = createEntityId("element");
    const element = newTextBlock(newElementPlacement(id, clientX, clientY), textBlocks.length);

    if (
      !createRetainedViewElement(retained.runtime.callbacks, activeCanvas.id as CanvasId, {
        type: "text-block",
        value: element,
      }).ok
    )
      return;
    setSelectedIds([id]);
    animateTextBlockIn(id);
    rename.begin(id, element.name);
    closeContextMenus();
    textCardEdit.end();
    textBlockEdit.end();
  };

  const createTextCardInContainer = (containerId: string, clientX: number, clientY: number) => {
    const container = containersById.get(containerId);
    if (!container) {
      return;
    }

    const point = canvasPointFromEvent({ clientX, clientY });
    const id = createEntityId("element");
    const order = getTextCardDropIndex(container, point, textCards, id);
    const card: TextCardElement = {
      id,
      text: "Text card",
      x: container.x + CONTAINER_TEXT_CARD_PADDING,
      y:
        getContainerCardStackTop(container) +
        order * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
      accent: defaultElementColors.textCard,
      ...(container.extensions?.inheritCardColor ? { accent: container.accent } : {}),
      ...(container.extensions?.autoCheckbox
        ? { extensions: { checkbox: { checked: false } } }
        : {}),
      containerId,
      order,
    };
    const cardsOutsideContainer = textCards.filter(
      (currentCard) => currentCard.containerId !== containerId,
    );
    const containerCards = getOrderedContainerTextCards(containerId);
    containerCards.splice(order, 0, card);
    const nextCards = normalizeTextCardOrders([
      ...cardsOutsideContainer,
      ...containerCards.map((currentCard, index) => ({ ...currentCard, order: index })),
    ]);
    const visibleIndex = getContainerVisibleTextCards(container, nextCards).findIndex(
      (currentCard) => currentCard.id === id,
    );

    const result = retained.runtime.callbacks
      .captureNewContainerCard(containerId as ElementId, order)
      ?.complete({
        id: id as ElementId,
        geometry: { x: card.x, y: card.y, width: 1, height: 1 },
        data: { text: card.text, accent: defaultElementColors.textCard, link: null },
        checkboxInstallationId:
          container.extensions?.autoCheckbox !== undefined
            ? (createEntityId(
                "extension-instance",
              ) as import("./domain/ids/entityIds").ExtensionInstanceId)
            : null,
      });
    if (!result?.ok) return;
    if (visibleIndex >= 0) {
      setContainerScrollOffsets((current) => ({
        ...current,
        [containerId]: getScrollOffsetForVisibleCardIndex(container, visibleIndex, nextCards),
      }));
    }
    animateTextCardIn(id);
    textCardEdit.begin(id, card.text);
    setSelectedIds([]);
    closeContextMenus();
    rename.end();
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.target !== worldRef.current) {
      return;
    }

    menus.openCanvas(event.clientX, event.clientY);
  };

  const openContainerContentMenu = (
    event: React.MouseEvent<HTMLElement>,
    element: ContainerElement,
  ) => menus.openContainerContent(event, element.id);

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
      saveRename();
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
    const position = getTextCardStackPosition(card);
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

  const openImageMenu = (event: React.MouseEvent<HTMLElement>, image: ImageElement) =>
    menus.openAtPointer("image", event, image.id);

  const openTextCardMenu = (event: React.MouseEvent<HTMLElement>, id: string) =>
    menus.openAtPointer("textCard", event, id);

  const startTextCardEdit = (card: TextCardElement) => {
    textCardEdit.begin(card.id, card.text);
    closeContextMenus();
  };

  const saveTextCardEdit = (id: string) => {
    textCardEdit.complete();
    pulseTextCard(id);
  };

  const cancelTextCardEdit = () => {
    if (editingTextCardId) {
      pulseTextCard(editingTextCardId);
    }
    textCardEdit.end();
  };

  const updateTextCardLink = (id: string, link: string) => {
    captureRetainedLinkEdit(retained.runtime.callbacks, id as ElementId)?.complete(link);
  };

  const openMindmapConnectionMenu = (event: PointerEvent<SVGPathElement>, connectionId: string) =>
    menus.openConnection(event, connectionId);

  const openTextBlockMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    element: TextBlockElement,
  ) => menus.toggleBeside("textBlock", event, element.id);

  const startTextBlockEdit = (element: TextBlockElement) => {
    textBlockEdit.begin(element.id, element.text);
    setSelectedIds([element.id]);
    rename.end();
    closeContextMenus();
  };

  const saveTextBlockEdit = (id: string) => {
    textBlockEdit.complete();
    pulseTextBlock(id);
  };

  const cancelTextBlockEdit = () => {
    if (editingTextBlockId) {
      pulseTextBlock(editingTextBlockId);
    }
    textBlockEdit.end();
  };

  const updateTextBlockHeaderButtonsVisible = (id: string, visible: boolean) => {
    completeRetainedContent(id, { headerButtonsVisible: visible });
  };

  const toggleMenu = (event: React.MouseEvent<HTMLButtonElement>, element: ContainerElement) =>
    menus.toggleBeside("container", event, element.id);

  const startRename = (element: ContainerElement | TextBlockElement) => {
    rename.begin(element.id, element.name);
    closeContextMenus();
  };

  const saveRename = () => {
    rename.complete();
    closeContextMenus();
  };

  const cancelRename = () => {
    rename.end();
  };

  const getTextCardCopyPosition = (card: TextCardElement) => {
    const position = getTextCardRenderPosition(card) ?? getTextCardStackPosition(card);
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
      return container ? getTextCardDropIndex(container, point, textCards, "") : undefined;
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

  const requestClearCanvas = () => {
    closeContextMenus();
    setClearModalOpen(true);
  };

  const clearCanvas = () => {
    const result = retained.runtime.callbacks
      .captureRemoveCanvas(activeCanvas.id as CanvasId, "clear")
      ?.complete(true);
    if (!result?.ok) return;
    closeContextMenus();
    setSelectedIds([]);
    rename.end();
    textCardEdit.end();
    textBlockEdit.end();
    setClearModalOpen(false);
  };

  const updateContainerHeaderButtonsVisible = (id: string, visible: boolean) => {
    completeRetainedContent(id, { headerButtonsVisible: visible });
  };

  const getContextActionIds = (id: string) => [...contextActionIds(selectedIds, id)];

  const isMultiContextAction = (id: string) => selectedIds.length > 1 && selectedIds.includes(id);

  /** Extensions installed on any of a context menu's targets. */
  const getContextInstalledExtensions = (id: string): ReadonlySet<RetainedExtensionKey> => {
    const installed = new Set<RetainedExtensionKey>();
    for (const targetId of getContextActionIds(id)) {
      const extensions = (
        containersById.get(targetId) ??
        textBlocksById.get(targetId) ??
        textCardsById.get(targetId) ??
        imagesById.get(targetId)
      )?.extensions;
      for (const [key, state] of Object.entries(extensions ?? {}))
        if (state) installed.add(key as RetainedExtensionKey);
    }
    return installed;
  };

  const updateContextAccent = (id: string, accent: string) =>
    extensionCommands.updateSelectionAccent(id, accent);

  const deleteContextSelection = (id: string, actionIdsOverride?: string[]) => {
    const actionIds = actionIdsOverride ?? getContextActionIds(id);
    deleteCanvasSelection(actionIds);
    closeContextMenus();
    rename.end();
  };

  const installExtensions = (extensionId: RetainedExtensionKey, ids: string[]) => {
    const installed = installRetainedViewExtension(
      retained.runtime.callbacks,
      retained.runtime.controller.store.getState().documentWorkspace.document,
      extensionId,
      ids,
      { nextUuid: () => crypto.randomUUID() },
    );
    if (installed) closeContextMenus();
    return installed;
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
      setContainerScrollOffsets((current) => ({ ...current, [id]: 0 }));
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
    resetContainerScroll: (ids) =>
      setContainerScrollOffsets((current) => ({
        ...current,
        ...Object.fromEntries(ids.map((id) => [id, 0])),
      })),
    closeContextMenus,
    copyPasteJson,
    openWorkflowEditor: workflowEditor.openWorkflowEditor,
    workflowRuns,
  });

  const getExtensionTargetType = (id: string): ExtensionTargetType | null => {
    if (containersById.has(id)) {
      return "container";
    }
    if (textBlocksById.has(id)) {
      return "text-block";
    }
    const textCard = textCardsById.get(id);
    if (textCard) {
      return textCard.kind === "mindmap" ? "mindmap" : "text-card";
    }
    if (imagesById.has(id)) {
      return "image";
    }
    return null;
  };

  const getExtensionRippleTarget = (id: string): ExtensionDropTarget | null => {
    const targetType = getExtensionTargetType(id);
    if (!targetType) {
      return null;
    }

    return { type: targetType, id };
  };

  const getExtensionTargetBounds = (target: ExtensionDropTarget): DropBounds | null => {
    if (target.type === "container") {
      const element = containersById.get(target.id);
      return element
        ? { left: element.x, top: element.y, width: element.width, height: element.height }
        : null;
    }

    if (target.type === "text-block") {
      const element = textBlocksById.get(target.id);
      return element
        ? { left: element.x, top: element.y, width: element.width, height: element.height }
        : null;
    }

    if (target.type === "image") {
      const image = imagesById.get(target.id);
      return image
        ? { left: image.x, top: image.y, width: image.width, height: image.height }
        : null;
    }

    const card = textCardsById.get(target.id);
    return card ? getTextCardRippleBounds(card) : null;
  };

  const applyDroppedExtension = (
    extensionId: RetainedExtensionKey,
    point: { x: number; y: number },
    target: ExtensionDropTarget,
    bounds: DropBounds,
  ) => {
    const targetIds = extensionDropTargetIds(target, selectedIds, (id) => {
      const type = getExtensionTargetType(id);
      return type !== null && isExtensionCompatible(extensionId, type);
    });
    if (!installExtensions(extensionId, targetIds)) {
      return;
    }
    if (!selectedIds.includes(target.id)) {
      setSelectedIds([target.id]);
    }

    const showDropRipples = () => {
      targetIds.forEach((targetId) => {
        const rippleTarget = targetId === target.id ? target : getExtensionRippleTarget(targetId);
        if (!rippleTarget) {
          return;
        }

        const rippleBounds =
          getExtensionTargetBounds(rippleTarget) ?? (targetId === target.id ? bounds : null);
        if (!rippleBounds) {
          return;
        }

        const ripplePoint =
          targetId === target.id
            ? point
            : {
                x: rippleBounds.left + rippleBounds.width / 2,
                y: rippleBounds.top + rippleBounds.height / 2,
              };

        dropRipples.show(ripplePoint, rippleBounds);
      });
    };

    // An adornment resizes the card, so its ripple waits for the next layout.
    if (addsCardAdornment(extensionId)) {
      window.requestAnimationFrame(showDropRipples);
    } else {
      showDropRipples();
    }
  };

  const dropExtensionOnCanvas = (
    extensionId: RetainedExtensionKey,
    clientX: number,
    clientY: number,
  ) => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const hit = findExtensionDropTarget(point, {
      images: looseImages,
      looseCards: looseTextCards,
      containers: elements,
      textBlocks,
      compatible: (type) => isExtensionCompatible(extensionId, type),
      cardBounds: getTextCardRippleBounds,
      looseCardFallbackBounds: getLooseTextCardSelectionBounds,
      containerCardSlots: (container) => {
        const visibleTop = container.y + CONTAINER_HEADER_HEIGHT + searchRowHeight(container);
        const rowSize = containerRowSize(container);
        return getContainerVisibleTextCards(container).map((card, index) => {
          const measured = getTextCardRippleBounds(card);
          const row = cardLayout.rowPosition(container, index);
          return {
            card,
            left: measured?.left ?? row.x,
            top: measured?.top ?? row.y,
            width: measured?.width ?? rowSize.width,
            height: measured?.height ?? rowSize.height,
            visibleTop,
            visibleBottom: container.y + container.height,
          };
        });
      },
    });
    if (hit) applyDroppedExtension(extensionId, point, hit.target, hit.bounds);
  };

  const resetZoom = () => {
    interactionController.resetZoom();
    showMinimap();
  };

  // While the pointer is on the minimap it stays up; leaving restarts its fade-out timer.
  const holdMinimap = (held: boolean) => {
    showMinimap();
    if (held && minimapTimeoutRef.current) {
      window.clearTimeout(minimapTimeoutRef.current);
      minimapTimeoutRef.current = null;
    }
  };

  // A pan keeps the minimap up for as long as it lasts, like pointing at it; the fade-out timer
  // starts when the pan ends.
  const panning = interactionSnapshot.activeInteraction?.kind === "pan";
  const minimapHold = useStableCallbacks({ holdMinimap });
  const wasPanning = useRef(false);
  useEffect(() => {
    if (panning === wasPanning.current) return;
    wasPanning.current = panning;
    minimapHold.holdMinimap(panning);
  }, [minimapHold, panning]);

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
    cancelPendingDeletionCommits(activeCanvas.id);
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
    modalOpen: () => settingsOpen || clearModalOpen || updateModalOpen || isModalPresenceBlocking(),
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
    deleteSelection: () => deletionActions.deleteCanvasSelection(selectedIds),
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

  const radii = useWorkspaceRadii();
  // Sleep mode: the side panel closes with the chrome islands and reopens when they wake.
  const sleptSidePanel = useRef<"canvases" | "extensions" | null>(null);
  useChromeAutoHide(
    Boolean(retained) && chromeAutoHideEnabled,
    () => {
      sleptSidePanel.current = null;
      if (canvasManagerOpen && !canvasManagerClosing) {
        sleptSidePanel.current = "canvases";
        closeCanvasManager();
      } else if (extensionsOpen && !extensionsClosing) {
        sleptSidePanel.current = "extensions";
        closeExtensionsPanel();
      }
    },
    () => {
      const panel = sleptSidePanel.current;
      sleptSidePanel.current = null;
      if (panel) switchLeftPanel(panel);
    },
    chromeAutoHideDelayMs,
  );
  // The unlock reveal ends with the Canvas Browser sliding in alongside the toolbars.
  useWorkspaceIntroArrival(() => switchLeftPanel("canvases"));
  // Locking plays the reveal in reverse; the side panel slides out with the toolbars.
  useWorkspaceIntroDeparture(() => {
    if (canvasManagerOpen && !canvasManagerClosing) closeCanvasManager();
    if (extensionsOpen && !extensionsClosing) closeExtensionsPanel();
  });
  // Saved radii drive the shared store; Settings previews slider drags there before saving.
  useLayoutEffect(() => {
    setWorkspaceRadii(chromeRadii);
  }, [chromeRadii]);

  const toggleCanvasManager = () => {
    if (canvasManagerOpen && !canvasManagerClosing) {
      closeCanvasManager();
      return;
    }

    switchLeftPanel("canvases");
  };

  const toggleExtensionsPanel = () => {
    if (extensionsOpen && !extensionsClosing) {
      closeExtensionsPanel();
      return;
    }

    switchLeftPanel("extensions");
  };

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
    cardPosition: (card) => getTextCardStackPosition(card),
    containerCardCandidates: (container) =>
      getContainerVisibleTextCards(container).flatMap((card) => {
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
    containerScrollOffsets: () => containerScrollOffsetsRef.current,
    camera: () => ({ pan: activeCanvas.pan, zoom: activeCanvas.zoom }),
    editingCardId: () => editingTextCardId,
    saveOpenEdits: () => {
      if (editingTextCardId) saveTextCardEdit(editingTextCardId);
      if (editingTextBlockId) saveTextBlockEdit(editingTextBlockId);
    },
    saveTextBlockEdit: () => {
      if (editingTextBlockId) saveTextBlockEdit(editingTextBlockId);
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
  const startMove = gestures.moveFrame;
  const startResize = gestures.resizeFrame;
  const startImageMove = gestures.moveImage;
  const startImageResize = gestures.resizeImage;
  const startContainerContentSelection = gestures.containerContentPointerDown;
  const startTextCardMove = (event: PointerEvent<HTMLElement>, id: string) => {
    const card = textCardsById.get(id);
    if (card) gestures.moveTextCard(event, card);
  };

  const canvasNodeActions = useStableCallbacks({
    cancelTextCardEdit,
    openTextCardMenu,
    rememberRecentColor,
    saveTextCardEdit,
    startTextCardMove,
  });
  const textCardActions = useMemo<TextCardActions>(
    () => ({
      onDraftChange: textCardEdit.setDraft,
      onSave: canvasNodeActions.saveTextCardEdit,
      onCancel: canvasNodeActions.cancelTextCardEdit,
      onStartMove: canvasNodeActions.startTextCardMove,
      onOpenMenu: canvasNodeActions.openTextCardMenu,
      onSizeChange: measuredCards.remember,
    }),
    [canvasNodeActions, measuredCards.remember, textCardEdit.setDraft],
  );
  const documentConnections = useRetainedDocumentConnections();
  const activeMindMapConnections = useMemo(
    () => canvasMindMapConnections(documentConnections, activeCanvas.id),
    [documentConnections, activeCanvas.id],
  );
  const withContainer = (id: string, action: (container: ContainerElement) => void) => {
    const container = containersById.get(id);
    if (container) action(container);
  };
  const containerMenuActions: ContainerMenuActions = useStableCallbacks({
    onStartRename: (id: string) => withContainer(id, startRename),
    onUpdateAccent: updateContextAccent,
    onCut: clipboard.cut,
    onCopy: clipboard.copy,
    onMoveLayer: moveCanvasLayers,
    onDelete: deleteContextSelection,
  });
  const withTextBlock = (id: string, action: (textBlock: TextBlockElement) => void) => {
    const textBlock = textBlocksById.get(id);
    if (textBlock) action(textBlock);
  };
  const textBlockMenuActions: TextBlockMenuActions = useStableCallbacks({
    onStartRename: (id: string) => withTextBlock(id, startRename),
    onUpdateAccent: updateContextAccent,
    onCut: clipboard.cut,
    onCopy: clipboard.copy,
    onMoveLayer: moveCanvasLayers,
    onDelete: deleteContextSelection,
  });
  const textBlockActions: TextBlockActions = useStableCallbacks({
    onDraftChange: textBlockEdit.setDraft,
    onSave: saveTextBlockEdit,
    onCancel: cancelTextBlockEdit,
    onRenameDraftChange: rename.setDraft,
    onSaveRename: saveRename,
    onCancelRename: cancelRename,
    onStartEdit: (id: string) => withTextBlock(id, startTextBlockEdit),
    onSelect: (id: string, additive: boolean) =>
      withTextBlock(id, (textBlock) => selectCanvasElement(textBlock, additive)),
    onStartMove: (event: PointerEvent<HTMLElement>, id: string) =>
      withTextBlock(id, (textBlock) => startMove(event, textBlock)),
    onStartResize: (event: PointerEvent<HTMLButtonElement>, id: string) =>
      withTextBlock(id, (textBlock) => startResize(event, textBlock)),
    onToggleMenu: (event: React.MouseEvent<HTMLButtonElement>, id: string) =>
      withTextBlock(id, (textBlock) => openTextBlockMenu(event, textBlock)),
    onHeaderButtonsVisibleChange: updateTextBlockHeaderButtonsVisible,
  });
  const withImage = (id: string, action: (image: ImageElement) => void) => {
    const image = imagesById.get(id);
    if (image) action(image);
  };
  const imageMenuActions: ImageMenuActions = useStableCallbacks({
    onReplace: pickImageForElement,
    onUpdateAccent: updateContextAccent,
    onToggleBackground: toggleImageBackground,
    onMoveLayer: moveCanvasLayers,
    onCut: clipboard.cut,
    onCopy: clipboard.copy,
    onDelete: deleteContextSelection,
  });
  const imageActions: ImageActions = useStableCallbacks({
    onStartMove: (event: PointerEvent<HTMLElement>, id: string) =>
      withImage(id, (image) => startImageMove(event, image)),
    onStartResize: (event: PointerEvent<HTMLButtonElement>, id: string) =>
      withImage(id, (image) => startImageResize(event, image)),
    onOpenMenu: (event: React.MouseEvent<HTMLElement>, id: string) =>
      withImage(id, (image) => openImageMenu(event, image)),
    onPick: pickImageForElement,
  });
  const containerActions: ContainerActions = useStableCallbacks({
    onRenameDraftChange: rename.setDraft,
    onSaveRename: saveRename,
    onCancelRename: cancelRename,
    onSelect: (id: string, additive: boolean) =>
      withContainer(id, (container) => selectCanvasElement(container, additive)),
    onStartMove: (event: PointerEvent<HTMLElement>, id: string) =>
      withContainer(id, (container) => startMove(event, container)),
    onStartResize: (event: PointerEvent<HTMLButtonElement>, id: string) =>
      withContainer(id, (container) => startResize(event, container)),
    onToggleMenu: (event: React.MouseEvent<HTMLButtonElement>, id: string) =>
      withContainer(id, (container) => toggleMenu(event, container)),
    onHeaderButtonsVisibleChange: updateContainerHeaderButtonsVisible,
    onOpenContentMenu: (event: React.MouseEvent<HTMLElement>, id: string) =>
      withContainer(id, (container) => openContainerContentMenu(event, container)),
    onWheelContent: (event: WheelEvent<HTMLElement>, id: string) =>
      withContainer(id, (container) => handleContainerWheel(event, container)),
    onStartContentSelection: (event: PointerEvent<HTMLElement>, id: string) =>
      withContainer(id, (container) => startContainerContentSelection(event, container)),
  });
  const withTextCard = (id: string, action: (card: TextCardElement) => void) => {
    const card = textCardsById.get(id);
    if (card) action(card);
  };
  const textCardMenuActions: TextCardMenuActions = useStableCallbacks({
    onStartEdit: (id: string) => withTextCard(id, startTextCardEdit),
    onUpdateAccent: updateContextAccent,
    onUpdateLink: updateTextCardLink,
    onCut: clipboard.cut,
    onCopy: clipboard.copy,
    onMoveLayer: moveCanvasLayers,
    onDelete: deleteContextSelection,
  });
  const editingTextCardContainerId = editingTextCardId
    ? textCardsById.get(editingTextCardId)?.containerId
    : undefined;
  const containerContentRevision = useRevisionToken([
    containerScrollOffsets,
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

  const stageWidth = stageSize.width;
  const stageHeight = stageSize.height;
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
  const cullableElements = useMemo(
    () => [
      ...layeredElements.map((element) => ({ id: element.id, geometry: element })),
      ...layeredTextBlocks.map((element) => ({ id: element.id, geometry: element })),
      ...layeredLooseTextCards.map((card) => ({
        id: card.id,
        geometry: {
          x: card.x,
          y: card.y,
          width: LOOSE_TEXT_CARD_RENDER_WIDTH,
          height: LOOSE_TEXT_CARD_RENDER_HEIGHT,
        },
      })),
      ...layeredLooseImages.map((image) => ({ id: image.id, geometry: image })),
    ],
    [layeredElements, layeredLooseImages, layeredLooseTextCards, layeredTextBlocks],
  );
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
  const canvasElementShadows: CanvasElementShadow[] = [
    ...layeredElements
      .filter((element) => !deletingIds.includes(element.id))
      .map((element) => ({
        id: element.id,
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        radius: 12,
        strength: "shell" as const,
      })),
    ...layeredTextBlocks
      .filter((element) => !deletingTextBlockIds.includes(element.id))
      .map((element) => ({
        id: element.id,
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        radius: 12,
        strength: "shell" as const,
      })),
    ...layeredLooseTextCards.flatMap((card) => {
      if (
        activeTextCardPresentation?.ids.includes(card.id) ||
        releasingTextCardIds.includes(card.id)
      ) {
        return [];
      }
      const draggingTextCard = draggedTextCardIds.includes(card.id);
      if ((card.containerId && !draggingTextCard) || deletingTextCardIds.includes(card.id)) {
        return [];
      }
      const bounds = getLooseTextCardSelectionBounds(card);
      const preview = interactionGeometryById.get(card.id);
      return [
        {
          id: card.id,
          left: preview?.x ?? card.x,
          top: preview?.y ?? card.y,
          width: preview?.width ?? bounds.width,
          height: preview?.height ?? bounds.height,
          radius: 8,
          strength: "card" as const,
        },
      ];
    }),
    ...layeredLooseImages.flatMap((image) => {
      const chromeless =
        Boolean((image as unknown as RetainedImageView).media) &&
        !loadingImageIds.includes(image.id) &&
        image.background === false;
      if (chromeless || deletingImageIds.includes(image.id)) {
        return [];
      }

      return [
        {
          id: image.id,
          left: image.x,
          top: image.y,
          width: image.width,
          height: image.height,
          radius: 12,
          strength: "card" as const,
        },
      ];
    }),
  ];
  const leftPanelOpen = canvasManagerOpen || extensionsOpen;
  const leftPanelClosing = canvasManagerClosing || extensionsClosing;
  const leftPanelActiveIndex = extensionsOpen ? 1 : 0;
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
      (orderedTextCardsByContainerId.get(container.id) ?? []).filter(
        (card) => !draggedTextCardIds.includes(card.id),
      ),
    visibleCards: (container, cards) => getContainerVisibleTextCards(container, [...cards]),
    scrollOffset: getContainerScrollOffset,
    viewportHeight: getContainerViewportHeight,
    stackTop: getContainerCardStackTop,
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
  const overlaidTextCardIds = [...(activeTextCardPresentation?.ids ?? []), ...releasingTextCardIds];

  return (
    <WorkspaceRoot
      className="taskmap-workspace-root--canvas"
      spellCheck={false}
      onContextMenu={suppressContextMenu}
      onPointerDownCapture={handleMainPointerDownCapture}
    >
      <div className="h-full">
        <section className="relative h-full overflow-hidden">
          <WorkspaceChromeLayer>
            {leftPanelOpen && (
              <Suspense fallback={null}>
                <WorkspaceSidePanel
                  ref={leftPanelRef}
                  backdropRevision={activeCanvas.id}
                  closing={leftPanelClosing}
                  label={leftPanelActiveIndex === 0 ? "Canvases panel" : "Extensions panel"}
                  radius={radii.sidePanel}
                  className="taskmap-workspace-side-panel--switching"
                >
                  <WorkspaceSidePanelContentSwitcher
                    activeIndex={leftPanelActiveIndex}
                    views={[
                      <CanvasManager
                        key="canvases"
                        active={leftPanelActiveIndex === 0}
                        canvases={canvasManagerCanvases}
                        activeCanvasId={activeCanvas.id}
                        cycleHighlightCanvasId={canvasManagement.cycleHighlightId}
                        closing={leftPanelClosing}
                        cardRadius={radii.canvasCard}
                        previewGap={CANVAS_PREVIEW_GAP}
                        minimalView={canvasManagerMinimalView}
                        sharedPanel
                        viewportWidth={stageWidth}
                        viewportHeight={stageHeight}
                        controller={interactionController}
                        onMinimalViewChange={setCanvasManagerMinimalView}
                        onCreateCanvas={canvasManagement.create}
                        onSelectCanvas={canvasManagement.select}
                        onUpdateCanvas={canvasManagement.update}
                        onDeleteCanvas={canvasManagement.remove}
                        onReorderCanvases={canvasManagement.reorder}
                      />,
                      <ExtensionsPanel
                        key="extensions"
                        active={leftPanelActiveIndex === 1}
                        closing={leftPanelClosing}
                        panelRef={leftPanelRef}
                        cardRadius={radii.extensionCard}
                        sharedPanel
                        onDropExtension={dropExtensionOnCanvas}
                      />,
                    ]}
                  />
                </WorkspaceSidePanel>
              </Suspense>
            )}
            {minimapEnabled && minimapMounted && (
              <Minimap
                controller={interactionController}
                elements={elements}
                textBlocks={textBlocks}
                textCards={looseTextCards}
                images={looseImages}
                mindmapConnections={mindmapConnections}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                visible={minimapVisible}
                zoom={legacyZoom}
                viewportWorld={minimapViewportWorld}
                onResetZoom={resetZoom}
                onHoldChange={holdMinimap}
              />
            )}
            <FloatingToolbar
              canRedo={historyState.canRedo}
              canUndo={historyState.canUndo}
              canvasesOpen={canvasManagerOpen && !canvasManagerClosing}
              extensionsOpen={extensionsOpen && !extensionsClosing}
              minimapEnabled={minimapEnabled}
              privacyModeEnabled={privacyModeEnabled}
              sleepModeEnabled={chromeAutoHideEnabled}
              onSleepModeEnabledChange={setChromeAutoHideEnabled}
              toolbarRadius={radii.chrome}
              onMinimapEnabledChange={setMinimapEnabled}
              onPrivacyModeEnabledChange={setPrivacyModeEnabled}
              onRedo={redo}
              onToggleExtensions={toggleExtensionsPanel}
              onToggleCanvases={toggleCanvasManager}
              onUndo={undo}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </WorkspaceChromeLayer>
          {import.meta.env.DEV && fpsCounterVisible && DevelopmentFpsCounter && (
            <Suspense fallback={null}>
              <DevelopmentFpsCounter />
            </Suspense>
          )}
          {quickExtensionsMenu && (
            <Suspense fallback={null}>
              <QuickExtensionsMenu
                left={quickExtensionsMenu.left}
                top={quickExtensionsMenu.top}
                majorRadius={radii.quickExtensions}
                minorRadius={radii.quickExtensionsCard}
                onClose={() => setQuickExtensionsMenu(null)}
                onDropExtension={dropExtensionOnCanvas}
              />
            </Suspense>
          )}
          <WorkspaceBackdropLayer
            ref={stageRef}
            data-stage
            className={
              interactionSnapshot.activeInteraction?.kind === "pan" ||
              interactionSnapshot.activeInteraction?.kind === "move"
                ? "cursor-grabbing"
                : "cursor-default"
            }
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
              data-grid-style={canvasGridStyle}
              data-image-url-version={imageUrlVersion}
              style={
                {
                  "--taskmap-canvas-grid-opacity": canvasGridOpacity[canvasGridStyle] / 100,
                  "--taskmap-canvas-dot-size":
                    "calc(1.25px * var(--taskmap-camera-inverse-zoom, 1))",
                  width: canvasWidth,
                  height: canvasHeight,
                  transform: "var(--taskmap-camera-transform)",
                  transformOrigin: "0 0",
                } as React.CSSProperties
              }
              onContextMenu={handleCanvasContextMenu}
              onPointerDown={gestures.worldPointerDown}
            >
              {snapGuides.map((guide) => (
                <div
                  key={`${guide.axis}-${guide.position}`}
                  className="pointer-events-none absolute z-0"
                  style={
                    guide.axis === "x"
                      ? {
                          left: guide.position,
                          top: 0,
                          width: "calc(2px * var(--taskmap-camera-inverse-zoom, 1))",
                          height: canvasHeight,
                          transform: "translateX(-50%)",
                          backgroundImage:
                            "repeating-linear-gradient(to bottom, rgba(45, 216, 200, 0.48) 0 6px, transparent 6px 13px)",
                          maskImage: `linear-gradient(to bottom, transparent 0, black ${Math.max(
                            guide.pointerPosition - 260,
                            0,
                          )}px, black ${Math.min(guide.pointerPosition + 260, canvasHeight)}px, transparent 100%)`,
                          WebkitMaskImage: `linear-gradient(to bottom, transparent 0, black ${Math.max(
                            guide.pointerPosition - 260,
                            0,
                          )}px, black ${Math.min(guide.pointerPosition + 260, canvasHeight)}px, transparent 100%)`,
                        }
                      : {
                          left: 0,
                          top: guide.position,
                          width: canvasWidth,
                          height: "calc(2px * var(--taskmap-camera-inverse-zoom, 1))",
                          transform: "translateY(-50%)",
                          backgroundImage:
                            "repeating-linear-gradient(to right, rgba(45, 216, 200, 0.48) 0 6px, transparent 6px 13px)",
                          maskImage: `linear-gradient(to right, transparent 0, black ${Math.max(
                            guide.pointerPosition - 260,
                            0,
                          )}px, black ${Math.min(guide.pointerPosition + 260, canvasWidth)}px, transparent 100%)`,
                          WebkitMaskImage: `linear-gradient(to right, transparent 0, black ${Math.max(
                            guide.pointerPosition - 260,
                            0,
                          )}px, black ${Math.min(guide.pointerPosition + 260, canvasWidth)}px, transparent 100%)`,
                        }
                  }
                />
              ))}
              <ExtensionDropRipples ripples={dropRipples.ripples} />
              <MindMapConnections
                connections={activeMindMapConnections}
                connectableBoundsById={connectableBoundsById}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                connectionMode={connectionDrawing.mode}
                preview={connectionDrawing.draft}
                onConnectionClick={openMindmapConnectionMenu}
              />
              <LegacyCanvasVisibility
                controller={interactionController}
                elements={cullableElements}
                pinnedIds={pinnedRenderIds}
              >
                {(visibleRenderIds) => (
                  <>
                    {shadowsUnderElements && (
                      <ElementShadowLayer
                        shadows={canvasElementShadows}
                        draggedIds={dragPinnedIds}
                        visibleIds={visibleRenderIds}
                      />
                    )}
                    <ContainerLayer
                      elements={layeredElements}
                      visibleIds={visibleRenderIds}
                      presentation={elementPresentation}
                      layout={containerCardLayout}
                      actions={containerActions}
                      cardActions={textCardActions}
                      extensionCommands={extensionCommands}
                    />
                    <TextBlockLayer
                      elements={layeredTextBlocks}
                      visibleIds={visibleRenderIds}
                      presentation={elementPresentation}
                      actions={textBlockActions}
                      extensionCommands={extensionCommands}
                    />
                    <LooseTextCardLayer
                      elements={layeredLooseTextCards}
                      visibleIds={visibleRenderIds}
                      presentation={elementPresentation}
                      hiddenIds={overlaidTextCardIds}
                      positionOf={getTextCardRenderPosition}
                      actions={textCardActions}
                      extensionCommands={extensionCommands}
                    />
                    <ImageLayer
                      elements={layeredLooseImages}
                      visibleIds={visibleRenderIds}
                      presentation={elementPresentation}
                      actions={imageActions}
                      leases={retained.runtime.media}
                    />
                  </>
                )}
              </LegacyCanvasVisibility>
            </CanvasFrame>
            <RetainedCanvasOverlays
              canvasSize={{ width: canvasWidth, height: canvasHeight }}
              contentInset={CANVAS_CONTENT_INSET}
              heldCards={activeTextCardPresentation}
              releasedCards={textCardInteractionSnapshot.release}
              cardById={(id) => textCardsById.get(id)}
              outlinedIds={outlinedIds}
              shadowsUnderElements={shadowsUnderElements}
              cardActions={textCardActions}
              extensionCommands={extensionCommands}
              connectionPorts={
                connectionDrawing.mode
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
                  : null
              }
            />
            {selectionBounds && (
              <div
                ref={selectionRef}
                className="pointer-events-none absolute z-30 rounded-md border border-dashed border-[#2dd8c8]/80 bg-[#2dd8c8]/[0.10] shadow-[0_0_0_1px_rgba(0,0,0,0.22)]"
              />
            )}
          </WorkspaceBackdropLayer>

          <RetainedCanvasMenus
            containerMenus={menus.pairs.container}
            textCardMenus={menus.pairs.textCard}
            textBlockMenus={menus.pairs.textBlock}
            imageMenus={menus.pairs.image}
            containerContentMenus={menus.pairs.containerContent}
            canvasMenus={menus.pairs.canvas}
            connectionMenu={
              menus.connection && mindmapConnectionsById.has(menus.connection.id)
                ? menus.connection
                : null
            }
            elementOf={(id) =>
              containersById.get(id) ??
              textCardsById.get(id) ??
              textBlocksById.get(id) ??
              imagesById.get(id)
            }
            isMultiTarget={isMultiContextAction}
            installedOnTargets={getContextInstalledExtensions}
            extensionCommands={extensionCommands}
            recentColors={recentColors}
            containerActions={containerMenuActions}
            textCardActions={textCardMenuActions}
            textBlockActions={textBlockMenuActions}
            imageActions={imageMenuActions}
            hasCopiedItem={clipboard.hasCopy}
            onPaste={clipboard.paste}
            onCreateTextCardInContainer={createTextCardInContainer}
            canvasActions={{
              onCreateContainer: createContainer,
              onCreateTextCard: createTextCard,
              onCreateTextBlock: createTextBlock,
              onCreateImage: createImageFromMenu,
              onCreateMindmap: createMindmap,
              onClear: requestClearCanvas,
            }}
            onDeleteConnection={removeMindmapConnection}
          />

          <ModalPresence open={clearModalOpen}>
            <Suspense fallback={null}>
              <ClearCanvasModal onCancel={() => setClearModalOpen(false)} onConfirm={clearCanvas} />
            </Suspense>
          </ModalPresence>

          {copyPasteJson.editorWindow}
          {workflowEditor.editorWindow}
          {workflowRuns.reviewDialog}

          <ModalPresence
            open={settingsOpen}
            onDismiss={() => {
              gridOpacityEdit?.cancel();
              setSettingsOpen(false);
            }}
          >
            <Suspense fallback={null}>
              <SettingsModal
                databaseActions={{
                  lock: async () => {
                    // The animation plays before the lock: locking purges the document,
                    // so afterwards there would be no canvas left to animate.
                    setSettingsOpen(false);
                    await beginWorkspaceOutro();
                    const locked = (await retained.runtime.controller.lock()).ok;
                    if (!locked) cancelWorkspaceOutro();
                    return locked;
                  },
                  close: async () => (await retained.runtime.controller.close()).ok,
                  quit: async () => (await retained.runtime.controller.quit()).ok,
                  closeToTray,
                  onCloseToTrayChange: setCloseToTray,
                  trayLockMinutes,
                  onTrayLockMinutesChange: setTrayLockMinutes,
                }}
                gridOpacityEdit={gridOpacityEdit}
                canvasGridStyle={canvasGridStyle}
                onCanvasGridStyleChange={setCanvasGridStyle}
                canvasGridOpacity={canvasGridOpacity[canvasGridStyle]}
                onCanvasGridOpacityChange={(opacity) =>
                  setCanvasGridOpacity((current) => ({
                    ...current,
                    [canvasGridStyle]: opacity,
                  }))
                }
                defaultElementColors={defaultElementColors}
                onDefaultElementColorChange={(elementType, color) =>
                  setDefaultElementColors((current) => ({ ...current, [elementType]: color }))
                }
                recentColors={recentColors}
                onRememberRecentColor={canvasNodeActions.rememberRecentColor}
                shadowsUnderElements={shadowsUnderElements}
                onShadowsUnderElementsChange={setShadowsUnderElements}
                allowLockedElementDeletion={allowLockedElementDeletion}
                onAllowLockedElementDeletionChange={setAllowLockedElementDeletion}
                availableUpdate={availableUpdate}
                appVersion={appVersion}
                fpsCounterVisible={fpsCounterVisible}
                onFpsCounterVisibleChange={setFpsCounterVisible}
                privacyModeEnabled={privacyModeEnabled}
                onPrivacyModeEnabledChange={setPrivacyModeEnabled}
                chromeRadii={chromeRadii}
                onChromeRadiusChange={(key, radius) =>
                  setChromeRadii((current) => ({ ...current, [key]: radius }))
                }
                sleepDelayMs={chromeAutoHideDelayMs}
                onSleepDelayChange={setChromeAutoHideDelayMs}
                temporaryPanelsVisible={temporaryPanelsVisible}
                onTemporaryPanelsVisibleChange={setTemporaryPanelsVisible}
                onCheckForUpdate={checkForAppUpdate}
                onInstallUpdate={installAppUpdate}
                onClose={() => {
                  gridOpacityEdit?.cancel();
                  setSettingsOpen(false);
                }}
              />
            </Suspense>
          </ModalPresence>

          <ModalPresence open={updateModalOpen && Boolean(availableUpdate) && !settingsOpen}>
            <Suspense fallback={null}>
              {availableUpdate ? (
                <UpdateAvailableModal
                  update={availableUpdate}
                  onInstall={installAppUpdate}
                  onDismiss={dismissUpdateModal}
                />
              ) : null}
            </Suspense>
          </ModalPresence>

          {settingsError && (
            <div
              role="alert"
              className="fixed bottom-4 right-4 z-50 max-w-[420px] rounded-lg border border-red-300/25 bg-[#281b1d]/95 p-3 text-sm text-red-100"
            >
              {settingsError}
            </div>
          )}

          <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </section>
      </div>
    </WorkspaceRoot>
  );
}

export default App;
