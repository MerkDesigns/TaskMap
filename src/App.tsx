import {
  CSSProperties,
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
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IconRotateClockwise } from "@tabler/icons-react";
import {
  CanvasContextMenu,
  ContainerContentContextMenu,
  ContainerContextMenu,
  ImageContextMenu,
  MindmapConnectionContextMenu,
  TextBlockContextMenu,
  TextCardContextMenu,
} from "./components/ContextMenus";
import { ContainerNode } from "./components/ContainerNode";
import { ContainerJsonEditorWindow } from "./components/ContainerJsonEditorWindow";
import { FloatingToolbar } from "./components/FloatingToolbar";
import { WindowChrome } from "./components/WindowChrome";
import type {
  FrostedGlassValues,
  LeftPanelCardValues,
  WorkspaceGeometryValues,
} from "./components/FrostedGlassTuner";
import { ExtensionDropEffect } from "./components/ExtensionDropEffect";
import { ImageNode } from "./components/ImageNode";
import { Minimap } from "./components/Minimap";
import { MindmapConnectors } from "./components/MindmapConnectors";
import { MindmapConnections } from "./components/MindmapConnections";
import { TextCardNode } from "./components/TextCardNode";
import { TextBlockNode } from "./components/TextBlockNode";
import { ToastStack } from "./components/ToastStack";
import {
  CANVAS_WIDTH,
  ALL_ACCENT_PRESETS,
  DEFAULT_ELEMENT_COLORS,
  MIN_HEIGHT,
  MIN_IMAGE_SIZE,
  MIN_WIDTH,
  getTextCardAccent,
} from "./constants";
import { clamp, getVirtualRowRange, isVirtualRowInRange } from "./canvasMath";
import {
  AppData,
  CanvasGridStyle,
  CommandRunnerCommand,
  CommandRunStatus,
  CommandStartResult,
  ContainerElement,
  ContainerMenuState,
  CopiedCanvasItem,
  DefaultElementColors,
  ElementExtensions,
  ImageElement,
  ImageMeta,
  MindmapConnection,
  MindmapPort,
  TaskCanvas,
  TextBlockElement,
  TextCardElement,
  ToastMessage,
} from "./types";
import { getMindmapPortPoint, type MindmapBounds } from "./mindmapMath";
import {
  cloneExtensions,
  getLocalDateKey,
  normalizeAppData,
  remapContainerExtensions,
} from "./app/appData";
import { commandErrorMessage, isRecoverableStorageError } from "./app/commandError";
import { planCanvasDeletion, updateCanvasDetails } from "./app/canvasDocument";
import { DEFAULT_CANVAS, DEFAULT_GRID_OPACITY, DEFAULT_PAN } from "./app/defaultData";
import { useAutosave } from "./hooks/useAutosave";
import { useDiscordRpc } from "./hooks/useDiscordRpc";
import { useImageCache } from "./hooks/useImageCache";
import { useAppUpdates } from "./hooks/useAppUpdates";
import { useCanvasDocument } from "./hooks/useCanvasDocument";
import {
  EXTENSION_COMPATIBLE_TARGETS,
  EXTENSION_CONFLICTS,
  EXTENSION_REGISTRY,
  addAutomaticCheckbox,
  type ExtensionId,
  type ExtensionTargetType,
} from "./extensions/registry";
import {
  parseCopyPasteJson,
  replaceContainerFromAiJson,
  serializeContainerForAi,
} from "./extensions/copyPasteJson";
import {
  cloneCanvas,
  createInitialCanvasHistory,
  getCanvasHistoryState,
  omitCameraFromHistory,
  pushCanvasHistorySnapshot,
} from "./app/history";
import { createCanvasInteractionController } from "./app/interactions/canvasInteractionController";
import type { CanvasInteractionController } from "./app/interactions/canvasInteractionController";
import type { InteractionElement } from "./app/interactions/canvasInteractionTypes";
import { TransientInteractionProvider } from "./app/interactions/TransientInteractionProvider";
import { useStableCanvasInteractionController } from "./app/interactions/useStableCanvasInteractionController";
import { createViewport, viewportWorldRectangle } from "./canvas/geometry/viewportMath";
import {
  rectanglesIntersect,
  type CanvasRectangle,
  type ElementGeometry,
} from "./canvas/geometry/canvasGeometry";
import {
  getVisibleElementIds,
  shouldRefreshCullingViewport,
} from "./canvas/virtualization/viewportCulling";
import { createLegacyCanvasInteractionCommitAdapter } from "./legacy/interactions/legacyCanvasInteractionCommitAdapter";
import {
  filterLegacyResizeSnapTargets,
  getLegacyInteractionElements,
} from "./legacy/interactions/legacyCanvasGeometry";
import { projectLegacyGeometry } from "./legacy/interactions/legacyCanvasGeometry";
import { createLegacyCameraSynchronization } from "./legacy/interactions/legacyCameraSynchronization";
import { applyLegacySelectionAction } from "./legacy/interactions/legacySelectionCompatibility";
import {
  createLegacyTextCardInteractionService,
  getLegacyTextCardDragIds,
} from "./legacy/interactions/legacyTextCardInteraction";
import { getLegacyTextCardDragRenderPosition } from "./legacy/interactions/legacyTextCardDragPresentation";
import { applyLegacyTextCardShiftTransition } from "./legacy/interactions/legacyTextCardModifierTransition";
import { getLegacyTextCardPreviewRowOffset } from "./legacy/interactions/legacyTextCardPlacement";
import { projectLegacyBackdropScene } from "./legacy/materials/legacyBackdropScene";
import {
  advanceLegacyBackdropSceneRevision,
  type LegacyBackdropSceneRevisionState,
} from "./legacy/materials/legacyBackdropSceneRevision";
import type { MaterialCompositorPresentationPublisher } from "./ui/materials/materialCompositorPresentation";
import {
  CanvasFrame,
  MINIMAP_VISIBILITY_DURATION_MS,
  WorkspaceBackdropLayer,
  WorkspaceChromeLayer,
  WorkspaceChromeGlassBatches,
  WorkspaceRoot,
  WorkspaceSidePanel,
  WorkspaceSidePanelContentSwitcher,
  WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS,
} from "./ui/patterns/workspace";
import { isModalPresenceBlocking, ModalPresence } from "./ui/patterns/overlays";

const CanvasManager = lazy(() =>
  import("./components/CanvasManager").then(({ CanvasManager }) => ({
    default: memo(
      CanvasManager,
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
    ),
  })),
);
const ExtensionsPanel = lazy(() =>
  import("./components/ExtensionsPanel").then(({ ExtensionsPanel }) => ({
    default: ExtensionsPanel,
  })),
);
const QuickExtensionsMenu = lazy(() =>
  import("./components/ExtensionsPanel").then(({ QuickExtensionsMenu }) => ({
    default: QuickExtensionsMenu,
  })),
);
const ClearCanvasModal = lazy(() =>
  import("./components/Modals").then(({ ClearCanvasModal }) => ({ default: ClearCanvasModal })),
);
const SettingsModal = lazy(() =>
  import("./components/Modals").then(({ SettingsModal }) => ({ default: SettingsModal })),
);
const CommandRunnerSettingsModal = lazy(() =>
  import("./components/CommandRunnerModals").then(({ CommandRunnerSettingsModal }) => ({
    default: CommandRunnerSettingsModal,
  })),
);
const ExtensionConflictModal = lazy(() =>
  import("./components/CommandRunnerModals").then(({ ExtensionConflictModal }) => ({
    default: ExtensionConflictModal,
  })),
);
const UpdateAvailableModal = lazy(() =>
  import("./components/Modals").then(({ UpdateAvailableModal }) => ({
    default: UpdateAvailableModal,
  })),
);
const DevelopmentFpsCounter = import.meta.env.DEV
  ? lazy(() =>
      import("./components/FpsCounter").then(({ FpsCounter }) => ({ default: FpsCounter })),
    )
  : null;
const DevelopmentFrostedGlassTuner = import.meta.env.DEV
  ? lazy(() =>
      import("./components/FrostedGlassTuner").then(({ FrostedGlassTuner }) => ({
        default: FrostedGlassTuner,
      })),
    )
  : null;

type ExtensionDropRipple = {
  id: string;
  extensionId: ExtensionId;
  target:
    | { type: "container"; id: string }
    | { type: "text-block"; id: string }
    | { type: "text-card"; id: string }
    | { type: "mindmap"; id: string }
    | { type: "image"; id: string };
  offsetX: number;
  offsetY: number;
  bounds: ExtensionRippleBounds;
};

type ExtensionRippleBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomRightRadius?: number;
  borderBottomLeftRadius?: number;
};

type LeftPanelState = "closed" | "canvases" | "extensions";

type PendingCanvasDeletions = {
  containers: Set<string>;
  textCards: Set<string>;
  textBlocks: Set<string>;
  images: Set<string>;
};

type MindmapConnectionDrag = {
  pointerId: number;
  sourceId: string;
  sourcePort: MindmapPort;
  source: { x: number; y: number };
  target: { x: number; y: number };
  targetId?: string;
  targetPort?: MindmapPort;
};

type MeasuredTextCardSize = {
  canvasId: string;
  width: number;
  height: number;
};

type StorageErrorState = {
  message: string;
  canReset: boolean;
};

type PendingExtensionConflict = {
  extensionId: ExtensionId;
  targetIds: string[];
  conflictIds: ExtensionId[];
  affectedCount: number;
};

const createStorageError = (prefix: string, error: unknown): StorageErrorState => ({
  message: `${prefix}: ${commandErrorMessage(error)}`,
  canReset: isRecoverableStorageError(error),
});

const createEntityId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const CANVAS_MANAGER_ANIMATION_MS = WORKSPACE_SIDE_PANEL_SLIDE_DURATION_MS;
const CANVAS_CYCLE_PANEL_RESTORE_DELAY_MS = 280;
const CLEAR_HISTORY_TRANSACTION = "clear-canvas";
const DELETE_HISTORY_TRANSACTION = "delete-selection";
const imageHistoryTransaction = (imageId: string) => `image:${imageId}`;

const isEditableKeyboardTarget = (target: HTMLElement | null) =>
  target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

const isKeyboardFocusableControl = (target: HTMLElement | null) =>
  Boolean(target?.closest("button, [role='button'], a, select, [tabindex]"));
const isInteractiveKeyboardTarget = (target: HTMLElement | null) =>
  Boolean(
    target?.closest(
      "input, textarea, select, button, a[href], summary, [role='button'], [contenteditable], [tabindex]",
    ),
  );
const CONTAINER_HEADER_HEIGHT = 48;
const CONTAINER_SEARCH_HEIGHT = 42;
const CONTAINER_TEXT_CARD_PADDING = 17;
const CONTAINER_TEXT_CARD_ROW_HEIGHT = 43;
const CONTAINER_TEXT_CARD_GAP = 8;
const CONTAINER_TEXT_CARD_OVERSCAN_ROWS = 3;
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

const DEFAULT_FROSTED_GLASS_VALUES: FrostedGlassValues = {
  bgOpacity: 0,
  bgBrightness: 0,
  borderOpacity: 0.16,
  blur: 4,
  shadowOpacity: 0.55,
  shadowY: 10,
  shadowBlur: 32,
};
const DEFAULT_LEFT_PANEL_CARD_VALUES: LeftPanelCardValues = {
  bgOpacity: 1,
  outlineOpacity: 0.13,
};
const DEFAULT_WORKSPACE_GEOMETRY_VALUES: WorkspaceGeometryValues = {
  canvasBrowserRadius: 22.5,
  canvasCardRadius: 13.5,
  topBarRadius: 16,
  sideInset: 16,
  topInset: 16,
};

const getWindowPreviewViewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const createAppMetadata = (data: AppData): AppData => ({
  ...data,
  canvases: data.canvases.map((canvas) => ({
    ...canvas,
    containers: [],
    textCards: [],
    textBlocks: [],
    images: [],
    mindmapConnections: [],
  })),
});

type CallbackMap = Record<string, (...args: never[]) => unknown>;

const useStableCallbacks = <T extends CallbackMap>(callbacks: T): T => {
  const callbacksRef = useRef(callbacks);
  const stableCallbacksRef = useRef<T | null>(null);
  callbacksRef.current = callbacks;

  if (!stableCallbacksRef.current) {
    stableCallbacksRef.current = Object.fromEntries(
      Object.keys(callbacks).map((name) => [
        name,
        (...args: never[]) => callbacksRef.current[name](...args),
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
  readonly onBeforeClose?: () => Promise<void>;
  readonly materialPresentation?: MaterialCompositorPresentationPublisher;
}

function App({ onBeforeClose, materialPresentation }: AppProps = {}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const lastPointerPositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const panelSwitchTimeoutRef = useRef<number | null>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const canvasCycleRestoreTimeoutRef = useRef<number | null>(null);
  const minimapTimeoutRef = useRef<number | null>(null);
  const minimapUnmountTimeoutRef = useRef<number | null>(null);
  const canvasCycleSessionRef = useRef<{
    order: string[];
    index: number;
    previousPanelState: LeftPanelState;
  } | null>(null);
  const wheelLayerTimeoutRef = useRef<number | null>(null);
  const containerScrollOffsetsRef = useRef<Record<string, number>>({});
  const historyRef = useRef<Record<string, TaskCanvas[]>>({});
  const historyIndexRef = useRef<Record<string, number>>({});
  const historyTransactionsRef = useRef<Map<string, Set<string>>>(new Map());
  const dirtyHistoryTransactionsRef = useRef<Set<string>>(new Set());
  const applyingHistoryRef = useRef(false);
  const dirtyCanvasVersionsRef = useRef<Map<string, number>>(new Map());
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingCanvasDeletionsRef = useRef<Map<string, PendingCanvasDeletions>>(new Map());
  const pendingDeletionTimeoutsRef = useRef<Map<string, Set<number>>>(new Map());
  const activeCanvasIdRef = useRef(DEFAULT_CANVAS.id);
  const latestDataGetterRef = useRef<() => AppData>(() => latestAppDataRef.current);
  const closeInProgressRef = useRef(false);
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
    discordRpcEnabled: false,
    discordRpcShowCanvas: true,
    minimapEnabled: true,
    privacyModeEnabled: false,
    toolbarButtonsVisible: false,
  });
  const appDataLoadedRef = useRef(false);
  const [appDataLoaded, setAppDataLoaded] = useState(false);
  const {
    activeCanvas,
    canvases,
    elements,
    images,
    mindmapConnections,
    pan: legacyPan,
    setActiveCanvas,
    setCanvases,
    setCamera,
    setElements,
    setImages,
    setMindmapConnections,
    setTextBlocks,
    setTextCards,
    textBlocks,
    textCards,
    zoom: legacyZoom,
  } = useCanvasDocument();
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
  const cameraSynchronizationRef = useRef<ReturnType<
    typeof createLegacyCameraSynchronization
  > | null>(null);
  if (!cameraSynchronizationRef.current) {
    cameraSynchronizationRef.current = createLegacyCameraSynchronization({
      initialCanvasId: activeCanvas.id,
      initialCamera: { pan: legacyPan, zoom: legacyZoom },
      scheduler: {
        schedule: (callback) => window.requestAnimationFrame(callback),
        cancel: (handle) => window.cancelAnimationFrame(handle),
      },
      writeLegacyCamera: (canvasId, camera) => {
        if (interactionBindingsRef.current.activeCanvas.id === canvasId) {
          interactionBindingsRef.current.setCamera(camera.pan, camera.zoom);
        }
      },
      adoptLegacyCamera: (canvasId, camera) => {
        textCardInteractionRef.current?.reset();
        interactionControllerRef.current?.replaceCanvas(
          canvasId,
          createViewport(camera.pan, camera.zoom, interactionStageSizeRef.current),
        );
      },
    });
  }
  const cameraSynchronization = cameraSynchronizationRef.current;
  const interactionController = useStableCanvasInteractionController(() => {
    const commitPort = createLegacyCanvasInteractionCommitAdapter({
      getActiveCanvas: () => interactionBindingsRef.current.activeCanvas,
      commitActiveCanvas: (canvas) => interactionBindingsRef.current.setActiveCanvas(canvas),
      getContainerScrollOffset: (containerId) =>
        containerScrollOffsetsRef.current[containerId] ?? 0,
      getTextCardPlacementDecision: textCardInteraction.getDecision,
      onTextCardPlacementCommitted: textCardInteraction.finishCommitted,
    });
    return createCanvasInteractionController({
      canvasKey: activeCanvas.id,
      viewport: createViewport(legacyPan, legacyZoom, stageSize),
      commitPort,
      panFrameScheduler: {
        schedule: (callback) => window.requestAnimationFrame(callback),
        cancel: (handle) => window.cancelAnimationFrame(handle),
      },
      onViewportSettled: (viewport, canvasId) =>
        cameraSynchronization.queueControllerCamera(canvasId, viewport),
    });
  });
  interactionControllerRef.current = interactionController;
  const interactionSnapshot = useSyncExternalStore(
    interactionController.subscribe,
    interactionController.getSnapshot,
    interactionController.getSnapshot,
  );
  const textCardInteractionSnapshot = useSyncExternalStore(
    textCardInteraction.subscribe,
    textCardInteraction.getSnapshot,
    textCardInteraction.getSnapshot,
  );
  const { pan, zoom } = interactionSnapshot.viewport;
  useLayoutEffect(() => {
    cameraSynchronization.observeLegacyCamera(activeCanvas.id, {
      pan: activeCanvas.pan,
      zoom: activeCanvas.zoom,
    });
  }, [activeCanvas, cameraSynchronization]);
  useEffect(() => {
    interactionController.resizeViewport(stageSize);
  }, [interactionController, stageSize]);
  const latestCameraRef = useRef({ pan: DEFAULT_PAN, zoom: 1 });
  const canvasManagerCanvasesRef = useRef<TaskCanvas[] | null>(null);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [minimapMounted, setMinimapMounted] = useState(false);
  const selectedIds = interactionSnapshot.selectedIds as string[];
  const setSelectedIds = (value: SetStateAction<string[]>) => {
    applyLegacySelectionAction(interactionController, value);
  };
  const [containerMenu, setContainerMenu] = useState<ContainerMenuState | null>(null);
  const [closingContainerMenu, setClosingContainerMenu] = useState<ContainerMenuState | null>(null);
  const [containerContentMenu, setContainerContentMenu] = useState<{
    containerId: string;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [closingContainerContentMenu, setClosingContainerContentMenu] = useState<{
    containerId: string;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [textCardMenu, setTextCardMenu] = useState<{
    id: string;
    left: number;
    top: number;
  } | null>(null);
  const [closingTextCardMenu, setClosingTextCardMenu] = useState<{
    id: string;
    left: number;
    top: number;
  } | null>(null);
  const [textBlockMenu, setTextBlockMenu] = useState<{
    id: string;
    left: number;
    top: number;
  } | null>(null);
  const [closingTextBlockMenu, setClosingTextBlockMenu] = useState<{
    id: string;
    left: number;
    top: number;
  } | null>(null);
  const [imageMenu, setImageMenu] = useState<{ id: string; left: number; top: number } | null>(
    null,
  );
  const [closingImageMenu, setClosingImageMenu] = useState<{
    id: string;
    left: number;
    top: number;
  } | null>(null);
  const [mindmapConnectionMenu, setMindmapConnectionMenu] = useState<{
    id: string;
    left: number;
    top: number;
  } | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<{ clientX: number; clientY: number } | null>(null);
  const [closingCanvasMenu, setClosingCanvasMenu] = useState<{
    clientX: number;
    clientY: number;
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [editingTextCardId, setEditingTextCardId] = useState<string | null>(null);
  const [textCardDraft, setTextCardDraft] = useState("");
  const [editingTextBlockId, setEditingTextBlockId] = useState<string | null>(null);
  const [textBlockDraft, setTextBlockDraft] = useState("");
  const [mindmapConnectionMode, setMindmapConnectionMode] = useState(false);
  const [mindmapConnectionDrag, setMindmapConnectionDrag] = useState<MindmapConnectionDrag | null>(
    null,
  );
  const [measuredTextCardSizes, setMeasuredTextCardSizes] = useState<
    Record<string, MeasuredTextCardSize>
  >({});
  const [copiedItem, setCopiedItem] = useState<CopiedCanvasItem | null>(null);
  const [containerJsonEditor, setContainerJsonEditor] = useState<{
    containerId: string;
    initialJson: string;
  } | null>(null);
  const [canvasGridStyle, setCanvasGridStyle] = useState<CanvasGridStyle>("dots");
  const [canvasGridOpacity, setCanvasGridOpacity] =
    useState<Record<CanvasGridStyle, number>>(DEFAULT_GRID_OPACITY);
  const [defaultElementColors, setDefaultElementColors] =
    useState<DefaultElementColors>(DEFAULT_ELEMENT_COLORS);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [shadowsUnderElements, setShadowsUnderElements] = useState(false);
  const [allowLockedElementDeletion, setAllowLockedElementDeletion] = useState(true);
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(false);
  const [discordRpcShowCanvas, setDiscordRpcShowCanvas] = useState(true);
  const [minimapEnabled, setMinimapEnabled] = useState(true);
  const [privacyModeEnabled, setPrivacyModeEnabled] = useState(false);
  const [toolbarButtonsVisible, setToolbarButtonsVisible] = useState(false);
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string | undefined>(
    undefined,
  );
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandRunnerEditorCardId, setCommandRunnerEditorCardId] = useState<string | null>(null);
  const [pendingExtensionConflict, setPendingExtensionConflict] =
    useState<PendingExtensionConflict | null>(null);
  const [runningCommandRuns, setRunningCommandRuns] = useState<Record<string, string[]>>({});
  const [fpsCounterVisible, setFpsCounterVisible] = useState(false);
  const [temporaryPanelsVisible, setTemporaryPanelsVisible] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [canvasManagerOpen, setCanvasManagerOpen] = useState(false);
  const [canvasManagerClosing, setCanvasManagerClosing] = useState(false);
  const [canvasManagerMinimalView, setCanvasManagerMinimalView] = useState(false);
  const [canvasCycleHighlightId, setCanvasCycleHighlightId] = useState<string | null>(null);
  const [extensionsOpen, setExtensionsOpen] = useState(false);
  const [extensionsClosing, setExtensionsClosing] = useState(false);
  const [quickExtensionsMenu, setQuickExtensionsMenu] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [frostedGlassValues, setFrostedGlassValues] = useState(DEFAULT_FROSTED_GLASS_VALUES);
  const [leftPanelCardValues, setLeftPanelCardValues] = useState(DEFAULT_LEFT_PANEL_CARD_VALUES);
  const [workspaceGeometryValues, setWorkspaceGeometryValues] = useState(
    DEFAULT_WORKSPACE_GEOMETRY_VALUES,
  );
  const [storageError, setStorageError] = useState<StorageErrorState | null>(null);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [enteringTextCardIds, setEnteringTextCardIds] = useState<string[]>([]);
  const [deletingTextCardIds, setDeletingTextCardIds] = useState<string[]>([]);
  const [pulsingTextCardIds, setPulsingTextCardIds] = useState<string[]>([]);
  const [glowingTextCardIds, setGlowingTextCardIds] = useState<string[]>([]);
  const [enteringImageIds, setEnteringImageIds] = useState<string[]>([]);
  const [deletingImageIds, setDeletingImageIds] = useState<string[]>([]);
  const [loadingImageIds, setLoadingImageIds] = useState<string[]>([]);
  const [enteringTextBlockIds, setEnteringTextBlockIds] = useState<string[]>([]);
  const [deletingTextBlockIds, setDeletingTextBlockIds] = useState<string[]>([]);
  const [pulsingTextBlockIds, setPulsingTextBlockIds] = useState<string[]>([]);
  const snapGuides = interactionSnapshot.snapGuides;
  const [extensionDropRipples, setExtensionDropRipples] = useState<ExtensionDropRipple[]>([]);

  const rememberTextCardSize = useCallback(
    (id: string, size: { width: number; height: number }) => {
      const canvasId = activeCanvasIdRef.current;
      setMeasuredTextCardSizes((current) => {
        const previous = current[id];
        if (
          previous?.canvasId === canvasId &&
          previous.width === size.width &&
          previous.height === size.height
        ) {
          return current;
        }
        return { ...current, [id]: { canvasId, ...size } };
      });
    },
    [],
  );

  useEffect(() => {
    const resetDailyCheckboxes = () => {
      const today = getLocalDateKey();
      const dueContainerIds = elements
        .filter(
          (element) =>
            element.extensions?.dailyReset && element.extensions.dailyReset.lastResetDate !== today,
        )
        .map((element) => element.id);
      if (dueContainerIds.length === 0) {
        return;
      }

      const dueContainerIdSet = new Set(dueContainerIds);
      setElements((current) =>
        current.map((element) =>
          dueContainerIdSet.has(element.id) && element.extensions?.dailyReset
            ? {
                ...element,
                extensions: {
                  ...element.extensions,
                  dailyReset: { lastResetDate: today },
                },
              }
            : element,
        ),
      );
      setTextCards((current) =>
        current.map((card) =>
          card.containerId &&
          dueContainerIdSet.has(card.containerId) &&
          card.extensions?.checkbox?.checked
            ? {
                ...card,
                extensions: {
                  ...card.extensions,
                  checkbox: { checked: false },
                },
              }
            : card,
        ),
      );
    };

    resetDailyCheckboxes();
    const interval = window.setInterval(resetDailyCheckboxes, 60_000);
    return () => window.clearInterval(interval);
  }, [elements, setElements, setTextCards]);
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

  useEffect(() => {
    const handleConnectionKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.code !== "KeyC" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isEditableKeyboardTarget(target) ||
        isKeyboardFocusableControl(target) ||
        settingsOpen ||
        clearModalOpen ||
        isModalPresenceBlocking() ||
        Boolean(pendingExtensionConflict)
      ) {
        return;
      }
      event.preventDefault();
      setMindmapConnectionMode(true);
    };
    const stopConnectionMode = (event?: KeyboardEvent) => {
      if (event && event.code !== "KeyC") return;
      setMindmapConnectionMode(false);
      setMindmapConnectionDrag(null);
    };
    const handleBlur = () => stopConnectionMode();
    window.addEventListener("keydown", handleConnectionKeyDown, true);
    window.addEventListener("keyup", stopConnectionMode, true);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleConnectionKeyDown, true);
      window.removeEventListener("keyup", stopConnectionMode, true);
      window.removeEventListener("blur", handleBlur);
    };
  }, [clearModalOpen, pendingExtensionConflict, settingsOpen]);

  useEffect(
    () => () => {
      cameraSynchronization.cancelPending();
      textCardInteraction.cancelScheduledPresentation();
      if (wheelLayerTimeoutRef.current !== null) {
        window.clearTimeout(wheelLayerTimeoutRef.current);
      }
    },
    [cameraSynchronization, textCardInteraction],
  );

  useEffect(() => {
    const handleShiftDown = (event: KeyboardEvent) => {
      if (event.key !== "Shift" || event.repeat) return;
      applyLegacyTextCardShiftTransition(interactionController, textCardInteraction, true);
    };
    const handleShiftUp = (event: KeyboardEvent) => {
      if (event.key !== "Shift") return;
      applyLegacyTextCardShiftTransition(interactionController, textCardInteraction, false);
    };
    window.addEventListener("keydown", handleShiftDown, true);
    window.addEventListener("keyup", handleShiftUp, true);
    return () => {
      window.removeEventListener("keydown", handleShiftDown, true);
      window.removeEventListener("keyup", handleShiftUp, true);
    };
  }, [interactionController, textCardInteraction]);

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
  const orderedTextCardsByContainerId = useMemo(() => {
    const grouped = new Map<string, TextCardElement[]>();

    textCards.forEach((card) => {
      if (!card.containerId) {
        return;
      }

      const containerCards = grouped.get(card.containerId) ?? [];
      containerCards.push(card);
      grouped.set(card.containerId, containerCards);
    });

    grouped.forEach((containerCards) => {
      containerCards.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    });

    return grouped;
  }, [textCards]);
  const looseTextCards = useMemo(() => textCards.filter((card) => !card.containerId), [textCards]);
  const imagesById = useMemo(() => new Map(images.map((image) => [image.id, image])), [images]);
  const mindmapConnectionsById = useMemo(
    () => new Map(mindmapConnections.map((connection) => [connection.id, connection])),
    [mindmapConnections],
  );
  const looseImages = useMemo(() => images.filter((image) => !image.containerId), [images]);
  const measuredInteractionCardSizes = useMemo(
    () =>
      new Map(
        Object.entries(measuredTextCardSizes).flatMap(([id, size]) =>
          size.canvasId === activeCanvas.id ? [[id, size] as const] : [],
        ),
      ),
    [activeCanvas.id, measuredTextCardSizes],
  );
  const interactionElements = useMemo(
    () => getLegacyInteractionElements(activeCanvas, measuredInteractionCardSizes),
    [activeCanvas, measuredInteractionCardSizes],
  );
  const isElementLocked = (id: string) =>
    Boolean(
      (
        containersById.get(id) ??
        textBlocksById.get(id) ??
        textCardsById.get(id) ??
        imagesById.get(id)
      )?.extensions?.lock?.enabled,
    );
  const isConnectableElement = (id: string) =>
    containersById.has(id) ||
    textBlocksById.has(id) ||
    imagesById.has(id) ||
    textCardsById.get(id)?.kind === "mindmap";
  const isElementDeletionLocked = (id: string) =>
    !allowLockedElementDeletion &&
    (isElementLocked(id) ||
      (containersById.has(id) &&
        (textCards.some((card) => card.containerId === id && isElementLocked(card.id)) ||
          images.some((image) => image.containerId === id && isElementLocked(image.id)))));
  const draggedTextCardIds =
    interactionSnapshot.activeInteraction?.kind === "move"
      ? interactionSnapshot.activeInteraction.targetIds.filter((id) => textCardsById.has(id))
      : EMPTY_IDS;
  const activeTextCardPresentation = textCardInteractionSnapshot.active;
  const releasingTextCardIds =
    textCardInteractionSnapshot.release?.cards.map(({ card }) => card.id) ?? EMPTY_IDS;
  const renderedLooseTextCards = looseTextCards;

  const dismissToast = useCallback((id: string) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)),
    );
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 260);
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, "id"> & { duration?: number }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const nextToast = {
        id,
        tone: toast.tone,
        title: toast.title,
        message: toast.message,
        exiting: false,
      };

      setToasts((current) => [nextToast, ...current].slice(0, 4));
      window.setTimeout(() => dismissToast(id), toast.duration ?? 4800);
    },
    [dismissToast],
  );

  useEffect(() => {
    const runIds = Object.values(runningCommandRuns).flat();
    if (runIds.length === 0) {
      return;
    }

    let disposed = false;
    const refreshStatuses = async () => {
      try {
        const statuses = await invoke<CommandRunStatus[]>("get_saved_command_run_status", {
          runIds,
        });
        if (disposed) return;
        const runningIds = new Set(
          statuses.filter((status) => status.running).map((status) => status.runId),
        );
        setRunningCommandRuns((current) => {
          let changed = false;
          const next: Record<string, string[]> = {};
          Object.entries(current).forEach(([cardId, cardRunIds]) => {
            const active = cardRunIds.filter((runId) => runningIds.has(runId));
            if (active.length > 0) next[cardId] = active;
            if (active.length !== cardRunIds.length) changed = true;
          });
          return changed ? next : current;
        });
      } catch (error) {
        console.error("Failed to query saved command status", error);
      }
    };

    void refreshStatuses();
    const interval = window.setInterval(refreshStatuses, 500);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [runningCommandRuns]);

  const persistAppData = (data: AppData, forceAllCanvases = false): Promise<void> => {
    const capturedVersions = new Map(dirtyCanvasVersionsRef.current);
    const canvasIdsToSave = forceAllCanvases
      ? new Set(data.canvases.map((canvas) => canvas.id))
      : new Set(capturedVersions.keys());
    const canvasesToSave = data.canvases.filter((canvas) => canvasIdsToSave.has(canvas.id));
    const metadata = createAppMetadata(data);
    const save = async () => {
      await invoke("save_app_data_incremental", {
        metadata,
        canvases: canvasesToSave,
      });
      capturedVersions.forEach((version, canvasId) => {
        if (dirtyCanvasVersionsRef.current.get(canvasId) === version) {
          dirtyCanvasVersionsRef.current.delete(canvasId);
        }
      });
    };
    const queuedSave = persistenceQueueRef.current.then(save, save);
    persistenceQueueRef.current = queuedSave.catch(() => undefined);
    return queuedSave;
  };

  const activeCachedImages = useMemo(
    () =>
      images.flatMap((image) =>
        image.imageId ? [{ hash: image.imageId, format: image.format }] : [],
      ),
    [images],
  );
  const { imageUrlVersion, getImageUrl, isImageLoading, storeImageFromBytes } = useImageCache({
    activeImages: activeCachedImages,
    onStoreError: (error) => {
      showToast({
        tone: "error",
        title: "Could not add image",
        message: commandErrorMessage(error),
      });
    },
  });
  // Latest image drop/paste handlers, refreshed each render so the once-mounted
  // OS drag-drop and clipboard listeners never call stale closures.
  const imageDropOpsRef = useRef<{
    canvasPointFromEvent: (event: { clientX: number; clientY: number }) => { x: number; y: number };
    looseImages: ImageElement[];
    fillElementFromPath: (id: string, path: string) => void;
    importImageFromPath: (path: string, clientX: number, clientY: number, offset?: number) => void;
    addImageFromBuffer: (buffer: ArrayBuffer, clientX: number, clientY: number) => void;
  } | null>(null);

  const clampCanvasSize = (value: number) =>
    clamp(Number.isFinite(value) ? value : CANVAS_WIDTH, 600, 10000);

  activeCanvasIdRef.current = activeCanvas.id;

  const markCanvasDirty = (canvasId: string) => {
    const currentVersion = dirtyCanvasVersionsRef.current.get(canvasId) ?? 0;
    dirtyCanvasVersionsRef.current.set(canvasId, currentVersion + 1);
  };

  const applyPendingCanvasDeletions = (canvas: TaskCanvas): TaskCanvas => {
    const pending = pendingCanvasDeletionsRef.current.get(canvas.id);
    if (!pending) {
      return canvas;
    }

    return {
      ...canvas,
      containers: canvas.containers.filter((element) => !pending.containers.has(element.id)),
      textCards: canvas.textCards.filter((card) => !pending.textCards.has(card.id)),
      textBlocks: (canvas.textBlocks ?? []).filter(
        (element) => !pending.textBlocks.has(element.id),
      ),
      images: (canvas.images ?? []).filter((image) => !pending.images.has(image.id)),
      mindmapConnections: canvas.mindmapConnections.filter(
        (connection) =>
          !pending.containers.has(connection.sourceId) &&
          !pending.containers.has(connection.targetId) &&
          !pending.textCards.has(connection.sourceId) &&
          !pending.textCards.has(connection.targetId) &&
          !pending.textBlocks.has(connection.sourceId) &&
          !pending.textBlocks.has(connection.targetId) &&
          !pending.images.has(connection.sourceId) &&
          !pending.images.has(connection.targetId),
      ),
    };
  };

  const getActiveCanvasSnapshot = (): TaskCanvas =>
    applyPendingCanvasDeletions({
      ...activeCanvas,
      containers: elements,
      textCards,
      textBlocks,
      images,
      mindmapConnections,
      pan,
      zoom,
      previewViewport: {
        width: stageRef.current?.clientWidth ?? window.innerWidth,
        height: stageRef.current?.clientHeight ?? window.innerHeight,
      },
    });

  const getPersistedCanvases = () => {
    const snapshot = getActiveCanvasSnapshot();
    return canvases.map((canvas) =>
      canvas.id === snapshot.id ? snapshot : applyPendingCanvasDeletions(canvas),
    );
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
    discordRpcEnabled,
    discordRpcShowCanvas,
    minimapEnabled,
    privacyModeEnabled,
    toolbarButtonsVisible,
    dismissedUpdateVersion,
  });
  latestDataGetterRef.current = getCurrentAppData;

  const updateHistoryState = (canvasId = activeCanvas.id) => {
    setHistoryState(getCanvasHistoryState(historyRef.current, historyIndexRef.current, canvasId));
  };

  const pushHistorySnapshot = (data: AppData, canvasId = data.activeCanvasId) => {
    const nextHistory = pushCanvasHistorySnapshot(
      historyRef.current,
      historyIndexRef.current,
      data,
      canvasId,
    );
    if (!nextHistory) {
      return;
    }

    historyRef.current = nextHistory.historyByCanvasId;
    historyIndexRef.current = nextHistory.historyIndexByCanvasId;
    if (nextHistory.canvasId === activeCanvasIdRef.current) {
      updateHistoryState(nextHistory.canvasId);
    }
  };

  const recordHistorySnapshot = (data: AppData, canvasId = data.activeCanvasId) => {
    if (!appDataLoadedRef.current || applyingHistoryRef.current) {
      return;
    }

    if ((historyTransactionsRef.current.get(canvasId)?.size ?? 0) > 0) {
      dirtyHistoryTransactionsRef.current.add(canvasId);
      if (canvasId === activeCanvasIdRef.current) {
        setHistoryState((current) =>
          current.canUndo && !current.canRedo ? current : { canUndo: true, canRedo: false },
        );
      }
      return;
    }

    dirtyHistoryTransactionsRef.current.delete(canvasId);
    pushHistorySnapshot(data, canvasId);
  };

  const beginHistoryTransaction = (canvasId: string, transactionId: string) => {
    if (!appDataLoadedRef.current || applyingHistoryRef.current) {
      return;
    }

    const transactions = historyTransactionsRef.current.get(canvasId) ?? new Set<string>();
    if (transactions.has(transactionId)) {
      return;
    }

    if (transactions.size === 0) {
      dirtyHistoryTransactionsRef.current.delete(canvasId);
      pushHistorySnapshot(latestDataGetterRef.current(), canvasId);
    }
    transactions.add(transactionId);
    historyTransactionsRef.current.set(canvasId, transactions);
  };

  const finishHistoryTransaction = (
    canvasId: string,
    transactionId: string,
    finalData?: AppData,
  ) => {
    const transactions = historyTransactionsRef.current.get(canvasId);
    if (!transactions?.delete(transactionId)) {
      return;
    }

    if (transactions.size > 0) {
      return;
    }

    historyTransactionsRef.current.delete(canvasId);
    const transactionChanged = dirtyHistoryTransactionsRef.current.delete(canvasId);
    if (finalData && transactionChanged) {
      recordHistorySnapshot(finalData, canvasId);
    }
  };

  const cancelHistoryTransactions = (canvasId: string) => {
    historyTransactionsRef.current.delete(canvasId);
    dirtyHistoryTransactionsRef.current.delete(canvasId);
  };

  const commitHistorySnapshot = (canvasId: string, data = latestDataGetterRef.current()) => {
    pushHistorySnapshot(data, canvasId);
  };

  const lifecycleActions = useStableCallbacks({
    getActiveCanvasSnapshot,
    getCurrentAppData,
    recordHistorySnapshot,
    updateHistoryState,
  });

  useEffect(() => {
    let active = true;

    invoke<unknown | null>("load_app_data")
      .then((data) => {
        if (!active) {
          return;
        }

        if (data) {
          const normalized = normalizeAppData(data, getWindowPreviewViewport);
          const selectedCanvas =
            normalized.canvases.find((canvas) => canvas.id === normalized.activeCanvasId) ??
            normalized.canvases[0] ??
            DEFAULT_CANVAS;

          activeCanvasIdRef.current = selectedCanvas.id;
          latestAppDataRef.current = normalized;
          setCanvases(normalized.canvases.length ? normalized.canvases : [DEFAULT_CANVAS]);
          setActiveCanvas(selectedCanvas);
          setCanvasGridStyle(normalized.canvasGridStyle);
          setCanvasGridOpacity(normalized.canvasGridOpacity);
          setDefaultElementColors(normalized.defaultElementColors);
          setRecentColors(normalized.recentColors);
          setShadowsUnderElements(normalized.shadowsUnderElements);
          setAllowLockedElementDeletion(normalized.allowLockedElementDeletion);
          setDiscordRpcEnabled(normalized.discordRpcEnabled);
          setDiscordRpcShowCanvas(normalized.discordRpcShowCanvas);
          setMinimapEnabled(normalized.minimapEnabled);
          setPrivacyModeEnabled(normalized.privacyModeEnabled);
          setToolbarButtonsVisible(normalized.toolbarButtonsVisible);
          setDismissedUpdateVersion(normalized.dismissedUpdateVersion);
          const initialHistory = createInitialCanvasHistory(selectedCanvas);
          historyRef.current = initialHistory.historyByCanvasId;
          historyIndexRef.current = initialHistory.historyIndexByCanvasId;
          lifecycleActions.updateHistoryState(selectedCanvas.id);
        } else {
          const initialHistory = createInitialCanvasHistory(DEFAULT_CANVAS);
          historyRef.current = initialHistory.historyByCanvasId;
          historyIndexRef.current = initialHistory.historyIndexByCanvasId;
          lifecycleActions.updateHistoryState(DEFAULT_CANVAS.id);
          markCanvasDirty(DEFAULT_CANVAS.id);
        }

        setStorageError(null);
        setAppDataLoaded(true);
        appDataLoadedRef.current = true;
      })
      .catch((error) => {
        const storageFailure = createStorageError("Failed to load app data", error);
        setStorageError(storageFailure);
        console.error(storageFailure.message);
      });

    return () => {
      active = false;
    };
  }, [
    lifecycleActions,
    setActiveCanvas,
    setCanvases,
    setElements,
    setImages,
    setMindmapConnections,
    setTextBlocks,
    setTextCards,
  ]);

  useEffect(() => {
    const data = lifecycleActions.getCurrentAppData();
    latestAppDataRef.current = data;
  }, [
    activeCanvas,
    canvasGridOpacity,
    canvasGridStyle,
    canvases,
    defaultElementColors,
    recentColors,
    shadowsUnderElements,
    allowLockedElementDeletion,
    dismissedUpdateVersion,
    discordRpcEnabled,
    discordRpcShowCanvas,
    elements,
    images,
    mindmapConnections,
    minimapEnabled,
    pan,
    privacyModeEnabled,
    textBlocks,
    textCards,
    toolbarButtonsVisible,
    zoom,
    lifecycleActions,
  ]);

  useEffect(() => {
    const data = lifecycleActions.getCurrentAppData();
    latestAppDataRef.current = data;
    lifecycleActions.recordHistorySnapshot(data, activeCanvas.id);
  }, [
    activeCanvas.height,
    activeCanvas.id,
    activeCanvas.name,
    activeCanvas.width,
    elements,
    images,
    mindmapConnections,
    textBlocks,
    textCards,
    lifecycleActions,
  ]);

  useEffect(() => {
    if (!appDataLoadedRef.current) {
      return;
    }
    const currentVersion = dirtyCanvasVersionsRef.current.get(activeCanvas.id) ?? 0;
    dirtyCanvasVersionsRef.current.set(activeCanvas.id, currentVersion + 1);
  }, [activeCanvas.id, elements, images, mindmapConnections, textBlocks, textCards]);

  useEffect(() => {
    latestCameraRef.current = { pan, zoom };
  }, [pan, zoom]);

  useEffect(() => {
    const activeHistory = historyRef.current[activeCanvas.id];
    if (!activeHistory) {
      const snapshot = omitCameraFromHistory(
        cloneCanvas(lifecycleActions.getActiveCanvasSnapshot()),
      );
      historyRef.current = {
        ...historyRef.current,
        [activeCanvas.id]: [snapshot],
      };
      historyIndexRef.current = {
        ...historyIndexRef.current,
        [activeCanvas.id]: 0,
      };
    }

    lifecycleActions.updateHistoryState(activeCanvas.id);
  }, [activeCanvas.id, lifecycleActions]);

  const { cancelAutosave, flushAutosave } = useAutosave({
    enabled: appDataLoaded,
    dataRef: latestAppDataRef,
    dependencies: [
      activeCanvas,
      canvasGridOpacity,
      canvasGridStyle,
      canvases,
      defaultElementColors,
      recentColors,
      shadowsUnderElements,
      allowLockedElementDeletion,
      discordRpcEnabled,
      discordRpcShowCanvas,
      dismissedUpdateVersion,
      elements,
      images,
      mindmapConnections,
      minimapEnabled,
      pan,
      privacyModeEnabled,
      textBlocks,
      textCards,
      toolbarButtonsVisible,
      zoom,
    ],
    save: persistAppData,
    onSaved: () => setStorageError(null),
    onError: (error) => {
      const storageFailure = createStorageError("Failed to save app data", error);
      setStorageError(storageFailure);
      console.error(storageFailure.message);
    },
  });

  useEffect(() => {
    if (!appDataLoaded) {
      return;
    }

    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void appWindow
      .onCloseRequested(async (event) => {
        event.preventDefault();
        if (closeInProgressRef.current) {
          return;
        }

        closeInProgressRef.current = true;
        const latestData = latestDataGetterRef.current();
        latestAppDataRef.current = latestData;
        markCanvasDirty(latestData.activeCanvasId);

        try {
          await onBeforeClose?.();
          await flushAutosave();
          await appWindow.destroy();
        } catch (error) {
          closeInProgressRef.current = false;
          const storageFailure = createStorageError(
            "Close cancelled because TaskMap could not save",
            error,
          );
          setStorageError(storageFailure);
          showToast({
            tone: "error",
            title: "Could not close safely",
            message: commandErrorMessage(error),
          });
        }
      })
      .then((stopListening) => {
        if (disposed) {
          stopListening();
        } else {
          unlisten = stopListening;
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [appDataLoaded, flushAutosave, onBeforeClose, showToast]);

  useDiscordRpc({
    appDataLoaded,
    discordRpcEnabled,
    canvasName: discordRpcShowCanvas ? activeCanvas.name : null,
  });

  useEffect(() => {
    if (!appDataLoaded) {
      return;
    }

    let cancelled = false;

    getCurrentWindow()
      .setContentProtected(privacyModeEnabled)
      .catch((error) => {
        if (cancelled) {
          return;
        }

        if (privacyModeEnabled) {
          setPrivacyModeEnabled(false);
        }
        showToast({
          tone: "error",
          title: "Privacy mode unavailable",
          message: commandErrorMessage(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [appDataLoaded, privacyModeEnabled, showToast]);

  const {
    appVersion,
    availableUpdate,
    updateModalOpen,
    checkForAppUpdate,
    installAppUpdate,
    dismissUpdateModal,
  } = useAppUpdates({
    appDataLoaded,
    dismissedUpdateVersion,
    onDismissUpdateVersion: setDismissedUpdateVersion,
    cancelAutosave,
    saveCurrentData: () => persistAppData(getCurrentAppData(), true),
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

  const closeContextMenus = () => {
    setContainerMenu((current) => {
      if (current) {
        setClosingContainerMenu(current);
        window.setTimeout(() => setClosingContainerMenu(null), 110);
      }

      return null;
    });
    setContainerContentMenu((current) => {
      if (current) {
        setClosingContainerContentMenu(current);
        window.setTimeout(() => setClosingContainerContentMenu(null), 110);
      }

      return null;
    });
    setTextCardMenu((current) => {
      if (current) {
        setClosingTextCardMenu(current);
        window.setTimeout(() => setClosingTextCardMenu(null), 110);
      }

      return null;
    });
    setTextBlockMenu((current) => {
      if (current) {
        setClosingTextBlockMenu(current);
        window.setTimeout(() => setClosingTextBlockMenu(null), 110);
      }

      return null;
    });
    setImageMenu((current) => {
      if (current) {
        setClosingImageMenu(current);
        window.setTimeout(() => setClosingImageMenu(null), 110);
      }

      return null;
    });
    setCanvasMenu((current) => {
      if (current) {
        setClosingCanvasMenu(current);
        window.setTimeout(() => setClosingCanvasMenu(null), 110);
      }

      return null;
    });
    setMindmapConnectionMenu(null);
  };

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

  const getContainerSearchQuery = (container: ContainerElement) =>
    container.extensions?.search?.query.trim().toLowerCase() ?? "";

  const getContainerVisibleTextCards = (container: ContainerElement, cards = textCards) => {
    const orderedCards = getOrderedContainerTextCards(container.id, cards);
    const query = getContainerSearchQuery(container);
    const searchedCards = query
      ? orderedCards.filter((card) => card.text.toLowerCase().includes(query))
      : orderedCards;
    const selectedCardId = container.extensions?.pickCard?.selectedCardId;
    const filtered = selectedCardId
      ? searchedCards.filter((card) => card.id === selectedCardId)
      : searchedCards;

    // Match the render pipeline exactly (filter, then sort) so a card's index
    // in this list is the same slot it visually occupies. Drag math relies on
    // this — using the unfiltered/unsorted order makes a card snap to the wrong
    // slot the instant it is grabbed (notably with the search extension).
    return getSortedContainerTextCards(container, filtered);
  };

  const getAlphabetSortKey = (text: string) => text.replace(/[*_]/g, "").trim().toLocaleLowerCase();

  const getSortGroup = (value: string) => (/^[a-z]/i.test(value) ? 0 : 1);

  const getSortedContainerTextCards = (container: ContainerElement, cards: TextCardElement[]) => {
    const sorting = container.extensions?.sorting;
    if (!sorting?.mode) {
      return cards;
    }

    return [...cards].sort((left, right) => {
      const leftValue =
        sorting.mode === "alphabet"
          ? getAlphabetSortKey(left.text)
          : left.accent.toLocaleLowerCase();
      const rightValue =
        sorting.mode === "alphabet"
          ? getAlphabetSortKey(right.text)
          : right.accent.toLocaleLowerCase();
      const groupDifference =
        sorting.mode === "alphabet" ? getSortGroup(leftValue) - getSortGroup(rightValue) : 0;
      const valueDifference = leftValue.localeCompare(rightValue);
      const stableDifference = (left.order ?? 0) - (right.order ?? 0);
      const direction = sorting.direction === "asc" ? 1 : -1;

      return groupDifference || (valueDifference || stableDifference) * direction;
    });
  };

  const getContainerViewportHeight = (container: ContainerElement) =>
    Math.max(
      0,
      container.height -
        CONTAINER_HEADER_HEIGHT -
        (container.extensions?.search ? CONTAINER_SEARCH_HEIGHT : 0),
    );

  const getContainerContentHeight = (container: ContainerElement, cards = textCards) => {
    const cardCount = getContainerVisibleTextCards(container, cards).length;

    if (cardCount === 0) {
      return CONTAINER_TEXT_CARD_PADDING * 2;
    }

    return (
      CONTAINER_TEXT_CARD_PADDING * 2 +
      cardCount * CONTAINER_TEXT_CARD_ROW_HEIGHT +
      (cardCount - 1) * CONTAINER_TEXT_CARD_GAP
    );
  };

  const getContainerMaxScroll = (container: ContainerElement, cards = textCards) =>
    Math.max(
      0,
      getContainerContentHeight(container, cards) - getContainerViewportHeight(container),
    );

  const getContainerScrollOffset = (container: ContainerElement) =>
    clamp(containerScrollOffsets[container.id] ?? 0, 0, getContainerMaxScroll(container));

  const getScrollOffsetForVisibleCardIndex = (
    container: ContainerElement,
    visibleIndex: number,
    cards: TextCardElement[],
  ) => {
    const currentOffset = getContainerScrollOffset(container);
    const viewportHeight = getContainerViewportHeight(container);
    const maxScroll = getContainerMaxScroll(container, cards);
    const slotTop =
      CONTAINER_TEXT_CARD_PADDING +
      visibleIndex * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP);
    const slotBottom = slotTop + CONTAINER_TEXT_CARD_ROW_HEIGHT;
    const visibleTop = currentOffset + CONTAINER_TEXT_CARD_PADDING;
    const visibleBottom = currentOffset + viewportHeight - CONTAINER_TEXT_CARD_PADDING;

    if (slotBottom > visibleBottom) {
      return clamp(slotBottom - viewportHeight + CONTAINER_TEXT_CARD_PADDING, 0, maxScroll);
    }

    if (slotTop < visibleTop) {
      return clamp(slotTop - CONTAINER_TEXT_CARD_PADDING, 0, maxScroll);
    }

    return currentOffset;
  };

  const getContainerCardStackTop = (container: ContainerElement) =>
    container.y +
    CONTAINER_HEADER_HEIGHT +
    (container.extensions?.search ? CONTAINER_SEARCH_HEIGHT : 0) +
    CONTAINER_TEXT_CARD_PADDING;

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
    rectanglesIntersect(viewportWorldRectangle(interactionSnapshot.viewport), element);

  const getOrderedContainerTextCards = (containerId: string, cards = textCards) =>
    cards === textCards
      ? (orderedTextCardsByContainerId.get(containerId) ?? [])
      : cards
          .filter((card) => card.containerId === containerId)
          .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

  const getTextCardStackPosition = (card: TextCardElement, cards = textCards) => {
    const container = card.containerId ? containersById.get(card.containerId) : null;
    if (!container) {
      return { x: card.x, y: card.y };
    }

    const visibleCards = getContainerVisibleTextCards(container, cards);
    const index = Math.max(
      visibleCards.findIndex((currentCard) => currentCard.id === card.id),
      0,
    );

    return {
      x: container.x + CONTAINER_TEXT_CARD_PADDING,
      y:
        getContainerCardStackTop(container) +
        index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
        getContainerScrollOffset(container),
    };
  };

  const toContainerRelativePosition = (
    position: {
      x: number;
      y: number;
      width?: number;
      height?: number;
      maxWidth?: number;
      text?: string;
    },
    container: ContainerElement,
  ) => ({
    ...position,
    x: position.x - container.x,
    y: position.y - container.y,
  });

  const interactionGeometryById = new Map(
    interactionSnapshot.geometryPreviews.map((preview) => [preview.id, preview.geometry]),
  );

  const getTextCardRenderPosition = (card: TextCardElement) => {
    const preview = interactionGeometryById.get(card.id);
    if (preview) return { x: preview.x, y: preview.y };
    if (!card.containerId) return undefined;
    const container = containersById.get(card.containerId);
    if (!container) return { x: card.x, y: card.y };
    const visibleCards = getContainerVisibleTextCards(container);
    const index = Math.max(
      visibleCards.findIndex((currentCard) => currentCard.id === card.id),
      0,
    );
    return {
      x: container.x + CONTAINER_TEXT_CARD_PADDING,
      y:
        getContainerCardStackTop(container) +
        index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
        getContainerScrollOffset(container),
    };
  };
  const getTextCardDropIndex = (
    container: ContainerElement,
    point: { x: number; y: number },
    cards: TextCardElement[],
    draggingId: string,
    currentIndex?: number,
  ) => {
    // Index against the visible (filtered + sorted) list, minus the dragged
    // card, so a drop slot matches what the user actually sees. When no search
    // is active this is just the full ordered list.
    const visibleCards = getContainerVisibleTextCards(container, cards).filter(
      (card) => card.id !== draggingId,
    );
    const stackTop = getContainerCardStackTop(container) - getContainerScrollOffset(container);
    const slotHeight = CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP;

    if (currentIndex !== undefined) {
      const previousCard = visibleCards[currentIndex - 1];
      const nextCard = visibleCards[currentIndex];

      if (previousCard) {
        const previousMidpoint =
          stackTop + (currentIndex - 1) * slotHeight + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2;
        if (point.y < previousMidpoint) {
          return currentIndex - 1;
        }
      }

      if (nextCard) {
        const nextMidpoint =
          stackTop + (currentIndex + 1) * slotHeight + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2;
        if (point.y > nextMidpoint) {
          return currentIndex + 1;
        }
      }

      return currentIndex;
    }

    let insertionIndex = 0;

    for (let index = 0; index < visibleCards.length; index += 1) {
      const midpoint = stackTop + index * slotHeight + CONTAINER_TEXT_CARD_ROW_HEIGHT / 2;
      if (point.y < midpoint) {
        return insertionIndex;
      }

      insertionIndex += 1;
    }

    return insertionIndex;
  };

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
    setRenamingId(null);
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

  const animateContainerIn = (id: string) => {
    setEnteringIds((current) => [...current, id]);
    window.setTimeout(() => {
      setEnteringIds((current) => current.filter((enteringId) => enteringId !== id));
    }, 180);
  };

  const animateTextCardIn = (id: string) => {
    setEnteringTextCardIds((current) => [...current, id]);
    window.setTimeout(() => {
      setEnteringTextCardIds((current) => current.filter((enteringId) => enteringId !== id));
    }, 180);
  };

  const animateTextBlockIn = (id: string) => {
    setEnteringTextBlockIds((current) => [...current, id]);
    window.setTimeout(() => {
      setEnteringTextBlockIds((current) => current.filter((enteringId) => enteringId !== id));
    }, 180);
  };

  const animateImageIn = (id: string) => {
    setEnteringImageIds((current) => [...current, id]);
    window.setTimeout(() => {
      setEnteringImageIds((current) => current.filter((enteringId) => enteringId !== id));
    }, 180);
  };

  const registerPendingDeletion = (
    canvasId: string,
    kind: keyof PendingCanvasDeletions,
    ids: string[],
  ) => {
    const pending = pendingCanvasDeletionsRef.current.get(canvasId) ?? {
      containers: new Set<string>(),
      textCards: new Set<string>(),
      textBlocks: new Set<string>(),
      images: new Set<string>(),
    };
    ids.forEach((id) => pending[kind].add(id));
    pendingCanvasDeletionsRef.current.set(canvasId, pending);
    markCanvasDirty(canvasId);
  };

  const recordPendingDeletion = (canvasId: string) => {
    const latestData = latestDataGetterRef.current();
    latestAppDataRef.current = latestData;
    recordHistorySnapshot(latestData, canvasId);
  };

  const finishPendingDeletion = (
    canvasId: string,
    kind: keyof PendingCanvasDeletions,
    ids: string[],
  ) => {
    const pending = pendingCanvasDeletionsRef.current.get(canvasId);
    if (!pending) {
      return;
    }
    ids.forEach((id) => pending[kind].delete(id));
    if (
      pending.containers.size === 0 &&
      pending.textCards.size === 0 &&
      pending.textBlocks.size === 0 &&
      pending.images.size === 0
    ) {
      pendingCanvasDeletionsRef.current.delete(canvasId);
    }
  };

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
    pendingCanvasDeletionsRef.current.delete(canvasId);
    if (canvasId === activeCanvasIdRef.current) {
      setDeletingIds([]);
      setDeletingTextCardIds([]);
      setDeletingTextBlockIds([]);
      setDeletingImageIds([]);
    }
  };

  const removeImages = (ids: string[], force = false, canvasId = activeCanvasIdRef.current) => {
    const idsToRemove = ids.filter(
      (id) => force || canvasId !== activeCanvasIdRef.current || !isElementDeletionLocked(id),
    );
    if (idsToRemove.length === 0) {
      return;
    }

    const idSet = new Set(idsToRemove);
    registerPendingDeletion(canvasId, "images", idsToRemove);
    recordPendingDeletion(canvasId);
    if (canvasId === activeCanvasIdRef.current) {
      setDeletingImageIds((current) => Array.from(new Set([...current, ...idsToRemove])));
      setImageMenu((current) => (current && idSet.has(current.id) ? null : current));
      setSelectedIds((current) => current.filter((selectedId) => !idSet.has(selectedId)));
      setLoadingImageIds((current) => current.filter((loadingId) => !idSet.has(loadingId)));
    }
    scheduleDeletionCommit(
      canvasId,
      () => {
        setCanvases((current) =>
          current.map((canvas) =>
            canvas.id === canvasId
              ? {
                  ...canvas,
                  images: (canvas.images ?? []).filter((image) => !idSet.has(image.id)),
                  mindmapConnections: canvas.mindmapConnections.filter(
                    (connection) =>
                      !idSet.has(connection.sourceId) && !idSet.has(connection.targetId),
                  ),
                }
              : canvas,
          ),
        );
        setDeletingImageIds((current) => current.filter((deletingId) => !idSet.has(deletingId)));
        setEnteringImageIds((current) => current.filter((enteringId) => !idSet.has(enteringId)));
        finishPendingDeletion(canvasId, "images", idsToRemove);
      },
      160,
    );
  };

  const pulseTextCard = (id: string) => {
    setPulsingTextCardIds((current) => [...current.filter((pulsingId) => pulsingId !== id), id]);
    window.setTimeout(() => {
      setPulsingTextCardIds((current) => current.filter((pulsingId) => pulsingId !== id));
    }, 260);
  };

  const glowTextCard = (id: string) => {
    setGlowingTextCardIds((current) => [...current.filter((glowingId) => glowingId !== id), id]);
    window.setTimeout(() => {
      setGlowingTextCardIds((current) => current.filter((glowingId) => glowingId !== id));
    }, 720);
  };

  const pulseTextBlock = (id: string) => {
    setPulsingTextBlockIds((current) => [...current.filter((pulsingId) => pulsingId !== id), id]);
    window.setTimeout(() => {
      setPulsingTextBlockIds((current) => current.filter((pulsingId) => pulsingId !== id));
    }, 260);
  };

  const removeContainers = (ids: string[], force = false, canvasId = activeCanvasIdRef.current) => {
    const idsToRemove = ids.filter((id) => {
      if (force || canvasId !== activeCanvasIdRef.current) {
        return true;
      }
      return !isElementDeletionLocked(id);
    });
    if (idsToRemove.length === 0) {
      return;
    }

    const idsToRemoveSet = new Set(idsToRemove);
    const containedTextCardIds = textCards
      .filter((card) => card.containerId && idsToRemoveSet.has(card.containerId))
      .map((card) => card.id);
    const containedImageIds = images
      .filter((image) => image.containerId && idsToRemoveSet.has(image.containerId))
      .map((image) => image.id);

    registerPendingDeletion(canvasId, "containers", idsToRemove);
    registerPendingDeletion(canvasId, "textCards", containedTextCardIds);
    registerPendingDeletion(canvasId, "images", containedImageIds);
    recordPendingDeletion(canvasId);
    setDeletingIds((current) => Array.from(new Set([...current, ...idsToRemove])));
    setDeletingTextCardIds((current) => Array.from(new Set([...current, ...containedTextCardIds])));
    setDeletingImageIds((current) => Array.from(new Set([...current, ...containedImageIds])));
    setSelectedIds((current) =>
      current.filter(
        (selectedId) =>
          !idsToRemoveSet.has(selectedId) &&
          !containedTextCardIds.includes(selectedId) &&
          !containedImageIds.includes(selectedId),
      ),
    );
    setEditingTextCardId((current) =>
      current && containedTextCardIds.includes(current) ? null : current,
    );
    setTextCardMenu((current) =>
      current && containedTextCardIds.includes(current.id) ? null : current,
    );
    setImageMenu((current) => (current && containedImageIds.includes(current.id) ? null : current));
    setLoadingImageIds((current) =>
      current.filter((loadingId) => !containedImageIds.includes(loadingId)),
    );
    scheduleDeletionCommit(
      canvasId,
      () => {
        const containedTextCardIdSet = new Set(containedTextCardIds);
        const containedImageIdSet = new Set(containedImageIds);
        const removedConnectionEndpointIds = new Set([
          ...idsToRemove,
          ...containedTextCardIds,
          ...containedImageIds,
        ]);
        setCanvases((current) =>
          current.map((canvas) =>
            canvas.id === canvasId
              ? {
                  ...canvas,
                  containers: canvas.containers.filter(
                    (element) => !idsToRemoveSet.has(element.id),
                  ),
                  textCards: normalizeTextCardOrders(
                    canvas.textCards.filter((card) => !containedTextCardIdSet.has(card.id)),
                  ),
                  images: (canvas.images ?? []).filter(
                    (image) => !containedImageIdSet.has(image.id),
                  ),
                  mindmapConnections: canvas.mindmapConnections.filter(
                    (connection) =>
                      !removedConnectionEndpointIds.has(connection.sourceId) &&
                      !removedConnectionEndpointIds.has(connection.targetId),
                  ),
                }
              : canvas,
          ),
        );
        setDeletingIds((current) =>
          current.filter((deletingId) => !idsToRemoveSet.has(deletingId)),
        );
        setEnteringIds((current) =>
          current.filter((enteringId) => !idsToRemoveSet.has(enteringId)),
        );
        setDeletingTextCardIds((current) =>
          current.filter((deletingId) => !containedTextCardIds.includes(deletingId)),
        );
        setEnteringTextCardIds((current) =>
          current.filter((enteringId) => !containedTextCardIds.includes(enteringId)),
        );
        setPulsingTextCardIds((current) =>
          current.filter((pulsingId) => !containedTextCardIds.includes(pulsingId)),
        );
        setDeletingImageIds((current) =>
          current.filter((deletingId) => !containedImageIds.includes(deletingId)),
        );
        setEnteringImageIds((current) =>
          current.filter((enteringId) => !containedImageIds.includes(enteringId)),
        );
        finishPendingDeletion(canvasId, "containers", idsToRemove);
        finishPendingDeletion(canvasId, "textCards", containedTextCardIds);
        finishPendingDeletion(canvasId, "images", containedImageIds);
      },
      160,
    );
  };

  const removeTextCards = (ids: string[], force = false, canvasId = activeCanvasIdRef.current) => {
    const idsToRemove = ids.filter(
      (id) => force || canvasId !== activeCanvasIdRef.current || !isElementDeletionLocked(id),
    );
    if (idsToRemove.length === 0) {
      return;
    }

    const idSet = new Set(idsToRemove);
    registerPendingDeletion(canvasId, "textCards", idsToRemove);
    recordPendingDeletion(canvasId);
    setDeletingTextCardIds((current) => Array.from(new Set([...current, ...idsToRemove])));
    setEditingTextCardId((current) => (current && idSet.has(current) ? null : current));
    setTextCardMenu((current) => (current && idSet.has(current.id) ? null : current));
    setSelectedIds((current) => current.filter((selectedId) => !idSet.has(selectedId)));
    scheduleDeletionCommit(
      canvasId,
      () => {
        setCanvases((current) =>
          current.map((canvas) =>
            canvas.id === canvasId
              ? {
                  ...canvas,
                  textCards: normalizeTextCardOrders(
                    canvas.textCards.filter((card) => !idSet.has(card.id)),
                  ),
                  mindmapConnections: canvas.mindmapConnections.filter(
                    (connection) =>
                      !idSet.has(connection.sourceId) && !idSet.has(connection.targetId),
                  ),
                }
              : canvas,
          ),
        );
        setDeletingTextCardIds((current) => current.filter((deletingId) => !idSet.has(deletingId)));
        setEnteringTextCardIds((current) => current.filter((enteringId) => !idSet.has(enteringId)));
        setPulsingTextCardIds((current) => current.filter((pulsingId) => !idSet.has(pulsingId)));
        finishPendingDeletion(canvasId, "textCards", idsToRemove);
      },
      150,
    );
  };

  const removeTextBlocks = (ids: string[], force = false, canvasId = activeCanvasIdRef.current) => {
    const idsToRemove = ids.filter(
      (id) => force || canvasId !== activeCanvasIdRef.current || !isElementDeletionLocked(id),
    );
    if (idsToRemove.length === 0) {
      return;
    }

    const idSet = new Set(idsToRemove);
    registerPendingDeletion(canvasId, "textBlocks", idsToRemove);
    recordPendingDeletion(canvasId);
    setDeletingTextBlockIds((current) => Array.from(new Set([...current, ...idsToRemove])));
    setEditingTextBlockId((current) => (current && idSet.has(current) ? null : current));
    setTextBlockMenu((current) => (current && idSet.has(current.id) ? null : current));
    setSelectedIds((current) => current.filter((selectedId) => !idSet.has(selectedId)));
    scheduleDeletionCommit(
      canvasId,
      () => {
        setCanvases((current) =>
          current.map((canvas) =>
            canvas.id === canvasId
              ? {
                  ...canvas,
                  textBlocks: (canvas.textBlocks ?? []).filter((element) => !idSet.has(element.id)),
                  mindmapConnections: canvas.mindmapConnections.filter(
                    (connection) =>
                      !idSet.has(connection.sourceId) && !idSet.has(connection.targetId),
                  ),
                }
              : canvas,
          ),
        );
        setDeletingTextBlockIds((current) =>
          current.filter((deletingId) => !idSet.has(deletingId)),
        );
        setEnteringTextBlockIds((current) =>
          current.filter((enteringId) => !idSet.has(enteringId)),
        );
        setPulsingTextBlockIds((current) => current.filter((pulsingId) => !idSet.has(pulsingId)));
        finishPendingDeletion(canvasId, "textBlocks", idsToRemove);
      },
      160,
    );
  };

  const removeMindmapConnection = (id: string) => {
    setMindmapConnections((current) => current.filter((connection) => connection.id !== id));
    setMindmapConnectionMenu(null);
  };

  const deleteCanvasSelection = (actionIds: string[]) => {
    const canvasId = activeCanvasIdRef.current;
    const plan = planCanvasDeletion(activeCanvas, actionIds, isElementDeletionLocked);

    beginHistoryTransaction(canvasId, DELETE_HISTORY_TRANSACTION);
    removeContainers(plan.containerIds);
    removeTextCards(plan.textCardIds);
    removeTextBlocks(plan.textBlockIds);
    removeImages(plan.imageIds);
    finishHistoryTransaction(canvasId, DELETE_HISTORY_TRANSACTION, latestDataGetterRef.current());
  };

  const closeCanvasManager = useCallback(() => {
    if (!canvasManagerOpen || canvasManagerClosing) {
      return;
    }

    if (panelSwitchTimeoutRef.current !== null) {
      window.clearTimeout(panelSwitchTimeoutRef.current);
    }
    setCanvasManagerClosing(true);
    panelSwitchTimeoutRef.current = window.setTimeout(() => {
      setCanvasManagerOpen(false);
      setCanvasManagerClosing(false);
      panelSwitchTimeoutRef.current = null;
    }, CANVAS_MANAGER_ANIMATION_MS);
  }, [canvasManagerClosing, canvasManagerOpen]);

  const closeExtensionsPanel = useCallback(() => {
    if (!extensionsOpen || extensionsClosing) {
      return;
    }

    if (panelSwitchTimeoutRef.current !== null) {
      window.clearTimeout(panelSwitchTimeoutRef.current);
    }
    setExtensionsClosing(true);
    panelSwitchTimeoutRef.current = window.setTimeout(() => {
      setExtensionsOpen(false);
      setExtensionsClosing(false);
      panelSwitchTimeoutRef.current = null;
    }, CANVAS_MANAGER_ANIMATION_MS);
  }, [extensionsClosing, extensionsOpen]);

  const switchLeftPanel = useCallback((target: "canvases" | "extensions") => {
    if (panelSwitchTimeoutRef.current !== null) {
      window.clearTimeout(panelSwitchTimeoutRef.current);
      panelSwitchTimeoutRef.current = null;
    }

    if (target === "canvases") {
      setExtensionsOpen(false);
      setExtensionsClosing(false);
      setCanvasManagerOpen(true);
      setCanvasManagerClosing(false);
    } else {
      setCanvasManagerOpen(false);
      setCanvasManagerClosing(false);
      setExtensionsOpen(true);
      setExtensionsClosing(false);
    }
  }, []);

  useEffect(
    () => () => {
      if (panelSwitchTimeoutRef.current !== null) {
        window.clearTimeout(panelSwitchTimeoutRef.current);
      }
      if (canvasCycleRestoreTimeoutRef.current !== null) {
        window.clearTimeout(canvasCycleRestoreTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const trackPointer = (event: globalThis.PointerEvent) => {
      lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("pointermove", trackPointer, true);
    return () => window.removeEventListener("pointermove", trackPointer, true);
  }, []);

  const deletionActions = useStableCallbacks({
    deleteCanvasSelection,
    removeContainers,
    removeImages,
    removeTextBlocks,
    removeTextCards,
  });

  useEffect(() => {
    const clearFocusedElement = () => {
      const focusedElement = document.activeElement;
      if (focusedElement instanceof HTMLElement) {
        focusedElement.blur();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditingText = isEditableKeyboardTarget(target);
      const modalOpen =
        settingsOpen ||
        clearModalOpen ||
        updateModalOpen ||
        isModalPresenceBlocking() ||
        Boolean(pendingExtensionConflict);

      if (modalOpen || target?.closest("[role='dialog'], [aria-modal='true']")) {
        return;
      }

      if (
        event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key.toLowerCase() === "e" &&
        !isEditingText &&
        !isKeyboardFocusableControl(target)
      ) {
        event.preventDefault();
        event.stopPropagation();
        clearFocusedElement();
        closeContextMenus();
        setQuickExtensionsMenu({
          left: lastPointerPositionRef.current.x,
          top: lastPointerPositionRef.current.y,
        });
        return;
      }

      if (
        event.key === "Tab" &&
        !isEditingText &&
        !isKeyboardFocusableControl(target) &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        clearFocusedElement();

        if (event.shiftKey) {
          if (canvasManagerOpen && !canvasManagerClosing) {
            switchLeftPanel("extensions");
            return;
          }

          if (extensionsOpen && !extensionsClosing) {
            switchLeftPanel("canvases");
            return;
          }

          switchLeftPanel("canvases");
          return;
        }

        if (canvasManagerOpen && !canvasManagerClosing) {
          closeCanvasManager();
          return;
        }

        closeExtensionsPanel();
        setQuickExtensionsMenu(null);
        switchLeftPanel("canvases");
        return;
      }

      if (
        !isEditingText &&
        event.key === "Escape" &&
        !settingsOpen &&
        !clearModalOpen &&
        !updateModalOpen &&
        !pendingExtensionConflict
      ) {
        event.preventDefault();
        event.stopPropagation();
        clearFocusedElement();
        closeContextMenus();
        closeCanvasManager();
        closeExtensionsPanel();
        setRenamingId(null);
        return;
      }

      if (event.key !== "Delete" || isEditingText || isKeyboardFocusableControl(target)) {
        return;
      }

      event.preventDefault();
      deletionActions.deleteCanvasSelection(selectedIds);
      closeContextMenus();
      setRenamingId(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    canvasManagerClosing,
    canvasManagerOpen,
    clearModalOpen,
    closeCanvasManager,
    closeExtensionsPanel,
    containersById,
    deletionActions,
    extensionsClosing,
    extensionsOpen,
    imagesById,
    pendingExtensionConflict,
    selectedIds,
    settingsOpen,
    switchLeftPanel,
    textBlocksById,
    textCardsById,
    updateModalOpen,
  ]);

  const getLooseTextCardSelectionBounds = (card: TextCardElement) => {
    const measuredSize = measuredTextCardSizes[card.id];
    const stableSize = measuredSize?.canvasId === activeCanvas.id ? measuredSize : undefined;
    const textLines = card.text.split("\n");
    const longestLineLength = Math.max(1, ...textLines.map((line) => line.length));
    const estimatedTextWidth = Math.max(44, Math.min(520, longestLineLength * 9 + 48));
    const estimatedWrappedLines = textLines.reduce(
      (count, line) => count + Math.max(1, Math.ceil((line.length * 9) / 472)),
      0,
    );
    const estimatedHeight =
      card.kind === "mindmap"
        ? CONTAINER_TEXT_CARD_ROW_HEIGHT + (estimatedWrappedLines - 1) * 24
        : CONTAINER_TEXT_CARD_ROW_HEIGHT;

    return {
      left: card.x,
      top: card.y,
      width: stableSize?.width || estimatedTextWidth,
      height: stableSize?.height || estimatedHeight,
    };
  };

  const getConnectableElementBounds = (id: string): MindmapBounds | null => {
    const container = containersById.get(id);
    if (container) {
      return { x: container.x, y: container.y, width: container.width, height: container.height };
    }
    const textBlock = textBlocksById.get(id);
    if (textBlock) {
      return {
        x: textBlock.x,
        y: textBlock.y,
        width: textBlock.width,
        height: textBlock.height,
      };
    }
    const image = imagesById.get(id);
    if (image) {
      return { x: image.x, y: image.y, width: image.width, height: image.height };
    }
    const card = textCardsById.get(id);
    if (card?.kind === "mindmap") {
      const bounds = getLooseTextCardSelectionBounds(card);
      return { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height };
    }
    return null;
  };

  const getAvailableMindmapEndpoint = (clientX: number, clientY: number, sourceId: string) => {
    const targetNode = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-connection-port]");
    const targetId = targetNode?.dataset.connectionPortOwner;
    const targetPort = targetNode?.dataset.connectionPort as MindmapPort | undefined;
    if (
      !targetId ||
      !targetPort ||
      targetId === sourceId ||
      !isConnectableElement(targetId) ||
      mindmapConnections.some(
        (connection) =>
          (connection.sourceId === sourceId && connection.targetId === targetId) ||
          (connection.sourceId === targetId && connection.targetId === sourceId),
      )
    ) {
      return null;
    }

    return { id: targetId, port: targetPort };
  };

  const getMeasuredTextCardBounds = (card: TextCardElement): ExtensionRippleBounds | null => {
    const node = worldRef.current?.querySelector<HTMLElement>(`[data-text-card-id="${card.id}"]`);
    const worldRect = worldRef.current?.getBoundingClientRect();
    if (!node || !worldRect || zoom <= 0) {
      return null;
    }

    const rect = node.getBoundingClientRect();
    return {
      left: (rect.left - worldRect.left) / zoom,
      top: (rect.top - worldRect.top) / zoom,
      width: rect.width / zoom,
      height: rect.height / zoom,
      borderRadius: 8,
    };
  };

  const getTextCardRippleBounds = (card: TextCardElement): ExtensionRippleBounds | null => {
    const measuredBounds = getMeasuredTextCardBounds(card);
    if (!card.containerId) {
      return measuredBounds ?? { ...getLooseTextCardSelectionBounds(card), borderRadius: 8 };
    }

    const container = containersById.get(card.containerId);
    const position = getTextCardRenderPosition(card);
    if (!container || !position) {
      return null;
    }
    const visibleCards = getContainerVisibleTextCards(container);
    if (!visibleCards.some((currentCard) => currentCard.id === card.id)) {
      return null;
    }

    const contentTop =
      container.y +
      CONTAINER_HEADER_HEIGHT +
      (container.extensions?.search ? CONTAINER_SEARCH_HEIGHT : 0);
    const baseBounds =
      measuredBounds ??
      ({
        left: position.x,
        top: position.y,
        width: Math.max(120, container.width - CONTAINER_TEXT_CARD_PADDING * 2),
        height: CONTAINER_TEXT_CARD_ROW_HEIGHT,
      } satisfies ExtensionRippleBounds);
    const top = Math.max(baseBounds.top, contentTop);
    const bottom = Math.min(baseBounds.top + baseBounds.height, container.y + container.height);
    const height = bottom - top;
    if (height <= 0) {
      return null;
    }

    return {
      left: baseBounds.left,
      top,
      width: baseBounds.width,
      height,
      borderTopLeftRadius: top === baseBounds.top ? 8 : 0,
      borderTopRightRadius: top === baseBounds.top ? 8 : 0,
      borderBottomRightRadius: bottom === baseBounds.top + baseBounds.height ? 8 : 0,
      borderBottomLeftRadius: bottom === baseBounds.top + baseBounds.height ? 8 : 0,
    };
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

  const createContainer = (clientX: number, clientY: number) => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const width = 360;
    const height = 240;
    const nextNumber = elements.length + 1;
    const id = createEntityId("container");
    const nextElement: ContainerElement = {
      id,
      name: `Container ${nextNumber}`,
      x: clamp(point.x - width / 2, 0, canvasWidth - width),
      y: clamp(point.y - 28, 0, canvasHeight - height),
      width,
      height,
      accent: defaultElementColors.container,
    };

    setElements((current) => [...current, nextElement]);
    setSelectedIds([id]);
    animateContainerIn(id);
    closeContextMenus();
    setEditingTextCardId(null);
    setRenameDraft(nextElement.name);
    setRenamingId(id);
  };

  // Fit an image's natural size into a sensible initial on-canvas box.
  const getInitialImageSize = (naturalWidth?: number, naturalHeight?: number) => {
    const maxEdge = 360;
    if (!naturalWidth || !naturalHeight) {
      return { width: 280, height: 200 };
    }
    const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight));
    return {
      width: Math.max(MIN_IMAGE_SIZE, Math.round(naturalWidth * scale)),
      height: Math.max(MIN_IMAGE_SIZE, Math.round(naturalHeight * scale)),
    };
  };

  // Create an empty image placeholder at a canvas point; the caller (or the
  // user clicking it) fills it with a picked/dropped/pasted image afterwards.
  const createImageElement = (clientX: number, clientY: number): string => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const id = createEntityId("image");
    const width = 280;
    const height = 200;
    const image: ImageElement = {
      id,
      x: clamp(point.x - width / 2, 0, canvasWidth - width),
      y: clamp(point.y - height / 2, 0, canvasHeight - height),
      width,
      height,
      accent: defaultElementColors.image,
    };

    updateImagesForCanvas(activeCanvasIdRef.current, (current) => [...current, image]);
    animateImageIn(id);
    setSelectedIds([id]);
    closeContextMenus();
    setRenamingId(null);
    return id;
  };

  const setImageLoading = (id: string, loading: boolean) => {
    setLoadingImageIds((current) =>
      loading
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((loadingId) => loadingId !== id),
    );
  };

  const updateImagesForCanvas = (
    canvasId: string,
    update: (current: ImageElement[]) => ImageElement[],
  ) => {
    markCanvasDirty(canvasId);
    setCanvases((current) =>
      current.map((canvas) =>
        canvas.id === canvasId ? { ...canvas, images: update(canvas.images ?? []) } : canvas,
      ),
    );

    latestAppDataRef.current = {
      ...latestAppDataRef.current,
      canvases: latestAppDataRef.current.canvases.map((canvas) =>
        canvas.id === canvasId ? { ...canvas, images: update(canvas.images ?? []) } : canvas,
      ),
    };
    recordHistorySnapshot(latestAppDataRef.current, canvasId);
  };

  // Apply stored image metadata to an element, sizing it to the image's aspect.
  // Only resizes empty placeholders; an element that already had an image keeps
  // its current box when the image is replaced.
  const applyImageMeta = (canvasId: string, id: string, meta: ImageMeta) => {
    const targetCanvas = latestAppDataRef.current.canvases.find((canvas) => canvas.id === canvasId);
    const targetCanvasWidth = targetCanvas?.width ?? canvasWidth;
    const targetCanvasHeight = targetCanvas?.height ?? canvasHeight;
    updateImagesForCanvas(canvasId, (current) =>
      current.map((image) => {
        if (image.id !== id) {
          return image;
        }
        const wasEmpty = !image.imageId;
        const size = getInitialImageSize(meta.width, meta.height);
        return {
          ...image,
          imageId: meta.hash,
          format: meta.format,
          naturalWidth: meta.width || undefined,
          naturalHeight: meta.height || undefined,
          ...(wasEmpty
            ? {
                x: clamp(image.x, 0, targetCanvasWidth - size.width),
                y: clamp(image.y, 0, targetCanvasHeight - size.height),
                ...size,
              }
            : {}),
        };
      }),
    );
    setImageLoading(id, false);
  };

  // Store an already-read image path into the given element, showing a loading
  // spinner while the (off-thread) decode/encode runs.
  const fillElementFromPath = async (
    id: string,
    path: string,
    canvasId = activeCanvasIdRef.current,
  ) => {
    const historyTransaction = imageHistoryTransaction(id);
    beginHistoryTransaction(canvasId, historyTransaction);
    setImageLoading(id, true);
    try {
      const meta = await invoke<ImageMeta>("store_image_path", { path });
      applyImageMeta(canvasId, id, meta);
    } catch (error) {
      console.error("Failed to store image", error);
      showToast({
        tone: "error",
        title: "Could not add image",
        message: commandErrorMessage(error),
      });
      setImageLoading(id, false);
    } finally {
      finishHistoryTransaction(canvasId, historyTransaction, latestAppDataRef.current);
    }
  };

  // Open the native file picker (fast — returns a path) and fill the given
  // element. The heavy processing happens afterward behind a loading spinner so
  // the app never freezes on a large image.
  const pickImageForElement = async (id: string) => {
    const canvasId = activeCanvasIdRef.current;
    try {
      const path = await invoke<string | null>("pick_image_path");
      if (path) {
        await fillElementFromPath(id, path, canvasId);
      }
    } catch (error) {
      console.error("Failed to pick image", error);
      showToast({
        tone: "error",
        title: "Could not add image",
        message: commandErrorMessage(error),
      });
    }
  };

  // Create an empty placeholder at a canvas point and return its id, without
  // touching selection focus the way the menu/double-click path does.
  const spawnImagePlaceholder = (clientX: number, clientY: number, offset = 0): string => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const width = 280;
    const height = 200;
    const id = createEntityId("image");
    const canvasId = activeCanvasIdRef.current;
    const image: ImageElement = {
      id,
      x: clamp(point.x - width / 2 + offset, 0, canvasWidth - width),
      y: clamp(point.y - height / 2 + offset, 0, canvasHeight - height),
      width,
      height,
      accent: defaultElementColors.image,
    };
    beginHistoryTransaction(canvasId, imageHistoryTransaction(id));
    updateImagesForCanvas(canvasId, (current) => [...current, image]);
    animateImageIn(id);
    return id;
  };

  // Drop a loading placeholder at a point, then fill it from a path off-thread.
  const importImageFromPath = (path: string, clientX: number, clientY: number, offset = 0) => {
    const canvasId = activeCanvasIdRef.current;
    const id = spawnImagePlaceholder(clientX, clientY, offset);
    void fillElementFromPath(id, path, canvasId);
  };

  // Clipboard paste: placeholder first, then store the bytes behind a spinner.
  const addImageFromBuffer = async (buffer: ArrayBuffer, clientX: number, clientY: number) => {
    const canvasId = activeCanvasIdRef.current;
    const id = spawnImagePlaceholder(clientX, clientY);
    setSelectedIds([id]);
    setImageLoading(id, true);
    try {
      // Yield so the placeholder + spinner paint before the base64 encode.
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const meta = await storeImageFromBytes(buffer);
      if (meta) {
        applyImageMeta(canvasId, id, meta);
      } else {
        removeImages([id], true, canvasId);
      }
    } finally {
      setImageLoading(id, false);
      finishHistoryTransaction(canvasId, imageHistoryTransaction(id), latestAppDataRef.current);
    }
  };

  imageDropOpsRef.current = {
    canvasPointFromEvent,
    looseImages,
    fillElementFromPath,
    importImageFromPath,
    addImageFromBuffer,
  };

  // OS file drop (Tauri native drag-drop). HTML5 ondrop does not receive files
  // while native drag-drop is enabled, so we listen on the webview instead and
  // store dropped image paths in Rust. A drop over an empty image placeholder
  // fills it; otherwise a new image element is created at the drop point.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") {
          return;
        }

        const ops = imageDropOpsRef.current;
        if (!ops) {
          return;
        }

        const { x, y } = event.payload.position;
        const paths = event.payload.paths.filter((path) =>
          /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(path),
        );
        if (paths.length === 0) {
          return;
        }

        const point = ops.canvasPointFromEvent({ clientX: x, clientY: y });
        const targetEmpty = [...ops.looseImages]
          .reverse()
          .find(
            (image) =>
              !image.imageId &&
              point.x >= image.x &&
              point.x <= image.x + image.width &&
              point.y >= image.y &&
              point.y <= image.y + image.height,
          );

        paths.forEach((path, index) => {
          if (targetEmpty && index === 0) {
            ops.fillElementFromPath(targetEmpty.id, path);
          } else {
            ops.importImageFromPath(path, x, y, index * 24);
          }
        });
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((error) => {
        console.error("Failed to register drag-drop listener", error);
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Clipboard paste of an image → new image element at the viewport center.
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const ops = imageDropOpsRef.current;
      if (!ops || !event.clipboardData) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      const item = Array.from(event.clipboardData.items).find((entry) =>
        entry.type.startsWith("image/"),
      );
      if (!item) {
        return;
      }

      const file = item.getAsFile();
      if (!file) {
        return;
      }

      event.preventDefault();
      file
        .arrayBuffer()
        .then((buffer) => {
          ops.addImageFromBuffer(buffer, window.innerWidth / 2, window.innerHeight / 2);
        })
        .catch((error) => {
          console.error("Failed to read pasted image", error);
        });
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Canvas menu "Image": drop an empty placeholder. The user fills it by
  // double-clicking inside (or dropping a file onto it).
  const createImageFromMenu = (clientX: number, clientY: number) => {
    createImageElement(clientX, clientY);
  };

  const toggleImageBackground = (id: string) => {
    setImages((current) =>
      current.map((image) =>
        image.id === id ? { ...image, background: image.background === false } : image,
      ),
    );
    closeContextMenus();
  };

  const copyImage = (image: ImageElement) => {
    if (copyContextSelection(image.id)) {
      return;
    }

    setCopiedItem({
      type: "image",
      item: {
        imageId: image.imageId,
        format: image.format,
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        accent: image.accent,
        background: image.background,
        extensions: cloneExtensions(image.extensions),
      },
    });
    closeContextMenus();
  };

  const createLooseTextCard = (
    clientX: number,
    clientY: number,
    text: string,
    kind?: TextCardElement["kind"],
    startEditing = true,
  ) => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const id = createEntityId(kind ?? "text-card");
    const card: TextCardElement = {
      id,
      kind,
      text,
      x: clamp(point.x, 0, canvasWidth),
      y: clamp(point.y, 0, canvasHeight),
      accent: kind === "mindmap" ? defaultElementColors.mindmap : defaultElementColors.textCard,
    };

    setTextCards((current) => [...current, card]);
    animateTextCardIn(id);
    if (startEditing) {
      setEditingTextCardId(id);
      setTextCardDraft(card.text);
    } else {
      setEditingTextCardId(null);
      setTextCardDraft("");
    }
    setSelectedIds([]);
    closeContextMenus();
    setRenamingId(null);
    return id;
  };

  const createTextCard = (clientX: number, clientY: number) => {
    createLooseTextCard(clientX, clientY, "Text card");
  };

  const createMindmap = (clientX: number, clientY: number) => {
    createLooseTextCard(clientX, clientY, "Mindmap", "mindmap");
  };

  const createTextBlock = (clientX: number, clientY: number) => {
    const point = canvasPointFromEvent({ clientX, clientY });
    const width = 320;
    const height = 220;
    const nextNumber = textBlocks.length + 1;
    const id = createEntityId("text-block");
    const element: TextBlockElement = {
      id,
      name: `Text block ${nextNumber}`,
      text: "Text block",
      x: clamp(point.x - width / 2, 0, canvasWidth - width),
      y: clamp(point.y - 28, 0, canvasHeight - height),
      width,
      height,
      accent: defaultElementColors.textBlock,
    };

    setTextBlocks((current) => [...current, element]);
    setSelectedIds([id]);
    animateTextBlockIn(id);
    setRenameDraft(element.name);
    setRenamingId(id);
    closeContextMenus();
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
  };

  const createTextCardInContainer = (containerId: string, clientX: number, clientY: number) => {
    const container = containersById.get(containerId);
    if (!container) {
      return;
    }

    const point = canvasPointFromEvent({ clientX, clientY });
    const id = createEntityId("text-card");
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

    setTextCards(nextCards);
    if (visibleIndex >= 0) {
      setContainerScrollOffsets((current) => ({
        ...current,
        [containerId]: getScrollOffsetForVisibleCardIndex(container, visibleIndex, nextCards),
      }));
    }
    animateTextCardIn(id);
    setEditingTextCardId(id);
    setTextCardDraft(card.text);
    setSelectedIds([]);
    closeContextMenus();
    setRenamingId(null);
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.target !== worldRef.current) {
      return;
    }

    setSelectedIds([]);
    closeContextMenus();
    setRenamingId(null);
    setClosingCanvasMenu(null);
    setCanvasMenu({ clientX: event.clientX, clientY: event.clientY });
  };

  const openContainerContentMenu = (
    event: React.MouseEvent<HTMLElement>,
    element: ContainerElement,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedIds([element.id]);
    closeContextMenus();
    setRenamingId(null);
    setClosingContainerContentMenu(null);
    setContainerContentMenu({
      containerId: element.id,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  const suppressContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const shouldStartPan = (event: PointerEvent<HTMLElement>) => {
    if (event.button === 1) {
      return true;
    }

    if (event.button !== 0 || !event.ctrlKey) {
      return false;
    }

    const target = event.target instanceof HTMLElement ? event.target : null;
    return !isEditableKeyboardTarget(target);
  };

  const startPan = (event: PointerEvent<HTMLElement>, stage: HTMLElement) => {
    event.preventDefault();
    event.stopPropagation();
    stage.setPointerCapture(event.pointerId);
    closeContextMenus();
    setRenamingId(null);
    showMinimap();
    interactionController.beginPan(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const handleMainPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (quickExtensionsMenu && !target?.closest("[data-quick-extensions-menu]")) {
      setQuickExtensionsMenu(null);
    }

    if (!target?.closest("[data-text-block-content]") && !isEditableKeyboardTarget(target)) {
      window.getSelection()?.removeAllRanges();
    }

    const focusedControl = target?.closest("button, [role='button'], a, select, [tabindex]");
    if (focusedControl instanceof HTMLElement && !isEditableKeyboardTarget(focusedControl)) {
      requestAnimationFrame(() => focusedControl.blur());
    }

    if (renamingId && !target?.closest("[data-container-rename-input]")) {
      saveRename(renamingId);
    }

    if ((event.target as HTMLElement | null)?.closest("[data-context-menu]")) {
      return;
    }

    closeContextMenus();
  };

  const handleStagePointerDownCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.ctrlKey || !shouldStartPan(event)) {
      return;
    }

    startPan(event, event.currentTarget);
  };

  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!shouldStartPan(event)) {
      return;
    }

    startPan(event, event.currentTarget);
  };

  const handleWorldPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== worldRef.current) {
      return;
    }

    event.preventDefault();
    closeContextMenus();
    if (editingTextCardId) {
      saveTextCardEdit(editingTextCardId);
    }
    if (editingTextBlockId) {
      saveTextBlockEdit(editingTextBlockId);
    }
    setRenamingId(null);
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    interactionController.beginSelection({
      pointerId: event.pointerId,
      screen: { x: event.clientX, y: event.clientY },
      candidates: interactionElements,
      additive: event.shiftKey,
    });
  };

  const startContainerContentSelection = (
    event: PointerEvent<HTMLElement>,
    container: ContainerElement,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    closeContextMenus();
    if (editingTextCardId) {
      saveTextCardEdit(editingTextCardId);
    }
    if (editingTextBlockId) {
      saveTextBlockEdit(editingTextBlockId);
    }
    setRenamingId(null);
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    const candidates = getContainerVisibleTextCards(container).flatMap((card) => {
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
    });
    interactionController.beginSelection({
      pointerId: event.pointerId,
      screen: { x: event.clientX, y: event.clientY },
      candidates,
      additive: event.shiftKey,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (mindmapConnectionDrag?.pointerId === event.pointerId) {
      const endpoint = getAvailableMindmapEndpoint(
        event.clientX,
        event.clientY,
        mindmapConnectionDrag.sourceId,
      );
      const targetBounds = endpoint ? getConnectableElementBounds(endpoint.id) : null;
      const target =
        endpoint && targetBounds
          ? getMindmapPortPoint(targetBounds, endpoint.port)
          : canvasPointFromEvent(event);
      setMindmapConnectionDrag((current) =>
        current
          ? {
              ...current,
              target,
              targetId: endpoint?.id,
              targetPort: endpoint?.port,
            }
          : current,
      );
      return;
    }
    interactionController.updatePointer({
      pointerId: event.pointerId,
      screen: { x: event.clientX, y: event.clientY },
      snapping: event.shiftKey,
    });
    const textCardPresentation = textCardInteraction.getSnapshot().active;
    if (textCardPresentation?.pointerId === event.pointerId) {
      const primaryPreview = interactionController
        .getSnapshot()
        .geometryPreviews.find(({ id }) => id === textCardPresentation.primaryId);
      if (primaryPreview) {
        textCardInteraction.update({
          pointerId: event.pointerId,
          screen: { x: event.clientX, y: event.clientY },
          world: canvasPointFromEvent(event),
          primaryGeometry: primaryPreview.geometry,
          shiftKey: event.shiftKey,
        });
      }
    }
  };
  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (mindmapConnectionDrag?.pointerId === event.pointerId) {
      const endpoint = getAvailableMindmapEndpoint(
        event.clientX,
        event.clientY,
        mindmapConnectionDrag.sourceId,
      );
      if (endpoint) {
        setMindmapConnections((current) => [
          ...current,
          {
            id: createEntityId("mindmap-connection"),
            sourceId: mindmapConnectionDrag.sourceId,
            sourcePort: mindmapConnectionDrag.sourcePort,
            targetId: endpoint.id,
            targetPort: endpoint.port,
          },
        ]);
      } else if (textCardsById.get(mindmapConnectionDrag.sourceId)?.kind === "mindmap") {
        const targetId = createLooseTextCard(
          event.clientX,
          event.clientY,
          "Mindmap",
          "mindmap",
          false,
        );
        const oppositePort: Record<MindmapPort, MindmapPort> = {
          left: "right",
          right: "left",
          top: "bottom",
          bottom: "top",
        };
        setMindmapConnections((current) => [
          ...current,
          {
            id: createEntityId("mindmap-connection"),
            sourceId: mindmapConnectionDrag.sourceId,
            sourcePort: mindmapConnectionDrag.sourcePort,
            targetId,
            targetPort: oppositePort[mindmapConnectionDrag.sourcePort],
          },
        ]);
      }
      setMindmapConnectionDrag(null);
      return;
    }
    handlePointerMove(event);
    interactionController.completePointer({
      pointerId: event.pointerId,
      screen: { x: event.clientX, y: event.clientY },
      snapping: event.shiftKey,
    });
    textCardInteraction.cancelActive(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const cancelDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (mindmapConnectionDrag?.pointerId === event.pointerId) {
      setMindmapConnectionDrag(null);
    }
    interactionController.cancelPointer(event.pointerId);
    textCardInteraction.cancelActive(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    closeContextMenus();
    setRenamingId(null);
    showMinimap();

    if (worldRef.current) {
      worldRef.current.style.willChange = "transform";
    }
    if (wheelLayerTimeoutRef.current !== null) {
      window.clearTimeout(wheelLayerTimeoutRef.current);
    }
    wheelLayerTimeoutRef.current = window.setTimeout(() => {
      wheelLayerTimeoutRef.current = null;
      if (worldRef.current) {
        worldRef.current.style.willChange = "";
      }
    }, 120);

    interactionController.wheelZoom({ x: event.clientX, y: event.clientY }, event.deltaY);
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

  const beginElementMove = (
    event: PointerEvent<HTMLElement>,
    id: string,
    commitThresholdScreen = 0,
    explicitTargetIds?: readonly string[],
    selectionAfterStart?: readonly string[],
    completionBehavior: "translate" | "place" = "translate",
    includeContainedCards = false,
    primaryGeometry?: ElementGeometry,
  ) => {
    if (event.button !== 0) return false;
    event.stopPropagation();
    if (event.shiftKey) {
      interactionController.select(id, true);
      closeContextMenus();
      return false;
    }
    if (isElementLocked(id)) {
      interactionController.setSelection([id]);
      closeContextMenus();
      return false;
    }
    const movingIds = explicitTargetIds ?? (selectedIds.includes(id) ? selectedIds : [id]);
    const targets = movingIds.flatMap((targetId) => {
      const target = getGestureElement(targetId, includeContainedCards);
      return target
        ? [targetId === id && primaryGeometry ? { ...target, geometry: primaryGeometry } : target]
        : [];
    });
    const stage = event.currentTarget.closest("[data-stage]") as HTMLElement | null;
    stage?.setPointerCapture(event.pointerId);
    if (selectionAfterStart) {
      interactionController.setSelection(selectionAfterStart);
    } else if (!selectedIds.includes(id)) {
      interactionController.setSelection([id]);
    }
    closeContextMenus();
    setRenamingId(null);
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
    return interactionController.beginMove({
      pointerId: event.pointerId,
      screen: { x: event.clientX, y: event.clientY },
      primaryId: id,
      targets,
      snapTargets: interactionElements.filter((candidate) => {
        const visibilityTarget =
          containersById.get(candidate.id) ?? textBlocksById.get(candidate.id);
        return !visibilityTarget || isElementVisible(visibilityTarget);
      }),
      commitThresholdScreen,
      completionBehavior,
    });
  };

  const startMove = (
    event: PointerEvent<HTMLElement>,
    element: ContainerElement | TextBlockElement,
  ) => {
    if (editingTextBlockId) saveTextBlockEdit(editingTextBlockId);
    beginElementMove(event, element.id);
  };

  const startMindmapConnection = (
    event: PointerEvent<HTMLButtonElement>,
    ownerId: string,
    port: MindmapPort,
  ) => {
    if (event.button !== 0 || !mindmapConnectionMode) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    const bounds = getConnectableElementBounds(ownerId);
    if (!bounds) return;
    const source = getMindmapPortPoint(bounds, port);
    setMindmapConnectionDrag({
      pointerId: event.pointerId,
      sourceId: ownerId,
      sourcePort: port,
      source,
      target: source,
    });
    closeContextMenus();
  };

  const startResize = (
    event: PointerEvent<HTMLButtonElement>,
    element: ContainerElement | TextBlockElement,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (isElementLocked(element.id)) return;
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    interactionController.setSelection([element.id]);
    closeContextMenus();
    setRenamingId(null);
    const target = getGestureElement(element.id);
    if (!target) return;
    const containerIds = new Set(elements.map(({ id }) => id));
    const textBlockIds = new Set(textBlocks.map(({ id }) => id));
    const visibleIds = new Set(
      [...elements, ...textBlocks].filter(isElementVisible).map(({ id }) => id),
    );
    interactionController.beginResize({
      pointerId: event.pointerId,
      screen: { x: event.clientX, y: event.clientY },
      target,
      constraints: {
        minimum: { width: MIN_WIDTH, height: MIN_HEIGHT },
        maximum: {
          width: canvasWidth - element.x,
          height: canvasHeight - element.y,
        },
      },
      snapTargets: filterLegacyResizeSnapTargets(interactionElements, {
        activeId: element.id,
        activeKind: containersById.has(element.id) ? "container" : "text-block",
        containerIds,
        textBlockIds,
        visibleIds,
      }),
    });
  };

  const startTextCardMove = (event: PointerEvent<HTMLElement>, card: TextCardElement) => {
    if (editingTextCardId === card.id) return;
    const usesGenericLooseGroup =
      !card.containerId && selectedIds.length > 1 && selectedIds.includes(card.id);
    if (usesGenericLooseGroup) {
      beginElementMove(event, card.id);
      return;
    }
    const movableIds = getLegacyTextCardDragIds(textCards, card.id, selectedIds);
    const startPosition = getTextCardStackPosition(card);
    const rect = event.currentTarget.getBoundingClientRect();
    const width = event.currentTarget.offsetWidth || rect.width / zoom;
    const height = event.currentTarget.offsetHeight || rect.height / zoom;
    const primaryGeometry = { x: startPosition.x, y: startPosition.y, width, height };
    const started = beginElementMove(
      event,
      card.id,
      3,
      movableIds.length > 0 ? movableIds : [card.id],
      movableIds.length > 1 ? movableIds : [],
      "place",
      true,
      primaryGeometry,
    );
    if (!started) return;
    const geometries = new Map<string, ElementGeometry>();
    movableIds.forEach((id) => {
      const target = getGestureElement(id, true);
      if (target) geometries.set(id, id === card.id ? primaryGeometry : target.geometry);
    });
    textCardInteraction.begin({
      pointerId: event.pointerId,
      primaryId: card.id,
      draggedIds: movableIds,
      cards: textCards,
      containers: elements.filter(isElementVisible),
      textBlocks: textBlocks.filter(isElementVisible),
      geometries,
      startScreen: { x: event.clientX, y: event.clientY },
      startWorld: canvasPointFromEvent(event),
      scrollOffsets: containerScrollOffsetsRef.current,
    });
  };
  const startImageMove = (event: PointerEvent<HTMLElement>, image: ImageElement) => {
    beginElementMove(event, image.id);
  };
  const startImageResize = (event: PointerEvent<HTMLButtonElement>, image: ImageElement) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (isElementLocked(image.id)) return;
    (event.currentTarget.closest("[data-stage]") as HTMLElement | null)?.setPointerCapture(
      event.pointerId,
    );
    interactionController.setSelection([image.id]);
    closeContextMenus();
    setRenamingId(null);
    const target = getGestureElement(image.id);
    if (!target) return;
    const aspectRatio = image.height > 0 ? image.width / image.height : 1;
    const containerIds = new Set(elements.map(({ id }) => id));
    const textBlockIds = new Set(textBlocks.map(({ id }) => id));
    const visibleIds = new Set(
      [...elements, ...textBlocks].filter(isElementVisible).map(({ id }) => id),
    );
    interactionController.beginResize({
      pointerId: event.pointerId,
      screen: { x: event.clientX, y: event.clientY },
      target,
      constraints: {
        minimum: { width: MIN_IMAGE_SIZE, height: MIN_IMAGE_SIZE / aspectRatio },
        maximum: {
          width: Math.min(canvasWidth - image.x, (canvasHeight - image.y) * aspectRatio),
          height: canvasHeight - image.y,
        },
        aspectRatio,
      },
      snapTargets: filterLegacyResizeSnapTargets(interactionElements, {
        activeId: image.id,
        activeKind: "image",
        containerIds,
        textBlockIds,
        visibleIds,
      }),
    });
  };
  const openImageMenu = (event: React.MouseEvent<HTMLElement>, image: ImageElement) => {
    event.preventDefault();
    event.stopPropagation();
    closeContextMenus();
    setRenamingId(null);
    if (!selectedIds.includes(image.id)) {
      setSelectedIds([image.id]);
    }
    setClosingImageMenu(null);
    setImageMenu({
      id: image.id,
      left: event.clientX + 8,
      top: event.clientY + 8,
    });
  };

  const openTextCardMenu = (event: React.MouseEvent<HTMLElement>, card: TextCardElement) => {
    event.preventDefault();
    event.stopPropagation();
    closeContextMenus();
    setRenamingId(null);
    setEditingTextCardId(null);
    if (!selectedIds.includes(card.id)) {
      setSelectedIds([card.id]);
    }
    setClosingTextCardMenu(null);
    setTextCardMenu({
      id: card.id,
      left: event.clientX + 8,
      top: event.clientY + 8,
    });
  };

  const startTextCardEdit = (card: TextCardElement) => {
    setTextCardDraft(card.text);
    setEditingTextCardId(card.id);
    closeContextMenus();
  };

  const saveTextCardEdit = (id: string) => {
    const nextText = textCardDraft.trim();
    if (nextText) {
      setTextCards((current) =>
        current.map((card) => (card.id === id ? { ...card, text: nextText } : card)),
      );
    }
    setEditingTextCardId(null);
    setTextCardDraft("");
    pulseTextCard(id);
  };

  const cancelTextCardEdit = () => {
    if (editingTextCardId) {
      pulseTextCard(editingTextCardId);
    }
    setEditingTextCardId(null);
    setTextCardDraft("");
  };

  const normalizeTextCardLink = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const windowsDrive = /^[a-zA-Z]:[\\/]/.test(trimmed);
    const uncPath = /^\\\\[^\\]/.test(trimmed);
    if (windowsDrive || uncPath) {
      return trimmed;
    }
    if (/^file:/i.test(trimmed)) {
      try {
        return decodeURIComponent(new URL(trimmed).pathname.replace(/^\/([a-zA-Z]:)/, "$1"));
      } catch {
        return undefined;
      }
    }

    const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(withProtocol);
      return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
        ? url.toString()
        : undefined;
    } catch {
      return undefined;
    }
  };

  const updateTextCardLink = (id: string, link: string) => {
    const normalizedLink = normalizeTextCardLink(link);
    setTextCards((current) =>
      current.map((card) =>
        card.id === id && card.kind !== "mindmap" ? { ...card, link: normalizedLink } : card,
      ),
    );
  };

  const openMindmapConnectionMenu = (
    event: PointerEvent<SVGPathElement>,
    connection: MindmapConnection,
  ) => {
    if (!mindmapConnectionMode) return;
    event.preventDefault();
    event.stopPropagation();
    closeContextMenus();
    setMindmapConnectionMenu({
      id: connection.id,
      left: event.clientX + 8,
      top: event.clientY + 8,
    });
  };

  const openTextBlockMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    element: TextBlockElement,
  ) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    if (!selectedIds.includes(element.id)) {
      selectCanvasElement(element);
    }
    setRenamingId(null);
    setRenameDraft(element.name);
    setEditingTextCardId(null);

    if (textBlockMenu?.id === element.id) {
      closeContextMenus();
      return;
    }

    closeContextMenus();
    setClosingTextBlockMenu(null);
    setTextBlockMenu({
      id: element.id,
      left: rect.right + 8,
      top: rect.top,
    });
  };

  const startTextBlockEdit = (element: TextBlockElement) => {
    setTextBlockDraft(element.text);
    setEditingTextBlockId(element.id);
    setSelectedIds([element.id]);
    setRenamingId(null);
    closeContextMenus();
  };

  const saveTextBlockEdit = (id: string) => {
    const nextText = textBlockDraft.trim();
    if (nextText) {
      setTextBlocks((current) =>
        current.map((element) => (element.id === id ? { ...element, text: nextText } : element)),
      );
    }
    setEditingTextBlockId(null);
    setTextBlockDraft("");
    pulseTextBlock(id);
  };

  const cancelTextBlockEdit = () => {
    if (editingTextBlockId) {
      pulseTextBlock(editingTextBlockId);
    }
    setEditingTextBlockId(null);
    setTextBlockDraft("");
  };

  const updateTextBlockAccent = (id: string, accent: string) => {
    setTextBlocks((current) =>
      current.map((element) => (element.id === id ? { ...element, accent } : element)),
    );
  };

  const updateTextBlockHeaderButtonsVisible = (id: string, visible: boolean) => {
    setTextBlocks((current) =>
      current.map((element) =>
        element.id === id ? { ...element, headerButtonsVisible: visible } : element,
      ),
    );
  };

  const toggleMenu = (event: React.MouseEvent<HTMLButtonElement>, element: ContainerElement) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    if (!selectedIds.includes(element.id)) {
      selectCanvasElement(element);
    }
    setRenamingId(null);
    setRenameDraft(element.name);

    if (containerMenu?.id === element.id) {
      closeContextMenus();
      return;
    }

    closeContextMenus();
    setClosingContainerMenu(null);
    setContainerMenu({
      id: element.id,
      left: rect.right + 8,
      top: rect.top,
    });
  };

  const startRename = (element: ContainerElement | TextBlockElement) => {
    setRenameDraft(element.name);
    setRenamingId(element.id);
    closeContextMenus();
  };

  const saveRename = (id: string) => {
    const nextName = renameDraft.trim();
    if (!nextName) {
      return;
    }

    setElements((current) =>
      current.map((element) => (element.id === id ? { ...element, name: nextName } : element)),
    );
    setTextBlocks((current) =>
      current.map((element) => (element.id === id ? { ...element, name: nextName } : element)),
    );
    setRenamingId(null);
    closeContextMenus();
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const getTextCardCopyPosition = (card: TextCardElement) => {
    const position = getTextCardRenderPosition(card) ?? getTextCardStackPosition(card);
    return { x: position.x, y: position.y };
  };

  const copyContextSelection = (id: string, actionIdsOverride?: string[]) => {
    if (!actionIdsOverride && !isMultiContextAction(id)) {
      return false;
    }

    const actionIds = actionIdsOverride ?? getContextActionIds(id);
    if (actionIds.length === 0) {
      return false;
    }
    const actionSet = new Set(actionIds);
    const selectedContainerIds = new Set(
      actionIds.filter((actionId) => containersById.has(actionId)),
    );

    setCopiedItem({
      type: "selection",
      item: {
        containers: elements
          .filter((element) => actionSet.has(element.id))
          .map((element) => ({
            sourceId: element.id,
            name: element.name,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            accent: element.accent,
            headerButtonsVisible: element.headerButtonsVisible,
            extensions: cloneExtensions(element.extensions),
            textCards: getOrderedContainerTextCards(element.id).map((card) => ({
              kind: card.kind,
              text: card.text,
              accent: card.accent,
              link: card.kind === "mindmap" ? undefined : card.link,
              order: card.order,
              extensions: cloneExtensions(card.extensions),
              sourceId: card.id,
            })),
          })),
        textCards: textCards
          .filter(
            (card) =>
              actionSet.has(card.id) &&
              (!card.containerId || !selectedContainerIds.has(card.containerId)),
          )
          .map((card) => {
            const position = getTextCardCopyPosition(card);
            return {
              kind: card.kind,
              sourceId: card.id,
              text: card.text,
              accent: card.accent,
              link: card.kind === "mindmap" ? undefined : card.link,
              x: position.x,
              y: position.y,
              order: card.order,
              extensions: cloneExtensions(card.extensions),
            };
          }),
        textBlocks: textBlocks
          .filter((element) => actionSet.has(element.id))
          .map((element) => ({
            sourceId: element.id,
            name: element.name,
            text: element.text,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            accent: element.accent,
            headerButtonsVisible: element.headerButtonsVisible,
            extensions: cloneExtensions(element.extensions),
          })),
        images: images
          .filter(
            (image) =>
              actionSet.has(image.id) &&
              (!image.containerId || !selectedContainerIds.has(image.containerId)),
          )
          .map((image) => ({
            sourceId: image.id,
            imageId: image.imageId,
            format: image.format,
            x: image.x,
            y: image.y,
            width: image.width,
            height: image.height,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            accent: image.accent,
            background: image.background,
            extensions: cloneExtensions(image.extensions),
          })),
        mindmapConnections: mindmapConnections
          .filter(
            (connection) =>
              actionSet.has(connection.sourceId) && actionSet.has(connection.targetId),
          )
          .map(({ sourceId, sourcePort, targetId, targetPort }) => ({
            sourceId,
            sourcePort,
            targetId,
            targetPort,
          })),
      },
    });
    closeContextMenus();
    return true;
  };

  const copyContainer = (element: ContainerElement) => {
    if (copyContextSelection(element.id)) {
      return;
    }

    setCopiedItem({
      type: "container",
      item: {
        name: element.name,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        accent: element.accent,
        headerButtonsVisible: element.headerButtonsVisible,
        extensions: cloneExtensions(element.extensions),
        textCards: getOrderedContainerTextCards(element.id).map((card) => ({
          kind: card.kind,
          text: card.text,
          accent: card.accent,
          link: card.kind === "mindmap" ? undefined : card.link,
          order: card.order,
          extensions: cloneExtensions(card.extensions),
          sourceId: card.id,
        })),
      },
    });
    closeContextMenus();
  };

  const copyTextCard = (card: TextCardElement) => {
    if (copyContextSelection(card.id)) {
      return;
    }

    const position = getTextCardCopyPosition(card);
    setCopiedItem({
      type: "text-card",
      item: {
        kind: card.kind,
        text: card.text,
        accent: card.accent,
        link: card.kind === "mindmap" ? undefined : card.link,
        x: position.x,
        y: position.y,
        extensions: cloneExtensions(card.extensions),
      },
    });
    closeContextMenus();
  };

  const copyTextBlock = (element: TextBlockElement) => {
    if (copyContextSelection(element.id)) {
      return;
    }

    setCopiedItem({
      type: "text-block",
      item: {
        name: element.name,
        text: element.text,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        accent: element.accent,
        headerButtonsVisible: element.headerButtonsVisible,
        extensions: cloneExtensions(element.extensions),
      },
    });
    closeContextMenus();
  };

  const pasteCopiedItem = (clientX: number, clientY: number, targetContainerId?: string) => {
    if (!copiedItem) {
      return;
    }

    const point = canvasPointFromEvent({ clientX, clientY });

    if (copiedItem.type === "container") {
      const copiedContainer = copiedItem.item;
      const pasteSeed = crypto.randomUUID();
      const id = `container-${pasteSeed}`;
      const textCardIdMap = new Map<string, string>(
        copiedContainer.textCards
          .filter((card) => card.sourceId)
          .map((card, index): [string, string] => [
            card.sourceId as string,
            `text-card-${pasteSeed}-${index}`,
          ]),
      );
      const duplicate = {
        ...copiedContainer,
        id,
        name: `${copiedContainer.name} copy`,
        x: clamp(point.x - copiedContainer.width / 2, 0, canvasWidth - copiedContainer.width),
        y: clamp(point.y - 28, 0, canvasHeight - copiedContainer.height),
        extensions: remapContainerExtensions(copiedContainer.extensions, textCardIdMap),
      };

      setElements((current) => [...current, duplicate]);
      const pastedTextCards = copiedContainer.textCards.map((card, index) => ({
        id: card.sourceId
          ? (textCardIdMap.get(card.sourceId) ?? `text-card-${pasteSeed}-${index}`)
          : `text-card-${pasteSeed}-${index}`,
        kind: card.kind,
        text: card.text,
        x: duplicate.x + CONTAINER_TEXT_CARD_PADDING,
        y:
          getContainerCardStackTop(duplicate) +
          index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
        accent: card.accent,
        link: card.kind === "mindmap" ? undefined : card.link,
        containerId: id,
        order: card.order ?? index,
        extensions: cloneExtensions(card.extensions),
      }));

      setTextCards((current) => [...current, ...pastedTextCards]);
      pastedTextCards.forEach((card) => animateTextCardIn(card.id));
      setSelectedIds([id]);
      animateContainerIn(id);
    } else if (copiedItem.type === "text-card") {
      const targetContainer =
        copiedItem.item.kind === "mindmap" || !targetContainerId
          ? null
          : containersById.get(targetContainerId);
      const id = createEntityId("text-card");
      const copiedExtensions = cloneExtensions(copiedItem.item.extensions);
      const duplicate = {
        ...copiedItem.item,
        link: copiedItem.item.kind === "mindmap" ? undefined : copiedItem.item.link,
        id,
        x: targetContainer ? targetContainer.x + CONTAINER_TEXT_CARD_PADDING : point.x,
        y: targetContainer ? getContainerCardStackTop(targetContainer) : point.y,
        containerId: targetContainer?.id,
        extensions: targetContainer?.extensions?.autoCheckbox
          ? addAutomaticCheckbox(copiedExtensions)
          : copiedExtensions,
      };

      if (targetContainer) {
        const order = getTextCardDropIndex(targetContainer, point, textCards, id);
        const cardsOutsideContainer = textCards.filter(
          (currentCard) => currentCard.containerId !== targetContainer.id,
        );
        const containerCards = getOrderedContainerTextCards(targetContainer.id);
        const cardInContainer = {
          ...duplicate,
          y:
            getContainerCardStackTop(targetContainer) +
            order * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
          order,
        };
        containerCards.splice(order, 0, cardInContainer);
        const nextCards = normalizeTextCardOrders([
          ...cardsOutsideContainer,
          ...containerCards.map((currentCard, index) => ({ ...currentCard, order: index })),
        ]);
        const visibleIndex = getContainerVisibleTextCards(targetContainer, nextCards).findIndex(
          (currentCard) => currentCard.id === id,
        );

        setTextCards(nextCards);
        if (visibleIndex >= 0) {
          setContainerScrollOffsets((current) => ({
            ...current,
            [targetContainer.id]: getScrollOffsetForVisibleCardIndex(
              targetContainer,
              visibleIndex,
              nextCards,
            ),
          }));
        }
      } else {
        setTextCards((current) => [...current, duplicate]);
      }
      animateTextCardIn(id);
      setSelectedIds([]);
    } else if (copiedItem.type === "text-block") {
      const copiedTextBlock = copiedItem.item;
      const id = createEntityId("text-block");
      const duplicate = {
        ...copiedTextBlock,
        id,
        name: `${copiedTextBlock.name} copy`,
        x: clamp(point.x - copiedTextBlock.width / 2, 0, canvasWidth - copiedTextBlock.width),
        y: clamp(point.y - 28, 0, canvasHeight - copiedTextBlock.height),
        extensions: cloneExtensions(copiedTextBlock.extensions),
      };

      setTextBlocks((current) => [...current, duplicate]);
      animateTextBlockIn(id);
      setSelectedIds([id]);
    } else if (copiedItem.type === "image") {
      const copiedImage = copiedItem.item;
      const id = createEntityId("image");
      const duplicate: ImageElement = {
        ...copiedImage,
        id,
        x: clamp(point.x - copiedImage.width / 2, 0, canvasWidth - copiedImage.width),
        y: clamp(point.y - copiedImage.height / 2, 0, canvasHeight - copiedImage.height),
        extensions: cloneExtensions(copiedImage.extensions),
      };

      setImages((current) => [...current, duplicate]);
      animateImageIn(id);
      setSelectedIds([id]);
    } else if (copiedItem.type === "selection") {
      const copiedSelection = copiedItem.item;
      const positionedItems = [
        ...copiedSelection.containers,
        ...copiedSelection.textCards,
        ...copiedSelection.textBlocks,
        ...copiedSelection.images,
      ].filter((item) => item.x !== undefined && item.y !== undefined);
      if (positionedItems.length === 0) {
        return;
      }
      const originX = Math.min(...positionedItems.map((item) => item.x ?? 0));
      const originY = Math.min(...positionedItems.map((item) => item.y ?? 0));
      const offsetX = point.x - originX;
      const offsetY = point.y - originY;
      const nextSelectedIds: string[] = [];
      const pasteSeed = crypto.randomUUID();
      const containerTextCardIdMaps = copiedSelection.containers.map(
        (container, containerIndex) =>
          new Map<string, string>(
            container.textCards
              .filter((card) => card.sourceId)
              .map((card, cardIndex): [string, string] => [
                card.sourceId as string,
                `text-card-${pasteSeed}-${containerIndex}-${cardIndex}`,
              ]),
          ),
      );

      const pastedContainers = copiedSelection.containers.map((container, index) => {
        const id = `container-${pasteSeed}-${index}`;
        nextSelectedIds.push(id);
        return {
          ...container,
          id,
          name: `${container.name} copy`,
          x: clamp((container.x ?? point.x) + offsetX, 0, canvasWidth - container.width),
          y: clamp((container.y ?? point.y) + offsetY, 0, canvasHeight - container.height),
          extensions: remapContainerExtensions(
            container.extensions,
            containerTextCardIdMaps[index],
          ),
        };
      });
      const pastedContainerCards = pastedContainers.flatMap((container, containerIndex) =>
        copiedSelection.containers[containerIndex].textCards.map((card, cardIndex) => ({
          id: card.sourceId
            ? (containerTextCardIdMaps[containerIndex].get(card.sourceId) ??
              `text-card-${pasteSeed}-${containerIndex}-${cardIndex}`)
            : `text-card-${pasteSeed}-${containerIndex}-${cardIndex}`,
          kind: card.kind,
          text: card.text,
          x: container.x + CONTAINER_TEXT_CARD_PADDING,
          y:
            getContainerCardStackTop(container) +
            cardIndex * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP),
          accent: card.accent,
          link: card.kind === "mindmap" ? undefined : card.link,
          containerId: container.id,
          order: card.order ?? cardIndex,
          extensions: cloneExtensions(card.extensions),
        })),
      );
      const pastedTextCards = copiedSelection.textCards.map((card, index) => {
        const id = `text-card-${pasteSeed}-selection-${index}`;
        nextSelectedIds.push(id);
        return {
          kind: card.kind,
          text: card.text,
          accent: card.accent,
          link: card.kind === "mindmap" ? undefined : card.link,
          id,
          x: clamp((card.x ?? point.x) + offsetX, 0, canvasWidth),
          y: clamp((card.y ?? point.y) + offsetY, 0, canvasHeight),
          order: card.order,
          extensions: cloneExtensions(card.extensions),
        };
      });
      const pastedTextBlocks = copiedSelection.textBlocks.map((block, index) => {
        const id = `text-block-${pasteSeed}-${index}`;
        nextSelectedIds.push(id);
        return {
          ...block,
          id,
          name: `${block.name} copy`,
          x: clamp((block.x ?? point.x) + offsetX, 0, canvasWidth - block.width),
          y: clamp((block.y ?? point.y) + offsetY, 0, canvasHeight - block.height),
          extensions: cloneExtensions(block.extensions),
        };
      });
      const pastedImages = copiedSelection.images.map((image, index) => {
        const id = `image-${pasteSeed}-${index}`;
        nextSelectedIds.push(id);
        return {
          ...image,
          id,
          x: clamp((image.x ?? point.x) + offsetX, 0, canvasWidth - image.width),
          y: clamp((image.y ?? point.y) + offsetY, 0, canvasHeight - image.height),
          extensions: cloneExtensions(image.extensions),
        };
      });
      const connectionEndpointIdMap = new Map<string, string>();
      copiedSelection.containers.forEach((container, index) => {
        if (container.sourceId) {
          connectionEndpointIdMap.set(container.sourceId, pastedContainers[index].id);
        }
      });
      copiedSelection.textBlocks.forEach((block, index) => {
        if (block.sourceId) {
          connectionEndpointIdMap.set(block.sourceId, pastedTextBlocks[index].id);
        }
      });
      copiedSelection.images.forEach((image, index) => {
        if (image.sourceId) {
          connectionEndpointIdMap.set(image.sourceId, pastedImages[index].id);
        }
      });
      const mindmapIdMap = new Map(
        copiedSelection.textCards.flatMap((card, index) =>
          card.kind === "mindmap" && card.sourceId
            ? [[card.sourceId, pastedTextCards[index].id] as const]
            : [],
        ),
      );
      mindmapIdMap.forEach((targetId, sourceId) => {
        connectionEndpointIdMap.set(sourceId, targetId);
      });
      const pastedMindmapConnections = copiedSelection.mindmapConnections.flatMap(
        (connection, index) => {
          const sourceId = connectionEndpointIdMap.get(connection.sourceId);
          const targetId = connectionEndpointIdMap.get(connection.targetId);
          return sourceId && targetId
            ? [
                {
                  id: `mindmap-connection-${pasteSeed}-${index}`,
                  sourceId,
                  sourcePort: connection.sourcePort,
                  targetId,
                  targetPort: connection.targetPort,
                },
              ]
            : [];
        },
      );

      setElements((current) => [...current, ...pastedContainers]);
      setTextCards((current) => [...current, ...pastedContainerCards, ...pastedTextCards]);
      setTextBlocks((current) => [...current, ...pastedTextBlocks]);
      setImages((current) => [...current, ...pastedImages]);
      setMindmapConnections((current) => [...current, ...pastedMindmapConnections]);
      pastedContainers.forEach((container) => animateContainerIn(container.id));
      [...pastedContainerCards, ...pastedTextCards].forEach((card) => animateTextCardIn(card.id));
      pastedTextBlocks.forEach((block) => animateTextBlockIn(block.id));
      pastedImages.forEach((image) => animateImageIn(image.id));
      setSelectedIds(nextSelectedIds);
    }

    setCopiedItem(null);
    closeContextMenus();
    setRenamingId(null);
  };

  const requestClearCanvas = () => {
    closeContextMenus();
    setClearModalOpen(true);
  };

  const clearCanvas = () => {
    const canvasId = activeCanvasIdRef.current;
    beginHistoryTransaction(canvasId, CLEAR_HISTORY_TRANSACTION);
    removeContainers(
      elements.map((element) => element.id),
      true,
    );
    removeTextCards(
      textCards.filter((card) => !card.containerId).map((card) => card.id),
      true,
    );
    removeTextBlocks(
      textBlocks.map((element) => element.id),
      true,
    );
    removeImages(
      images.filter((image) => !image.containerId).map((image) => image.id),
      true,
    );
    finishHistoryTransaction(canvasId, CLEAR_HISTORY_TRANSACTION, latestDataGetterRef.current());
    closeContextMenus();
    setRenamingId(null);
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
    setClearModalOpen(false);
  };

  const updateContainerAccent = (id: string, accent: string) => {
    setElements((current) =>
      current.map((element) =>
        element.id === id
          ? {
              ...element,
              accent,
            }
          : element,
      ),
    );
  };

  const updateContainerHeaderButtonsVisible = (id: string, visible: boolean) => {
    setElements((current) =>
      current.map((element) =>
        element.id === id ? { ...element, headerButtonsVisible: visible } : element,
      ),
    );
  };

  const getContextActionIds = (id: string) =>
    selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id];

  const isMultiContextAction = (id: string) => selectedIds.length > 1 && selectedIds.includes(id);

  const getSelectedExtensionState = (ids: string[]) => {
    const hasExtension = (id: string, key: keyof ElementExtensions) =>
      Boolean(
        (
          containersById.get(id) ??
          textBlocksById.get(id) ??
          textCardsById.get(id) ??
          imagesById.get(id)
        )?.extensions?.[key],
      );

    return {
      privacy: ids.some((id) => hasExtension(id, "privacy")),
      search: ids.some((id) => hasExtension(id, "search")),
      sorting: ids.some((id) => hasExtension(id, "sorting")),
      lock: ids.some((id) => hasExtension(id, "lock")),
      colorPicker: ids.some((id) => hasExtension(id, "colorPicker")),
      checkbox: ids.some((id) => hasExtension(id, "checkbox")),
      commandRunner: ids.some((id) => hasExtension(id, "commandRunner")),
      autoCheckbox: ids.some((id) => hasExtension(id, "autoCheckbox")),
      dailyReset: ids.some((id) => hasExtension(id, "dailyReset")),
      counter: ids.some((id) => hasExtension(id, "counter")),
      inheritCardColor: ids.some((id) => hasExtension(id, "inheritCardColor")),
      pickCard: ids.some((id) => hasExtension(id, "pickCard")),
      copyPasteJson: ids.some((id) => hasExtension(id, "copyPasteJson")),
    };
  };

  const getElementAccentForKind = (accent: string, kind: "text-card" | "other") => {
    const preset = ALL_ACCENT_PRESETS.find(
      (currentPreset) => currentPreset.accent === accent || currentPreset.textCardAccent === accent,
    );
    return kind === "text-card" ? (preset?.textCardAccent ?? accent) : (preset?.accent ?? accent);
  };

  const updateContextAccent = (id: string, accent: string) => {
    const actionIds = getContextActionIds(id);
    const actionSet = new Set(actionIds);

    setElements((current) =>
      current.map((element) =>
        actionSet.has(element.id)
          ? { ...element, accent: getElementAccentForKind(accent, "other") }
          : element,
      ),
    );
    setTextBlocks((current) =>
      current.map((element) =>
        actionSet.has(element.id)
          ? { ...element, accent: getElementAccentForKind(accent, "other") }
          : element,
      ),
    );
    setTextCards((current) =>
      current.map((card) =>
        actionSet.has(card.id)
          ? { ...card, accent: getElementAccentForKind(accent, "text-card") }
          : card,
      ),
    );
    setImages((current) =>
      current.map((image) =>
        actionSet.has(image.id)
          ? { ...image, accent: getElementAccentForKind(accent, "other") }
          : image,
      ),
    );
  };

  const stripContextExtension = (id: string, key: keyof ElementExtensions) => {
    const actionSet = new Set(getContextActionIds(id));
    const strip = <T extends { id: string; extensions?: ElementExtensions }>(item: T): T => {
      if (!actionSet.has(item.id) || !item.extensions?.[key]) {
        return item;
      }

      const { [key]: _removed, ...extensions } = item.extensions;
      return { ...item, extensions };
    };

    setElements((current) => current.map(strip));
    setTextBlocks((current) => current.map(strip));
    setTextCards((current) => current.map(strip));
    setImages((current) => current.map(strip));
    if (key === "search" || key === "sorting") {
      setContainerScrollOffsets((current) => {
        const next = { ...current };
        actionSet.forEach((actionId) => {
          next[actionId] = 0;
        });
        return next;
      });
    }
    if (
      key === "copyPasteJson" &&
      containerJsonEditor &&
      actionSet.has(containerJsonEditor.containerId)
    ) {
      setContainerJsonEditor(null);
    }
    if (
      key === "commandRunner" &&
      commandRunnerEditorCardId &&
      actionSet.has(commandRunnerEditorCardId)
    ) {
      setCommandRunnerEditorCardId(null);
    }
    closeContextMenus();
  };

  const deleteContextSelection = (id: string, actionIdsOverride?: string[]) => {
    const actionIds = actionIdsOverride ?? getContextActionIds(id);
    deleteCanvasSelection(actionIds);
    closeContextMenus();
    setRenamingId(null);
  };

  const cutUnlockedContextSelection = (id: string) => {
    if (!isMultiContextAction(id)) {
      return false;
    }

    const actionIds = getContextActionIds(id).filter(
      (actionId) => !isElementDeletionLocked(actionId),
    );
    if (actionIds.length > 0) {
      copyContextSelection(id, actionIds);
      deleteContextSelection(id, actionIds);
    }
    return true;
  };

  const cutContainer = (element: ContainerElement) => {
    if (cutUnlockedContextSelection(element.id)) {
      return;
    }
    if (isElementDeletionLocked(element.id)) {
      return;
    }
    copyContainer(element);
    deleteContextSelection(element.id);
  };

  const cutTextCard = (card: TextCardElement) => {
    if (cutUnlockedContextSelection(card.id)) {
      return;
    }
    if (isElementDeletionLocked(card.id)) {
      return;
    }
    copyTextCard(card);
    deleteContextSelection(card.id);
  };

  const cutTextBlock = (element: TextBlockElement) => {
    if (cutUnlockedContextSelection(element.id)) {
      return;
    }
    if (isElementDeletionLocked(element.id)) {
      return;
    }
    copyTextBlock(element);
    deleteContextSelection(element.id);
  };

  const cutImage = (image: ImageElement) => {
    if (cutUnlockedContextSelection(image.id)) {
      return;
    }
    if (isElementDeletionLocked(image.id)) {
      return;
    }
    copyImage(image);
    deleteContextSelection(image.id);
  };

  const copyKeyboardSelection = () => {
    if (selectedIds.length === 0) {
      return false;
    }
    if (selectedIds.length > 1) {
      return copyContextSelection(selectedIds[0], selectedIds);
    }

    const id = selectedIds[0];
    const container = containersById.get(id);
    if (container) {
      copyContainer(container);
      return true;
    }
    const card = textCardsById.get(id);
    if (card) {
      copyTextCard(card);
      return true;
    }
    const block = textBlocksById.get(id);
    if (block) {
      copyTextBlock(block);
      return true;
    }
    const image = imagesById.get(id);
    if (image) {
      copyImage(image);
      return true;
    }
    return false;
  };

  const clipboardShortcutActions = useStableCallbacks({
    copyKeyboardSelection,
    pasteKeyboardClipboard: () => {
      const { x, y } = lastPointerPositionRef.current;
      pasteCopiedItem(x, y);
    },
  });

  useEffect(() => {
    const handleClipboardShortcut = (event: KeyboardEvent) => {
      if (
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        isInteractiveKeyboardTarget(event.target as HTMLElement | null)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "c") {
        if (!clipboardShortcutActions.copyKeyboardSelection()) {
          return;
        }
      } else if (key === "v") {
        if (!copiedItem) {
          return;
        }
        clipboardShortcutActions.pasteKeyboardClipboard();
      } else {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", handleClipboardShortcut, true);
    return () => window.removeEventListener("keydown", handleClipboardShortcut, true);
  }, [clipboardShortcutActions, copiedItem]);

  const installExtensions = (extensionId: ExtensionId, ids: string[], replaceConflicts = false) => {
    const targetIds = new Set(
      ids.filter((id) => {
        const targetType = getExtensionTargetType(id);
        return targetType ? EXTENSION_COMPATIBLE_TARGETS[extensionId].has(targetType) : false;
      }),
    );
    if (targetIds.size === 0) {
      return false;
    }

    const conflictIds = EXTENSION_CONFLICTS[extensionId];
    if (!replaceConflicts && conflictIds.size > 0) {
      const presentConflicts = new Set<ExtensionId>();
      let affectedCount = 0;
      targetIds.forEach((id) => {
        const item =
          containersById.get(id) ??
          textBlocksById.get(id) ??
          textCardsById.get(id) ??
          imagesById.get(id);
        const itemConflicts = [...conflictIds].filter(
          (conflictId) => item?.extensions?.[conflictId] !== undefined,
        );
        if (itemConflicts.length > 0) {
          affectedCount += 1;
          itemConflicts.forEach((conflictId) => presentConflicts.add(conflictId));
        }
      });

      if (affectedCount > 0) {
        setPendingExtensionConflict({
          extensionId,
          targetIds: [...targetIds],
          conflictIds: [...presentConflicts],
          affectedCount,
        });
        closeContextMenus();
        return false;
      }
    }

    const install = <T extends { id: string; extensions?: ElementExtensions }>(item: T): T => {
      if (!targetIds.has(item.id)) {
        return item;
      }

      const extensions: ElementExtensions = { ...item.extensions };
      let changed = false;
      if (replaceConflicts) {
        conflictIds.forEach((conflictId) => {
          if (extensions[conflictId] !== undefined) {
            delete extensions[conflictId];
            changed = true;
          }
        });
      }
      if (extensions[extensionId] === undefined) {
        Object.assign(extensions, {
          [extensionId]: EXTENSION_REGISTRY[extensionId].createDefault(),
        });
        changed = true;
      }
      if (!changed) {
        return item;
      }

      return {
        ...item,
        extensions,
      } as T;
    };

    setElements((current) => current.map(install));
    setTextBlocks((current) => current.map(install));
    setTextCards((current) => current.map(install));
    setImages((current) => current.map(install));
    closeContextMenus();
    return true;
  };

  const getContainerJsonForAi = (id: string) => {
    const container = containersById.get(id);
    if (!container?.extensions?.copyPasteJson) {
      return null;
    }

    return serializeContainerForAi(container, getOrderedContainerTextCards(id));
  };

  const openContainerJsonEditor = (id: string) => {
    const json = getContainerJsonForAi(id);
    if (!json) {
      return;
    }

    setContainerJsonEditor({ containerId: id, initialJson: json });
  };

  const copyContainerJsonForAi = async (id: string) => {
    const json = getContainerJsonForAi(id);
    if (!json) {
      return;
    }

    try {
      await navigator.clipboard.writeText(json);
      showToast({
        tone: "success",
        title: "Container JSON copied",
        message: "Paste it into an AI, then copy only the returned JSON.",
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not copy JSON",
        message: commandErrorMessage(error),
      });
    }
  };

  const applyContainerJsonFromAi = (id: string, json: string) => {
    const container = containersById.get(id);
    if (!container?.extensions?.copyPasteJson) {
      return false;
    }

    const parsed = parseCopyPasteJson(json);
    if (!parsed.success) {
      showToast({
        tone: "error",
        title: "Invalid AI JSON",
        message: parsed.error,
        duration: 7000,
      });
      return false;
    }

    const replacedCardIds = new Set(
      textCards.filter((card) => card.containerId === id).map((card) => card.id),
    );
    setActiveCanvas(
      (current) =>
        replaceContainerFromAiJson(current, id, parsed.data, {
          createCardId: () => createEntityId("text-card"),
          headerHeight: CONTAINER_HEADER_HEIGHT,
          searchHeight: CONTAINER_SEARCH_HEIGHT,
          cardPadding: CONTAINER_TEXT_CARD_PADDING,
          cardRowHeight: CONTAINER_TEXT_CARD_ROW_HEIGHT,
          cardGap: CONTAINER_TEXT_CARD_GAP,
        }) ?? current,
    );
    setContainerScrollOffsets((current) => ({ ...current, [id]: 0 }));
    setSelectedIds((current) =>
      current.some((selectedId) => replacedCardIds.has(selectedId)) ? [id] : current,
    );
    if (editingTextCardId && replacedCardIds.has(editingTextCardId)) {
      setEditingTextCardId(null);
      setTextCardDraft("");
    }
    setRenamingId(null);
    showToast({
      tone: "success",
      title: "AI JSON applied",
      message: `${parsed.data.cards.length} ${parsed.data.cards.length === 1 ? "card" : "cards"} replaced.`,
    });
    return true;
  };

  const pasteContainerJsonFromAi = async (id: string) => {
    let clipboardText: string;
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not read clipboard",
        message: commandErrorMessage(error),
      });
      return;
    }

    applyContainerJsonFromAi(id, clipboardText);
  };

  const togglePrivacyExtension = (id: string) => {
    setElements((current) =>
      current.map((element) =>
        element.id === id && element.extensions?.privacy
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                privacy: {
                  enabled: !element.extensions.privacy.enabled,
                },
              },
            }
          : element,
      ),
    );
    setTextBlocks((current) =>
      current.map((element) =>
        element.id === id && element.extensions?.privacy
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                privacy: {
                  enabled: !element.extensions.privacy.enabled,
                },
              },
            }
          : element,
      ),
    );
  };

  const toggleLockExtension = (id: string) => {
    const source =
      containersById.get(id) ??
      textBlocksById.get(id) ??
      textCardsById.get(id) ??
      imagesById.get(id);
    if (!source?.extensions?.lock) {
      return;
    }

    const targetIds = new Set(
      selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id],
    );
    const nextEnabled = !source.extensions.lock.enabled;
    const toggle = <T extends { id: string; extensions?: ElementExtensions }>(item: T): T =>
      targetIds.has(item.id) && item.extensions?.lock
        ? {
            ...item,
            extensions: {
              ...item.extensions,
              lock: { enabled: nextEnabled },
            },
          }
        : item;
    setElements((current) => current.map(toggle));
    setTextBlocks((current) => current.map(toggle));
    setTextCards((current) => current.map(toggle));
    setImages((current) => current.map(toggle));
  };

  const togglePickedContainerCard = (id: string) => {
    const container = containersById.get(id);
    if (!container?.extensions?.pickCard) {
      return;
    }

    const selectedCardId = container.extensions.pickCard.selectedCardId;
    const lastCardId = container.extensions.pickCard.lastCardId;
    const allCards = getOrderedContainerTextCards(id);
    const availableCards = allCards.filter((card) => card.id !== lastCardId);
    const randomPool = availableCards.length > 0 ? availableCards : allCards;
    const nextSelectedCardId = selectedCardId
      ? undefined
      : randomPool[Math.floor(Math.random() * randomPool.length)]?.id;

    setElements((current) =>
      current.map((element) =>
        element.id === id && element.extensions?.pickCard
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                pickCard: {
                  selectedCardId: nextSelectedCardId,
                  lastCardId: selectedCardId ?? nextSelectedCardId ?? lastCardId,
                },
              },
            }
          : element,
      ),
    );
    setContainerScrollOffsets((current) => ({ ...current, [id]: 0 }));
    if (nextSelectedCardId) {
      window.requestAnimationFrame(() => glowTextCard(nextSelectedCardId));
    }
  };

  const toggleTextCardCheckbox = (id: string) => {
    setTextCards((current) =>
      current.map((card) =>
        card.id === id && card.extensions?.checkbox
          ? {
              ...card,
              extensions: {
                ...card.extensions,
                checkbox: {
                  checked: !card.extensions.checkbox.checked,
                },
              },
            }
          : card,
      ),
    );
  };

  const openCommandRunnerSettings = (id: string) => {
    if (!textCardsById.get(id)?.extensions?.commandRunner) {
      return;
    }
    closeContextMenus();
    setCommandRunnerEditorCardId(id);
  };

  const saveCommandRunnerSettings = (cardText: string, commands: CommandRunnerCommand[]) => {
    if (!commandRunnerEditorCardId) {
      return;
    }
    const cardId = commandRunnerEditorCardId;
    setTextCards((current) =>
      current.map((card) =>
        card.id === cardId && card.extensions?.commandRunner
          ? {
              ...card,
              text: cardText,
              extensions: {
                ...card.extensions,
                commandRunner: { commands },
              },
            }
          : card,
      ),
    );
  };

  const runTextCardCommands = async (id: string) => {
    const commands = textCardsById.get(id)?.extensions?.commandRunner?.commands ?? [];
    if (commands.length === 0) {
      return;
    }

    try {
      const results = await invoke<CommandStartResult[]>("run_saved_commands", { commands });
      const runIds = results.flatMap((result) =>
        result.started && result.runId ? [result.runId] : [],
      );
      if (runIds.length > 0) {
        setRunningCommandRuns((current) => ({ ...current, [id]: runIds }));
      }
      const failures = results.filter((result) => !result.started);
      if (failures.length === 0) {
        return;
      }

      showToast({
        tone: "error",
        title: `${failures.length} ${failures.length === 1 ? "command" : "commands"} could not start`,
        message: failures
          .map((failure) => {
            const command = commands[failure.index]?.command ?? "Unknown command";
            return `#${failure.index + 1} ${command}: ${failure.error ?? "Could not spawn"}`;
          })
          .join(" · "),
        duration: 7000,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not run saved commands",
        message: commandErrorMessage(error),
      });
    }
  };

  const stopTextCardCommands = async (id: string) => {
    const runIds = runningCommandRuns[id] ?? [];
    if (runIds.length === 0) return;
    setRunningCommandRuns((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    try {
      await invoke("stop_saved_commands", { runIds });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not stop saved commands",
        message: commandErrorMessage(error),
      });
    }
  };

  const updateContainerSearchQuery = (id: string, query: string) => {
    setElements((current) =>
      current.map((element) =>
        element.id === id && element.extensions?.search
          ? {
              ...element,
              extensions: {
                ...element.extensions,
                search: {
                  query,
                },
              },
            }
          : element,
      ),
    );
    setContainerScrollOffsets((current) => ({
      ...current,
      [id]: 0,
    }));
  };

  const setContainerSort = (
    id: string,
    mode: "alphabet" | "color" | null,
    direction: "asc" | "desc" = "asc",
  ) => {
    setElements((current) =>
      current.map((element) => {
        const sorting = element.extensions?.sorting;
        if (element.id !== id || !sorting) {
          return element;
        }

        return {
          ...element,
          extensions: {
            ...element.extensions,
            sorting: { mode, direction },
          },
        };
      }),
    );
    setContainerScrollOffsets((current) => ({
      ...current,
      [id]: 0,
    }));
  };

  const showExtensionDropRipple = (
    extensionId: ExtensionId,
    point: { x: number; y: number },
    target: ExtensionDropRipple["target"],
    bounds: ExtensionRippleBounds,
  ) => {
    const id = `extension-ripple-${Date.now()}-${Math.round(point.x)}-${Math.round(point.y)}`;
    setExtensionDropRipples((current) => [
      ...current,
      {
        id,
        extensionId,
        target,
        offsetX: point.x - bounds.left,
        offsetY: point.y - bounds.top,
        bounds,
      },
    ]);
    window.setTimeout(() => {
      setExtensionDropRipples((current) => current.filter((ripple) => ripple.id !== id));
    }, 620);
  };

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

  const getExtensionRippleTarget = (id: string): ExtensionDropRipple["target"] | null => {
    const targetType = getExtensionTargetType(id);
    if (!targetType) {
      return null;
    }

    return { type: targetType, id };
  };

  const getExtensionTargetBounds = (
    target: ExtensionDropRipple["target"],
  ): ExtensionRippleBounds | null => {
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

  const getExtensionDropTargetIds = (
    extensionId: ExtensionId,
    target: ExtensionDropRipple["target"],
  ) => {
    if (!selectedIds.includes(target.id) || selectedIds.length <= 1) {
      return [target.id];
    }

    return selectedIds.filter((id) => {
      const targetType = getExtensionTargetType(id);
      return targetType ? EXTENSION_COMPATIBLE_TARGETS[extensionId].has(targetType) : false;
    });
  };

  const applyDroppedExtension = (
    extensionId: ExtensionId,
    point: { x: number; y: number },
    target: ExtensionDropRipple["target"],
    bounds: ExtensionRippleBounds,
  ) => {
    const targetIds = getExtensionDropTargetIds(extensionId, target);
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

        showExtensionDropRipple(extensionId, ripplePoint, rippleTarget, rippleBounds);
      });
    };

    if (extensionId === "checkbox") {
      window.requestAnimationFrame(showDropRipples);
    } else {
      showDropRipples();
    }
  };

  const dropExtensionOnCanvas = (extensionId: ExtensionId, clientX: number, clientY: number) => {
    const point = canvasPointFromEvent({ clientX, clientY });
    if (extensionId === "lock") {
      const targetImage = [...looseImages]
        .reverse()
        .find(
          (image) =>
            point.x >= image.x &&
            point.x <= image.x + image.width &&
            point.y >= image.y &&
            point.y <= image.y + image.height,
        );

      if (targetImage) {
        applyDroppedExtension(
          extensionId,
          point,
          { type: "image", id: targetImage.id },
          {
            left: targetImage.x,
            top: targetImage.y,
            width: targetImage.width,
            height: targetImage.height,
          },
        );
        return;
      }
    }

    if (
      extensionId === "lock" ||
      extensionId === "colorPicker" ||
      extensionId === "checkbox" ||
      extensionId === "commandRunner"
    ) {
      const targetTextCard = [...looseTextCards].reverse().find((card) => {
        const targetType = card.kind === "mindmap" ? "mindmap" : "text-card";
        if (!EXTENSION_COMPATIBLE_TARGETS[extensionId].has(targetType)) {
          return false;
        }
        const bounds = getTextCardRippleBounds(card) ?? getLooseTextCardSelectionBounds(card);
        return (
          point.x >= bounds.left &&
          point.x <= bounds.left + bounds.width &&
          point.y >= bounds.top &&
          point.y <= bounds.top + bounds.height
        );
      });

      if (targetTextCard) {
        const bounds = getTextCardRippleBounds(targetTextCard);
        const targetType = getExtensionTargetType(targetTextCard.id);
        if (bounds && (targetType === "text-card" || targetType === "mindmap")) {
          applyDroppedExtension(
            extensionId,
            point,
            { type: targetType, id: targetTextCard.id },
            bounds,
          );
        }
        return;
      }

      const targetContainerCard = [...elements]
        .reverse()
        .flatMap((container) => {
          const contentTop =
            container.y +
            CONTAINER_HEADER_HEIGHT +
            (container.extensions?.search ? CONTAINER_SEARCH_HEIGHT : 0);
          const contentBottom = container.y + container.height;
          const cardWidth = Math.max(120, container.width - CONTAINER_TEXT_CARD_PADDING * 2);

          return getContainerVisibleTextCards(container)
            .map((card, index) => {
              const measuredBounds = getTextCardRippleBounds(card);
              const fallbackTop =
                getContainerCardStackTop(container) +
                index * (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
                getContainerScrollOffset(container);

              return {
                card,
                left: measuredBounds?.left ?? container.x + CONTAINER_TEXT_CARD_PADDING,
                top: measuredBounds?.top ?? fallbackTop,
                width: measuredBounds?.width ?? cardWidth,
                height: measuredBounds?.height ?? CONTAINER_TEXT_CARD_ROW_HEIGHT,
                visibleTop: contentTop,
                visibleBottom: contentBottom,
              };
            })
            .reverse();
        })
        .find(
          ({ left, top, width, height, visibleTop, visibleBottom }) =>
            top < visibleBottom &&
            top + height > visibleTop &&
            point.x >= left &&
            point.x <= left + width &&
            point.y >= Math.max(top, visibleTop) &&
            point.y <= Math.min(top + height, visibleBottom),
        )?.card;

      if (targetContainerCard) {
        const bounds = getTextCardRippleBounds(targetContainerCard);
        if (bounds) {
          applyDroppedExtension(
            extensionId,
            point,
            { type: "text-card", id: targetContainerCard.id },
            bounds,
          );
        }
        return;
      }
    }

    if (extensionId === "privacy" || extensionId === "colorPicker" || extensionId === "lock") {
      const targetTextBlock = [...textBlocks]
        .reverse()
        .find(
          (element) =>
            point.x >= element.x &&
            point.x <= element.x + element.width &&
            point.y >= element.y &&
            point.y <= element.y + element.height,
        );

      if (targetTextBlock) {
        applyDroppedExtension(
          extensionId,
          point,
          { type: "text-block", id: targetTextBlock.id },
          {
            left: targetTextBlock.x,
            top: targetTextBlock.y,
            width: targetTextBlock.width,
            height: targetTextBlock.height,
          },
        );
        return;
      }
    }

    const targetContainer = [...elements]
      .reverse()
      .find(
        (element) =>
          point.x >= element.x &&
          point.x <= element.x + element.width &&
          point.y >= element.y &&
          point.y <= element.y + element.height,
      );

    if (targetContainer && EXTENSION_COMPATIBLE_TARGETS[extensionId].has("container")) {
      applyDroppedExtension(
        extensionId,
        point,
        { type: "container", id: targetContainer.id },
        {
          left: targetContainer.x,
          top: targetContainer.y,
          width: targetContainer.width,
          height: targetContainer.height,
        },
      );
    }
  };

  const resetZoom = () => {
    interactionController.resetZoom();
    showMinimap();
  };

  const applyAppData = (data: unknown, recordHistory = true, preserveCamera = false) => {
    applyingHistoryRef.current = !recordHistory;
    pendingDeletionTimeoutsRef.current.forEach((timeouts) =>
      timeouts.forEach((timeout) => window.clearTimeout(timeout)),
    );
    pendingDeletionTimeoutsRef.current.clear();
    pendingCanvasDeletionsRef.current.clear();
    historyTransactionsRef.current.clear();
    dirtyHistoryTransactionsRef.current.clear();

    const normalized = normalizeAppData(data, getWindowPreviewViewport);
    const selectedCanvas =
      normalized.canvases.find((canvas) => canvas.id === normalized.activeCanvasId) ??
      normalized.canvases[0] ??
      DEFAULT_CANVAS;

    const currentCameraByCanvasId = new Map(
      latestAppDataRef.current.canvases.map((canvas) => [
        canvas.id,
        {
          pan: canvas.id === activeCanvas.id ? latestCameraRef.current.pan : canvas.pan,
          zoom: canvas.id === activeCanvas.id ? latestCameraRef.current.zoom : canvas.zoom,
          previewViewport: canvas.previewViewport,
        },
      ]),
    );
    const nextCanvases = normalized.canvases.length ? normalized.canvases : [DEFAULT_CANVAS];
    const cameraPreservedCanvases = preserveCamera
      ? nextCanvases.map((canvas) => {
          const currentCamera = currentCameraByCanvasId.get(canvas.id);

          return currentCamera
            ? {
                ...canvas,
                pan: currentCamera.pan,
                zoom: currentCamera.zoom,
                previewViewport: currentCamera.previewViewport,
              }
            : canvas;
        })
      : nextCanvases;
    const cameraPreservedSelectedCanvas =
      cameraPreservedCanvases.find((canvas) => canvas.id === selectedCanvas.id) ?? selectedCanvas;

    activeCanvasIdRef.current = cameraPreservedSelectedCanvas.id;
    setCanvases(cameraPreservedCanvases);
    setActiveCanvas(cameraPreservedSelectedCanvas);
    setCanvasGridStyle(normalized.canvasGridStyle);
    setCanvasGridOpacity(normalized.canvasGridOpacity);
    setDefaultElementColors(normalized.defaultElementColors);
    setRecentColors(normalized.recentColors);
    setShadowsUnderElements(normalized.shadowsUnderElements);
    setAllowLockedElementDeletion(normalized.allowLockedElementDeletion);
    setDiscordRpcEnabled(normalized.discordRpcEnabled);
    setDiscordRpcShowCanvas(normalized.discordRpcShowCanvas);
    setMinimapEnabled(normalized.minimapEnabled);
    setPrivacyModeEnabled(normalized.privacyModeEnabled);
    setToolbarButtonsVisible(normalized.toolbarButtonsVisible);
    setDismissedUpdateVersion(normalized.dismissedUpdateVersion);
    setSelectedIds([]);
    setRenamingId(null);
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
    setCopiedItem(null);
    closeContextMenus();

    if (recordHistory) {
      const initialHistory = createInitialCanvasHistory(selectedCanvas);
      historyRef.current = initialHistory.historyByCanvasId;
      historyIndexRef.current = initialHistory.historyIndexByCanvasId;
      updateHistoryState(selectedCanvas.id);
    } else {
      window.setTimeout(() => {
        applyingHistoryRef.current = false;
      }, 0);
    }
  };

  const applyActiveCanvasHistorySnapshot = (snapshot: TaskCanvas) => {
    applyingHistoryRef.current = true;
    cancelPendingDeletionCommits(activeCanvas.id);
    cancelHistoryTransactions(activeCanvas.id);

    const currentActiveCanvas = latestAppDataRef.current.canvases.find(
      (canvas) => canvas.id === activeCanvas.id,
    );
    const nextCanvas = {
      ...snapshot,
      pan: latestCameraRef.current.pan,
      zoom: latestCameraRef.current.zoom,
      previewViewport: currentActiveCanvas?.previewViewport,
    };

    setCanvases((current) =>
      current.map((canvas) => (canvas.id === activeCanvas.id ? nextCanvas : canvas)),
    );
    setSelectedIds([]);
    setRenamingId(null);
    setEditingTextCardId(null);
    setEditingTextBlockId(null);
    setCopiedItem(null);
    closeContextMenus();

    window.setTimeout(() => {
      applyingHistoryRef.current = false;
    }, 0);
  };

  const undo = () => {
    const canvasId = activeCanvas.id;
    cancelHistoryTransactions(canvasId);
    commitHistorySnapshot(canvasId);
    const history = historyRef.current[canvasId] ?? [];
    const historyIndex = historyIndexRef.current[canvasId] ?? -1;

    if (historyIndex <= 0) {
      return;
    }

    const nextHistoryIndex = historyIndex - 1;
    historyIndexRef.current = {
      ...historyIndexRef.current,
      [canvasId]: nextHistoryIndex,
    };
    applyActiveCanvasHistorySnapshot(cloneCanvas(history[nextHistoryIndex]));
    updateHistoryState(canvasId);
  };

  const redo = () => {
    const canvasId = activeCanvas.id;
    cancelHistoryTransactions(canvasId);
    commitHistorySnapshot(canvasId);
    const history = historyRef.current[canvasId] ?? [];
    const historyIndex = historyIndexRef.current[canvasId] ?? -1;

    if (historyIndex < 0 || historyIndex >= history.length - 1) {
      return;
    }

    const nextHistoryIndex = historyIndex + 1;
    historyIndexRef.current = {
      ...historyIndexRef.current,
      [canvasId]: nextHistoryIndex,
    };
    applyActiveCanvasHistorySnapshot(cloneCanvas(history[nextHistoryIndex]));
    updateHistoryState(canvasId);
  };

  const historyActions = useStableCallbacks({ redo, undo });

  useEffect(() => {
    const handleHistoryKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const modalOpen =
        settingsOpen ||
        clearModalOpen ||
        updateModalOpen ||
        isModalPresenceBlocking() ||
        Boolean(pendingExtensionConflict);

      if (
        isInteractiveKeyboardTarget(target) ||
        modalOpen ||
        target?.closest("[role='dialog'], [aria-modal='true']") ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey
      ) {
        return;
      }

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          historyActions.redo();
        } else {
          historyActions.undo();
        }
        return;
      }

      if (event.key.toLowerCase() === "y" && !event.shiftKey) {
        event.preventDefault();
        historyActions.redo();
      }
    };

    window.addEventListener("keydown", handleHistoryKeyDown);
    return () => window.removeEventListener("keydown", handleHistoryKeyDown);
  }, [clearModalOpen, historyActions, pendingExtensionConflict, settingsOpen, updateModalOpen]);

  const exportData = (password: string) =>
    invoke<boolean>("export_app_data", {
      data: getCurrentAppData(),
      password,
    });

  const importData = async (file: File, password: string) => {
    cancelAutosave();
    await persistenceQueueRef.current.catch(() => undefined);
    const payload = await file.text();
    const data = await invoke<unknown>("import_app_data", { payload, password });
    dirtyCanvasVersionsRef.current.clear();
    applyAppData(data);
    setStorageError(null);
  };

  const resetLocalDatabase = async () => {
    cancelAutosave();
    await persistenceQueueRef.current.catch(() => undefined);
    await invoke("reset_local_database");
    const data: AppData = {
      schemaVersion: 2,
      activeCanvasId: DEFAULT_CANVAS.id,
      canvases: [DEFAULT_CANVAS],
      canvasGridStyle: "dots",
      canvasGridOpacity: DEFAULT_GRID_OPACITY,
      defaultElementColors: DEFAULT_ELEMENT_COLORS,
      recentColors: [],
      shadowsUnderElements: false,
      allowLockedElementDeletion: true,
      discordRpcEnabled: false,
      discordRpcShowCanvas: true,
      minimapEnabled: true,
      privacyModeEnabled: false,
      toolbarButtonsVisible: false,
    };

    latestAppDataRef.current = data;
    dirtyCanvasVersionsRef.current.clear();
    applyAppData(data);
    setStorageError(null);
    setAppDataLoaded(true);
    appDataLoadedRef.current = true;
    await persistAppData(data, true);
  };

  const createCanvas = (draft: Pick<TaskCanvas, "name" | "width" | "height">) => {
    recordHistorySnapshot(getCurrentAppData(), activeCanvas.id);
    const currentCanvases = getPersistedCanvases();
    cancelPendingDeletionCommits(activeCanvas.id);
    const width = clampCanvasSize(draft.width);
    const height = clampCanvasSize(draft.height);
    const canvas: TaskCanvas = {
      id: createEntityId("canvas"),
      name: draft.name.trim() || "Untitled canvas",
      width,
      height,
      containers: [],
      textCards: [],
      textBlocks: [],
      images: [],
      mindmapConnections: [],
      pan: DEFAULT_PAN,
      zoom: 1,
      previewViewport: {
        width: stageRef.current?.clientWidth ?? window.innerWidth,
        height: stageRef.current?.clientHeight ?? window.innerHeight,
      },
    };

    const nextCanvases = [...currentCanvases, canvas];
    activeCanvasIdRef.current = canvas.id;
    setCanvases(nextCanvases);
    setActiveCanvas(canvas);
    setSelectedIds([]);
    setRenamingId(null);
    closeContextMenus();
  };

  const selectCanvas = (id: string) => {
    if (id === activeCanvas.id) {
      return;
    }

    recordHistorySnapshot(getCurrentAppData(), activeCanvas.id);
    const currentCanvases = getPersistedCanvases();
    const nextCanvas = currentCanvases.find((canvas) => canvas.id === id);
    if (!nextCanvas) {
      return;
    }

    cancelPendingDeletionCommits(activeCanvas.id);
    activeCanvasIdRef.current = nextCanvas.id;
    setCanvases(currentCanvases);
    setActiveCanvas(nextCanvas);
    setSelectedIds([]);
    setDeletingIds([]);
    setDeletingTextCardIds([]);
    setDeletingTextBlockIds([]);
    setDeletingImageIds([]);
    setRenamingId(null);
    closeContextMenus();
  };

  const updateCanvas = (id: string, updates: Pick<TaskCanvas, "name" | "width" | "height">) => {
    const details = {
      ...updates,
      width: clampCanvasSize(updates.width),
      height: clampCanvasSize(updates.height),
    };
    const applyUpdate = (canvas: TaskCanvas) =>
      canvas.id === id ? updateCanvasDetails(canvas, details) : canvas;

    markCanvasDirty(id);
    setCanvases((current) => current.map(applyUpdate));
    const latestData = latestDataGetterRef.current();
    const nextData = {
      ...latestData,
      canvases: latestData.canvases.map(applyUpdate),
    };
    latestAppDataRef.current = nextData;
    recordHistorySnapshot(nextData, id);
  };

  const deleteCanvas = (id: string) => {
    recordHistorySnapshot(getCurrentAppData(), activeCanvas.id);
    const currentCanvases = getPersistedCanvases();
    if (currentCanvases.length <= 1) {
      return;
    }

    if (id === activeCanvas.id) {
      cancelPendingDeletionCommits(activeCanvas.id);
    }

    const nextCanvases = currentCanvases.filter((canvas) => canvas.id !== id);
    const nextActiveCanvas =
      id === activeCanvas.id
        ? nextCanvases[Math.max(currentCanvases.findIndex((canvas) => canvas.id === id) - 1, 0)]
        : activeCanvas;

    delete historyRef.current[id];
    delete historyIndexRef.current[id];
    cancelHistoryTransactions(id);
    pendingCanvasDeletionsRef.current.delete(id);
    dirtyCanvasVersionsRef.current.delete(id);

    setCanvases(nextCanvases);

    if (nextActiveCanvas.id !== activeCanvas.id) {
      activeCanvasIdRef.current = nextActiveCanvas.id;
      setActiveCanvas(nextActiveCanvas);
      setSelectedIds([]);
      setRenamingId(null);
      closeContextMenus();
    }
  };

  const reorderCanvases = (orderedIds: string[]) => {
    const currentCanvases = getPersistedCanvases();
    const nextCanvases = orderedIds
      .map((id) => currentCanvases.find((canvas) => canvas.id === id))
      .filter((canvas): canvas is TaskCanvas => Boolean(canvas));
    const missingCanvases = currentCanvases.filter((canvas) => !orderedIds.includes(canvas.id));

    if (nextCanvases.length === 0) {
      return;
    }

    nextCanvases.push(...missingCanvases);
    setCanvases(nextCanvases);
  };

  const getCanvasCycleOrder = () => {
    const currentCanvases = getPersistedCanvases();
    return currentCanvases.map((canvas) => canvas.id);
  };

  const getCurrentLeftPanelState = (): LeftPanelState => {
    if (canvasManagerOpen && !canvasManagerClosing) {
      return "canvases";
    }

    if (extensionsOpen && !extensionsClosing) {
      return "extensions";
    }

    return "closed";
  };

  const restoreLeftPanelState = (state: LeftPanelState) => {
    if (panelSwitchTimeoutRef.current !== null) {
      window.clearTimeout(panelSwitchTimeoutRef.current);
      panelSwitchTimeoutRef.current = null;
    }

    if (state === "canvases") {
      setExtensionsOpen(false);
      setExtensionsClosing(false);
      setCanvasManagerOpen(true);
      setCanvasManagerClosing(false);
      return;
    }

    if (state === "extensions") {
      setCanvasManagerOpen(false);
      setCanvasManagerClosing(false);
      setExtensionsOpen(true);
      setExtensionsClosing(false);
      return;
    }

    setExtensionsOpen(false);
    setExtensionsClosing(false);
    setCanvasManagerClosing(true);
    window.setTimeout(() => {
      setCanvasManagerOpen(false);
      setCanvasManagerClosing(false);
    }, CANVAS_MANAGER_ANIMATION_MS);
  };

  const finishCanvasCycle = () => {
    const restorePanelState = canvasCycleSessionRef.current?.previousPanelState ?? "closed";
    canvasCycleSessionRef.current = null;
    setCanvasCycleHighlightId(null);

    if (canvasCycleRestoreTimeoutRef.current !== null) {
      window.clearTimeout(canvasCycleRestoreTimeoutRef.current);
    }

    canvasCycleRestoreTimeoutRef.current = window.setTimeout(() => {
      restoreLeftPanelState(restorePanelState);
      canvasCycleRestoreTimeoutRef.current = null;
    }, CANVAS_CYCLE_PANEL_RESTORE_DELAY_MS);
  };

  const cycleCanvases = (direction: 1 | -1) => {
    const session = canvasCycleSessionRef.current;
    const order = session?.order ?? getCanvasCycleOrder();
    if (order.length <= 1) {
      return;
    }

    const currentIndex = session?.index ?? Math.max(0, order.indexOf(activeCanvas.id));
    const nextIndex = (currentIndex + direction + order.length) % order.length;
    const nextCanvasId = order[nextIndex];
    if (!nextCanvasId) {
      return;
    }

    canvasCycleSessionRef.current = {
      order,
      index: nextIndex,
      previousPanelState: session?.previousPanelState ?? getCurrentLeftPanelState(),
    };

    if (panelSwitchTimeoutRef.current !== null) {
      window.clearTimeout(panelSwitchTimeoutRef.current);
      panelSwitchTimeoutRef.current = null;
    }
    if (canvasCycleRestoreTimeoutRef.current !== null) {
      window.clearTimeout(canvasCycleRestoreTimeoutRef.current);
      canvasCycleRestoreTimeoutRef.current = null;
    }

    setQuickExtensionsMenu(null);
    setCanvasCycleHighlightId(nextCanvasId);
    setExtensionsOpen(false);
    setExtensionsClosing(false);
    setCanvasManagerOpen(true);
    setCanvasManagerClosing(false);
    selectCanvas(nextCanvasId);
  };

  const canvasCycleActions = useStableCallbacks({ cycleCanvases, finishCanvasCycle });

  useEffect(() => {
    const handleCtrlTab = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== "Tab" ||
        !event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableKeyboardTarget(target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      canvasCycleActions.cycleCanvases(event.shiftKey ? -1 : 1);
    };
    const handleCtrlRelease = (event: KeyboardEvent) => {
      if (
        (event.key === "Control" || event.key === "ControlLeft" || event.key === "ControlRight") &&
        canvasCycleSessionRef.current
      ) {
        canvasCycleActions.finishCanvasCycle();
      }
    };

    window.addEventListener("keydown", handleCtrlTab, true);
    window.addEventListener("keyup", handleCtrlRelease, true);
    return () => {
      window.removeEventListener("keydown", handleCtrlTab, true);
      window.removeEventListener("keyup", handleCtrlRelease, true);
    };
  }, [canvasCycleActions]);

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

  const updateDiscordRpcEnabled = (enabled: boolean) => {
    setDiscordRpcEnabled(enabled);
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

  const canvasNodeActions = useStableCallbacks({
    cancelRename,
    cancelTextBlockEdit,
    cancelTextCardEdit,
    handleContainerWheel,
    openContainerContentMenu,
    openImageMenu,
    openTextBlockMenu,
    openTextCardMenu,
    pickImageForElement,
    rememberRecentColor,
    saveRename,
    saveTextBlockEdit,
    saveTextCardEdit,
    selectCanvasElement,
    setContainerSort,
    startContainerContentSelection,
    startImageMove,
    startImageResize,
    startMove,
    startResize,
    startTextBlockEdit,
    startTextCardMove,
    stopTextCardCommands,
    toggleLockExtension,
    toggleMenu,
    togglePickedContainerCard,
    togglePrivacyExtension,
    toggleTextCardCheckbox,
    runTextCardCommands,
    updateContainerAccent,
    updateContainerHeaderButtonsVisible,
    updateContainerSearchQuery,
    updateTextBlockAccent,
    updateTextBlockHeaderButtonsVisible,
    copyContainerJsonForAi,
    openContainerJsonEditor,
    pasteContainerJsonFromAi,
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
    glowingTextCardIds,
    outlinedIds,
    pulsingTextCardIds,
    selectedIds.length,
    textCards,
  ]);

  const stageWidth = stageSize.width;
  const stageHeight = stageSize.height;
  const canvasWidth = activeCanvas.width;
  const canvasHeight = activeCanvas.height;
  const backdropTextCards = useMemo(
    () => [
      ...settledLayeredLooseTextCards,
      ...textCards.filter((card) => Boolean(card.containerId)),
    ],
    [settledLayeredLooseTextCards, textCards],
  );
  const backdropCanvas = useMemo<TaskCanvas>(
    () => ({
      id: activeCanvas.id,
      name: "Backdrop presentation",
      width: activeCanvas.width,
      height: activeCanvas.height,
      containers: settledLayeredElements,
      textCards: backdropTextCards,
      textBlocks: settledLayeredTextBlocks,
      images: settledLayeredLooseImages,
      mindmapConnections: [],
      pan: DEFAULT_PAN,
      zoom: 1,
    }),
    [
      activeCanvas.height,
      activeCanvas.id,
      activeCanvas.width,
      backdropTextCards,
      settledLayeredElements,
      settledLayeredLooseImages,
      settledLayeredTextBlocks,
    ],
  );
  const backdropRevisionRef = useRef<LegacyBackdropSceneRevisionState | null>(null);
  backdropRevisionRef.current = advanceLegacyBackdropSceneRevision(backdropRevisionRef.current, {
    canvas: backdropCanvas,
    gridStyle: canvasGridStyle,
    gridOpacityPercent: canvasGridOpacity[canvasGridStyle],
    textCardSizes: measuredInteractionCardSizes,
  });
  const backdropRevision = backdropRevisionRef.current.revision;
  const buildBackdropScene = useCallback(
    (cacheWorldBounds: CanvasRectangle, anchorZoom: number) =>
      projectLegacyBackdropScene({
        canvas: backdropCanvas,
        sceneRevision: backdropRevision,
        gridStyle: canvasGridStyle,
        gridOpacityPercent: canvasGridOpacity[canvasGridStyle],
        cacheWorldBounds,
        anchorZoom,
        textCardSizes: measuredInteractionCardSizes,
        containerScrollOffsets,
      }),
    [
      backdropCanvas,
      backdropRevision,
      canvasGridOpacity,
      canvasGridStyle,
      containerScrollOffsets,
      measuredInteractionCardSizes,
    ],
  );
  const materialBackdropPresentation = useMemo(
    () => ({
      sceneKey: activeCanvas.id,
      sceneRevision: backdropRevision,
      viewport: interactionSnapshot.viewport,
      interactionActive: interactionSnapshot.activeInteraction !== null,
      buildScene: buildBackdropScene,
    }),
    [
      activeCanvas.id,
      backdropRevision,
      buildBackdropScene,
      interactionSnapshot.activeInteraction,
      interactionSnapshot.viewport,
    ],
  );
  useLayoutEffect(() => {
    materialPresentation?.publish(materialBackdropPresentation);
  }, [materialBackdropPresentation, materialPresentation]);
  useEffect(
    () => () => {
      materialPresentation?.clear();
    },
    [materialPresentation],
  );
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
  const cullingViewportRef = useRef(interactionSnapshot.viewport);
  if (
    shouldRefreshCullingViewport(
      cullingViewportRef.current,
      interactionSnapshot.viewport,
      interactionSnapshot.activeInteraction?.kind === "pan",
    )
  ) {
    cullingViewportRef.current = interactionSnapshot.viewport;
  }
  const cullingViewport = cullingViewportRef.current;
  const visibleRenderIds = useMemo(
    () =>
      getVisibleElementIds({
        viewport: cullingViewport,
        pinnedIds: pinnedRenderIds,
        elements: [
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
      }),
    [
      cullingViewport,
      layeredElements,
      layeredLooseImages,
      layeredLooseTextCards,
      layeredTextBlocks,
      pinnedRenderIds,
    ],
  );
  const renderedElements = useMemo(
    () => layeredElements.filter((element) => visibleRenderIds.has(element.id)),
    [layeredElements, visibleRenderIds],
  );
  const renderedTextBlocks = useMemo(
    () => layeredTextBlocks.filter((element) => visibleRenderIds.has(element.id)),
    [layeredTextBlocks, visibleRenderIds],
  );
  const renderedTextCards = useMemo(
    () => layeredLooseTextCards.filter((card) => visibleRenderIds.has(card.id)),
    [layeredLooseTextCards, visibleRenderIds],
  );
  const renderedImages = useMemo(
    () => layeredLooseImages.filter((image) => visibleRenderIds.has(image.id)),
    [layeredLooseImages, visibleRenderIds],
  );
  const minimapViewportWorld = viewportWorldRectangle(interactionSnapshot.viewport);
  const selectionScreenBounds = selectionBounds
    ? {
        left: pan.x + selectionBounds.left * zoom,
        top: pan.y + selectionBounds.top * zoom,
        width: selectionBounds.width * zoom,
        height: selectionBounds.height * zoom,
      }
    : null;
  const contextMenuElement = containerMenu ? containersById.get(containerMenu.id) : null;
  const closingContextMenuElement = closingContainerMenu
    ? containersById.get(closingContainerMenu.id)
    : null;
  const textCardContextElement = textCardMenu ? textCardsById.get(textCardMenu.id) : null;
  const closingTextCardContextElement = closingTextCardMenu
    ? textCardsById.get(closingTextCardMenu.id)
    : null;
  const textBlockContextElement = textBlockMenu ? textBlocksById.get(textBlockMenu.id) : null;
  const closingTextBlockContextElement = closingTextBlockMenu
    ? textBlocksById.get(closingTextBlockMenu.id)
    : null;
  const imageContextElement = imageMenu ? imagesById.get(imageMenu.id) : null;
  const closingImageContextElement = closingImageMenu ? imagesById.get(closingImageMenu.id) : null;
  const mindmapConnectionContextElement = mindmapConnectionMenu
    ? mindmapConnectionsById.get(mindmapConnectionMenu.id)
    : null;
  const connectableBoundsById = new Map<string, MindmapBounds>();
  elements.forEach((element) => {
    const preview = interactionGeometryById.get(element.id);
    connectableBoundsById.set(element.id, {
      x: preview?.x ?? element.x,
      y: preview?.y ?? element.y,
      width: preview?.width ?? element.width,
      height: preview?.height ?? element.height,
    });
  });
  textBlocks.forEach((element) => {
    const preview = interactionGeometryById.get(element.id);
    connectableBoundsById.set(element.id, {
      x: preview?.x ?? element.x,
      y: preview?.y ?? element.y,
      width: preview?.width ?? element.width,
      height: preview?.height ?? element.height,
    });
  });
  looseImages.forEach((image) => {
    const preview = interactionGeometryById.get(image.id);
    connectableBoundsById.set(image.id, {
      x: preview?.x ?? image.x,
      y: preview?.y ?? image.y,
      width: preview?.width ?? image.width,
      height: preview?.height ?? image.height,
    });
  });
  looseTextCards
    .filter((card) => card.kind === "mindmap")
    .forEach((card) => {
      const bounds = getLooseTextCardSelectionBounds(card);
      const preview = interactionGeometryById.get(card.id);
      connectableBoundsById.set(card.id, {
        x: preview?.x ?? bounds.left,
        y: preview?.y ?? bounds.top,
        width: preview?.width ?? bounds.width,
        height: preview?.height ?? bounds.height,
      });
    });
  const canvasElementShadows: CanvasElementShadow[] = [
    ...renderedElements
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
    ...renderedTextBlocks
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
    ...renderedTextCards.flatMap((card) => {
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
    ...renderedImages.flatMap((image) => {
      const chromeless =
        Boolean(image.imageId) && !loadingImageIds.includes(image.id) && image.background === false;
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
  const draggedShadowIds = new Set(dragPinnedIds);
  const draggedCanvasElementShadows = canvasElementShadows.filter((shadow) =>
    draggedShadowIds.has(shadow.id),
  );
  const dotGridOpacityScale = clamp((zoom - 0.55) / 0.45, 0, 1);
  const workspaceStyle = {
    "--frosted-bg-opacity": frostedGlassValues.bgOpacity,
    "--frosted-bg-brightness": frostedGlassValues.bgBrightness,
    "--frosted-border-opacity": frostedGlassValues.borderOpacity,
    "--frosted-blur": `${frostedGlassValues.blur}px`,
    "--frosted-shadow-opacity": frostedGlassValues.shadowOpacity,
    "--frosted-shadow-y": `${frostedGlassValues.shadowY}px`,
    "--frosted-shadow-blur": `${frostedGlassValues.shadowBlur}px`,
    "--left-panel-card-bg-opacity": leftPanelCardValues.bgOpacity,
    "--left-panel-card-outline-opacity": leftPanelCardValues.outlineOpacity,
    "--taskmap-chrome-inset-inline": `${workspaceGeometryValues.sideInset}px`,
    "--taskmap-chrome-inset-top": `${workspaceGeometryValues.topInset}px`,
  } as CSSProperties;
  const leftPanelOpen = canvasManagerOpen || extensionsOpen;
  const leftPanelClosing = canvasManagerClosing || extensionsClosing;
  const leftPanelActiveIndex = extensionsOpen ? 1 : 0;
  if (
    canvasManagerCanvasesRef.current === null ||
    interactionSnapshot.activeInteraction?.kind !== "pan"
  ) {
    canvasManagerCanvasesRef.current = getPersistedCanvases();
  }
  const canvasManagerCanvases = canvasManagerCanvasesRef.current;
  return (
    <TransientInteractionProvider service={interactionController}>
      <WorkspaceRoot
        spellCheck={false}
        style={workspaceStyle}
        onContextMenu={suppressContextMenu}
        onPointerDownCapture={handleMainPointerDownCapture}
      >
        <div className="h-full">
          <section className="relative h-full overflow-hidden">
            {import.meta.env.DEV && temporaryPanelsVisible && DevelopmentFrostedGlassTuner && (
              <Suspense fallback={null}>
                <DevelopmentFrostedGlassTuner
                  frostedValues={frostedGlassValues}
                  cardValues={leftPanelCardValues}
                  geometryValues={workspaceGeometryValues}
                  onFrostedChange={setFrostedGlassValues}
                  onCardChange={setLeftPanelCardValues}
                  onGeometryChange={setWorkspaceGeometryValues}
                />
                <div className="frosted-glass pointer-events-none fixed left-1/2 top-6 z-30 w-[640px] -translate-x-1/2 rounded-xl border border-white/[0.15] bg-[#1b1b1e]/94 p-8 text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-sm">
                  <div className="text-2xl font-semibold tracking-tight text-white/88">
                    Frosted glass preview
                  </div>
                  <div className="mt-3 text-base leading-6 text-white/58">
                    Temporary example panel using the current slider values.
                  </div>
                </div>
              </Suspense>
            )}
            <WorkspaceChromeLayer>
              <WorkspaceChromeGlassBatches />
              {leftPanelOpen && (
                <Suspense fallback={null}>
                  <WorkspaceSidePanel
                    ref={leftPanelRef}
                    closing={leftPanelClosing}
                    label={leftPanelActiveIndex === 0 ? "Canvases panel" : "Extensions panel"}
                    radius={workspaceGeometryValues.canvasBrowserRadius}
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
                          cycleHighlightCanvasId={canvasCycleHighlightId}
                          closing={leftPanelClosing}
                          cardRadius={workspaceGeometryValues.canvasCardRadius}
                          minimalView={canvasManagerMinimalView}
                          sharedPanel
                          viewportWidth={stageWidth}
                          viewportHeight={stageHeight}
                          onMinimalViewChange={setCanvasManagerMinimalView}
                          onCreateCanvas={createCanvas}
                          onSelectCanvas={selectCanvas}
                          onUpdateCanvas={updateCanvas}
                          onDeleteCanvas={deleteCanvas}
                          onReorderCanvases={reorderCanvases}
                        />,
                        <ExtensionsPanel
                          key="extensions"
                          active={leftPanelActiveIndex === 1}
                          closing={leftPanelClosing}
                          panelRef={leftPanelRef}
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
                  elements={elements}
                  textBlocks={textBlocks}
                  textCards={looseTextCards}
                  images={looseImages}
                  mindmapConnections={mindmapConnections}
                  canvasWidth={canvasWidth}
                  canvasHeight={canvasHeight}
                  visible={minimapVisible}
                  zoom={zoom}
                  viewportWorld={minimapViewportWorld}
                  onResetZoom={resetZoom}
                />
              )}
              <WindowChrome radius={workspaceGeometryValues.topBarRadius} />
              <FloatingToolbar
                canRedo={historyState.canRedo}
                canUndo={historyState.canUndo}
                canvasesOpen={canvasManagerOpen && !canvasManagerClosing}
                extensionsOpen={extensionsOpen && !extensionsClosing}
                minimapEnabled={minimapEnabled}
                privacyModeEnabled={privacyModeEnabled}
                toolbarRadius={workspaceGeometryValues.topBarRadius}
                toolbarButtonsVisible={toolbarButtonsVisible}
                onMinimapEnabledChange={setMinimapEnabled}
                onPrivacyModeEnabledChange={setPrivacyModeEnabled}
                onRedo={redo}
                onToolbarButtonsVisibleChange={setToolbarButtonsVisible}
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
              onPointerDownCapture={handleStagePointerDownCapture}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDrag}
              onPointerCancel={cancelDrag}
              onLostPointerCapture={cancelDrag}
              onWheel={handleWheel}
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
                    "--taskmap-canvas-dot-size": `${1.25 / zoom}px`,
                    "--taskmap-canvas-dot-opacity-scale": dotGridOpacityScale,
                    width: canvasWidth,
                    height: canvasHeight,
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                    transformOrigin: "0 0",
                  } as React.CSSProperties
                }
                onContextMenu={handleCanvasContextMenu}
                onPointerDown={handleWorldPointerDown}
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
                            width: 2 / zoom,
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
                            height: 2 / zoom,
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
                {extensionDropRipples.map((ripple) => {
                  const bounds = ripple.bounds;

                  const rippleX = clamp(ripple.offsetX, 0, bounds.width);
                  const rippleY = clamp(ripple.offsetY, 0, bounds.height);

                  return (
                    <div
                      key={ripple.id}
                      className="extension-drop-ripple-surface"
                      style={{
                        left: bounds.left,
                        top: bounds.top,
                        width: bounds.width,
                        height: bounds.height,
                        borderRadius: bounds.borderRadius,
                        borderTopLeftRadius: bounds.borderTopLeftRadius,
                        borderTopRightRadius: bounds.borderTopRightRadius,
                        borderBottomRightRadius: bounds.borderBottomRightRadius,
                        borderBottomLeftRadius: bounds.borderBottomLeftRadius,
                      }}
                    >
                      <ExtensionDropEffect
                        originX={rippleX}
                        originY={rippleY}
                        width={bounds.width}
                        height={bounds.height}
                      />
                    </div>
                  );
                })}
                <MindmapConnections
                  connections={mindmapConnections}
                  connectableBoundsById={connectableBoundsById}
                  canvasWidth={canvasWidth}
                  canvasHeight={canvasHeight}
                  connectionMode={mindmapConnectionMode}
                  preview={mindmapConnectionDrag}
                  onConnectionClick={openMindmapConnectionMenu}
                />
                {shadowsUnderElements && (
                  <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
                    {canvasElementShadows.map((shadow) => (
                      <div
                        key={`canvas-shadow-${shadow.id}`}
                        className={`canvas-element-shadow canvas-element-shadow-${shadow.strength} absolute`}
                        style={{
                          left: shadow.left,
                          top: shadow.top,
                          width: shadow.width,
                          height: shadow.height,
                          borderRadius: shadow.radius,
                        }}
                      />
                    ))}
                    {draggedCanvasElementShadows.map((shadow) => (
                      <div
                        key={`canvas-drag-shadow-${shadow.id}`}
                        className="canvas-drag-shadow absolute"
                        style={{
                          left: shadow.left,
                          top: shadow.top,
                          width: shadow.width,
                          height: shadow.height,
                          borderRadius: shadow.radius,
                        }}
                      />
                    ))}
                  </div>
                )}
                {renderedElements.map((element) => {
                  // Keep the settling card in the index list so neighbours keep
                  // their correct visible slots; it is rendered in the loose
                  // layer (for its free-flying settle animation) and merely
                  // skipped in the container loop below. Excluding it here
                  // instead shifts every later card up a row for the settle
                  // window, which reads as a brief shuffle.
                  const allContainedCards = (
                    orderedTextCardsByContainerId.get(element.id) ?? []
                  ).filter((card) => !draggedTextCardIds.includes(card.id));
                  const containedCards = getContainerVisibleTextCards(element, allContainedCards);
                  const insertionCount =
                    activeTextCardPresentation?.targetContainerId === element.id
                      ? activeTextCardPresentation.ids.length
                      : 0;
                  const containerScrollOffset = getContainerScrollOffset(element);
                  const containerCardRenderRange = getVirtualRowRange({
                    rowCount: containedCards.length + insertionCount,
                    rowHeight: CONTAINER_TEXT_CARD_ROW_HEIGHT,
                    rowGap: CONTAINER_TEXT_CARD_GAP,
                    padding: CONTAINER_TEXT_CARD_PADDING,
                    scrollOffset: containerScrollOffset,
                    viewportHeight: getContainerViewportHeight(element),
                    overscanRows: CONTAINER_TEXT_CARD_OVERSCAN_ROWS,
                  });
                  const containerMultiSelected =
                    selectedIds.length > 1 && selectedIds.includes(element.id);

                  return (
                    <ContainerNode
                      key={element.id}
                      element={element}
                      selected={outlinedIds.includes(element.id)}
                      multiSelected={containerMultiSelected}
                      entering={enteringIds.includes(element.id)}
                      deleting={deletingIds.includes(element.id)}
                      moving={draggedShadowIds.has(element.id)}
                      shadowsUnderElements={shadowsUnderElements}
                      recentColors={recentColors}
                      renaming={renamingId === element.id}
                      renameDraft={renamingId === element.id ? renameDraft : ""}
                      onRenameDraftChange={setRenameDraft}
                      onSaveRename={canvasNodeActions.saveRename}
                      onCancelRename={canvasNodeActions.cancelRename}
                      onSelect={canvasNodeActions.selectCanvasElement}
                      onStartMove={canvasNodeActions.startMove}
                      onStartResize={canvasNodeActions.startResize}
                      onToggleMenu={canvasNodeActions.toggleMenu}
                      onTogglePrivacy={canvasNodeActions.togglePrivacyExtension}
                      onToggleLock={canvasNodeActions.toggleLockExtension}
                      onUpdateAccent={canvasNodeActions.updateContainerAccent}
                      onRememberRecentColor={canvasNodeActions.rememberRecentColor}
                      onTogglePickCard={canvasNodeActions.togglePickedContainerCard}
                      onCopyJsonForAi={canvasNodeActions.copyContainerJsonForAi}
                      onPasteJsonFromAi={canvasNodeActions.pasteContainerJsonFromAi}
                      onOpenJsonEditor={canvasNodeActions.openContainerJsonEditor}
                      onHeaderButtonsVisibleChange={
                        canvasNodeActions.updateContainerHeaderButtonsVisible
                      }
                      onSetSort={canvasNodeActions.setContainerSort}
                      onSearchChange={canvasNodeActions.updateContainerSearchQuery}
                      onOpenContentMenu={canvasNodeActions.openContainerContentMenu}
                      onWheelContent={canvasNodeActions.handleContainerWheel}
                      onStartContentSelection={canvasNodeActions.startContainerContentSelection}
                      cardCount={allContainedCards.length}
                      contentRevision={containerContentRevision}
                      contentEditRevision={
                        editingTextCardContainerId === element.id
                          ? `${editingTextCardId}\u0000${textCardDraft}`
                          : ""
                      }
                    >
                      {containedCards.map((card, visibleIndex) => {
                        if (releasingTextCardIds.includes(card.id)) return null;
                        const previewRowOffset = getLegacyTextCardPreviewRowOffset({
                          targetContainerId: activeTextCardPresentation?.targetContainerId ?? null,
                          containerId: element.id,
                          insertionIndex: activeTextCardPresentation?.insertionIndex ?? null,
                          visibleIndex,
                          insertionCount,
                        });
                        const previewPixelShift =
                          previewRowOffset *
                          (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP);
                        const animationPinned =
                          editingTextCardId === card.id ||
                          enteringTextCardIds.includes(card.id) ||
                          deletingTextCardIds.includes(card.id) ||
                          pulsingTextCardIds.includes(card.id) ||
                          glowingTextCardIds.includes(card.id);
                        if (
                          !animationPinned &&
                          !isVirtualRowInRange(
                            visibleIndex,
                            containerCardRenderRange,
                            previewRowOffset,
                          )
                        ) {
                          return null;
                        }

                        const compactSearchPosition = {
                          x: element.x + CONTAINER_TEXT_CARD_PADDING,
                          y:
                            getContainerCardStackTop(element) +
                            visibleIndex *
                              (CONTAINER_TEXT_CARD_ROW_HEIGHT + CONTAINER_TEXT_CARD_GAP) -
                            containerScrollOffset +
                            previewPixelShift,
                        };
                        const position = {
                          ...toContainerRelativePosition(compactSearchPosition, element),
                          maxWidth: Math.max(120, element.width - CONTAINER_TEXT_CARD_PADDING * 2),
                        };

                        return (
                          <TextCardNode
                            key={card.id}
                            card={card}
                            accentBar={card.kind !== "mindmap"}
                            multiline={card.kind === "mindmap"}
                            overflowVisible={card.kind === "mindmap"}
                            onSizeChange={rememberTextCardSize}
                            editing={editingTextCardId === card.id}
                            draft={editingTextCardId === card.id ? textCardDraft : ""}
                            position={position}
                            entering={enteringTextCardIds.includes(card.id)}
                            deleting={deletingTextCardIds.includes(card.id)}
                            pulsing={pulsingTextCardIds.includes(card.id)}
                            glowing={glowingTextCardIds.includes(card.id)}
                            moving={draggedShadowIds.has(card.id)}
                            selected={outlinedIds.includes(card.id)}
                            interactionDisabled={containerMultiSelected}
                            linksDisabled={selectedIds.length > 1}
                            privacyHidden={Boolean(element.extensions?.privacy?.enabled)}
                            shadowsUnderElements={shadowsUnderElements}
                            onDraftChange={setTextCardDraft}
                            onSave={canvasNodeActions.saveTextCardEdit}
                            onCancel={canvasNodeActions.cancelTextCardEdit}
                            onStartMove={canvasNodeActions.startTextCardMove}
                            onOpenMenu={canvasNodeActions.openTextCardMenu}
                            onToggleCheckbox={canvasNodeActions.toggleTextCardCheckbox}
                            onRunCommands={canvasNodeActions.runTextCardCommands}
                            running={Boolean(runningCommandRuns[card.id]?.length)}
                            onStopCommands={canvasNodeActions.stopTextCardCommands}
                          />
                        );
                      })}
                    </ContainerNode>
                  );
                })}
                {renderedTextBlocks.map((element) => {
                  const textBlockMultiSelected =
                    selectedIds.length > 1 && selectedIds.includes(element.id);

                  return (
                    <TextBlockNode
                      key={element.id}
                      element={element}
                      selected={outlinedIds.includes(element.id)}
                      multiSelected={textBlockMultiSelected}
                      entering={enteringTextBlockIds.includes(element.id)}
                      deleting={deletingTextBlockIds.includes(element.id)}
                      pulsing={pulsingTextBlockIds.includes(element.id)}
                      moving={draggedShadowIds.has(element.id)}
                      shadowsUnderElements={shadowsUnderElements}
                      recentColors={recentColors}
                      editing={editingTextBlockId === element.id}
                      draft={editingTextBlockId === element.id ? textBlockDraft : ""}
                      renaming={renamingId === element.id}
                      renameDraft={renamingId === element.id ? renameDraft : ""}
                      onDraftChange={setTextBlockDraft}
                      onSave={canvasNodeActions.saveTextBlockEdit}
                      onCancel={canvasNodeActions.cancelTextBlockEdit}
                      onRenameDraftChange={setRenameDraft}
                      onSaveRename={canvasNodeActions.saveRename}
                      onCancelRename={canvasNodeActions.cancelRename}
                      onStartEdit={canvasNodeActions.startTextBlockEdit}
                      onSelect={canvasNodeActions.selectCanvasElement}
                      onStartMove={canvasNodeActions.startMove}
                      onStartResize={canvasNodeActions.startResize}
                      onToggleMenu={canvasNodeActions.openTextBlockMenu}
                      onTogglePrivacy={canvasNodeActions.togglePrivacyExtension}
                      onToggleLock={canvasNodeActions.toggleLockExtension}
                      onUpdateAccent={canvasNodeActions.updateTextBlockAccent}
                      onRememberRecentColor={canvasNodeActions.rememberRecentColor}
                      onHeaderButtonsVisibleChange={
                        canvasNodeActions.updateTextBlockHeaderButtonsVisible
                      }
                    />
                  );
                })}
                {renderedTextCards.map((card) => {
                  if (
                    activeTextCardPresentation?.ids.includes(card.id) ||
                    releasingTextCardIds.includes(card.id)
                  ) {
                    return null;
                  }
                  const position = getTextCardRenderPosition(card);
                  return (
                    <TextCardNode
                      key={card.id}
                      card={card}
                      accentBar={card.kind !== "mindmap"}
                      multiline={card.kind === "mindmap"}
                      overflowVisible={card.kind === "mindmap"}
                      onSizeChange={rememberTextCardSize}
                      editing={editingTextCardId === card.id}
                      draft={editingTextCardId === card.id ? textCardDraft : ""}
                      position={position}
                      entering={enteringTextCardIds.includes(card.id)}
                      deleting={deletingTextCardIds.includes(card.id)}
                      pulsing={pulsingTextCardIds.includes(card.id)}
                      glowing={glowingTextCardIds.includes(card.id)}
                      dragging={draggedShadowIds.has(card.id)}
                      dragPrimary={
                        interactionSnapshot.activeInteraction?.kind === "move" &&
                        interactionSnapshot.activeInteraction.targetIds[0] === card.id
                      }
                      dragBundleIndex={dragPinnedIds.indexOf(card.id)}
                      dragPickupX={0}
                      dragPickupY={0}
                      dragSwayX={0}
                      dragSwayY={0}
                      moving={draggedShadowIds.has(card.id)}
                      selected={outlinedIds.includes(card.id)}
                      linksDisabled={selectedIds.length > 1}
                      shadowsUnderElements={shadowsUnderElements}
                      onDraftChange={setTextCardDraft}
                      onSave={canvasNodeActions.saveTextCardEdit}
                      onCancel={canvasNodeActions.cancelTextCardEdit}
                      onStartMove={canvasNodeActions.startTextCardMove}
                      onOpenMenu={canvasNodeActions.openTextCardMenu}
                      onToggleCheckbox={canvasNodeActions.toggleTextCardCheckbox}
                      onRunCommands={canvasNodeActions.runTextCardCommands}
                      running={Boolean(runningCommandRuns[card.id]?.length)}
                      onStopCommands={canvasNodeActions.stopTextCardCommands}
                    />
                  );
                })}
                {renderedImages.map((image) => (
                  <ImageNode
                    key={image.id}
                    image={image}
                    url={getImageUrl(image.imageId, image.format)}
                    loading={loadingImageIds.includes(image.id) || isImageLoading(image.imageId)}
                    entering={enteringImageIds.includes(image.id)}
                    deleting={deletingImageIds.includes(image.id)}
                    dragging={draggedShadowIds.has(image.id)}
                    moving={
                      interactionSnapshot.activeInteraction?.kind === "move" &&
                      draggedShadowIds.has(image.id)
                    }
                    resizing={
                      interactionSnapshot.activeInteraction?.kind === "resize" &&
                      draggedShadowIds.has(image.id)
                    }
                    selected={outlinedIds.includes(image.id)}
                    shadowsUnderElements={shadowsUnderElements}
                    onStartMove={canvasNodeActions.startImageMove}
                    onStartResize={canvasNodeActions.startImageResize}
                    onOpenMenu={canvasNodeActions.openImageMenu}
                    onPick={canvasNodeActions.pickImageForElement}
                  />
                ))}
              </CanvasFrame>
              {activeTextCardPresentation && (
                <div
                  className="pointer-events-none absolute left-0 top-0 z-[100] overflow-visible"
                  style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) translate3d(${CANVAS_CONTENT_INSET}px, ${CANVAS_CONTENT_INSET}px, 0)`,
                    transformOrigin: "0 0",
                  }}
                >
                  {activeTextCardPresentation.ids.map((id, dragBundleIndex) => {
                    const card = textCardsById.get(id);
                    const offset = activeTextCardPresentation.offsets.find(
                      (candidate) => candidate.id === id,
                    );
                    if (!card) return null;
                    const position = getLegacyTextCardDragRenderPosition(
                      activeTextCardPresentation,
                      id,
                    );
                    return (
                      <TextCardNode
                        key={`drag-overlay-${id}`}
                        card={card}
                        accentBar={card.kind !== "mindmap"}
                        multiline={card.kind === "mindmap"}
                        overflowVisible={card.kind === "mindmap"}
                        onSizeChange={rememberTextCardSize}
                        editing={false}
                        draft={card.text}
                        position={position}
                        dragging
                        dragAtTrueSize={activeTextCardPresentation.trueSize}
                        dragPrimary={id === activeTextCardPresentation.primaryId}
                        dragBundleIndex={dragBundleIndex}
                        dragPickupX={offset?.pickupX ?? 0}
                        dragPickupY={offset?.pickupY ?? 0}
                        dragSwayX={activeTextCardPresentation.sway.x}
                        dragSwayY={activeTextCardPresentation.sway.y}
                        selected={outlinedIds.includes(id)}
                        linksDisabled
                        shadowsUnderElements={shadowsUnderElements}
                        onDraftChange={setTextCardDraft}
                        onSave={canvasNodeActions.saveTextCardEdit}
                        onCancel={canvasNodeActions.cancelTextCardEdit}
                        onStartMove={canvasNodeActions.startTextCardMove}
                        onOpenMenu={canvasNodeActions.openTextCardMenu}
                        onToggleCheckbox={canvasNodeActions.toggleTextCardCheckbox}
                        onRunCommands={canvasNodeActions.runTextCardCommands}
                        running={Boolean(runningCommandRuns[id]?.length)}
                        onStopCommands={canvasNodeActions.stopTextCardCommands}
                      />
                    );
                  })}
                </div>
              )}
              {textCardInteractionSnapshot.release && (
                <div
                  className="pointer-events-none absolute left-0 top-0 z-[100] overflow-visible"
                  style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) translate3d(${CANVAS_CONTENT_INSET}px, ${CANVAS_CONTENT_INSET}px, 0)`,
                    transformOrigin: "0 0",
                  }}
                >
                  {textCardInteractionSnapshot.release.cards.map(({ card, from, to }) => (
                    <TextCardNode
                      key={`release-overlay-${card.id}`}
                      card={card}
                      accentBar={card.kind !== "mindmap"}
                      multiline={card.kind === "mindmap"}
                      overflowVisible={card.kind === "mindmap"}
                      onSizeChange={rememberTextCardSize}
                      editing={false}
                      draft={card.text}
                      position={textCardInteractionSnapshot.release?.active ? to : from}
                      settling
                      forceInteractive
                      selected={outlinedIds.includes(card.id)}
                      linksDisabled
                      shadowsUnderElements={shadowsUnderElements}
                      onDraftChange={setTextCardDraft}
                      onSave={canvasNodeActions.saveTextCardEdit}
                      onCancel={canvasNodeActions.cancelTextCardEdit}
                      onStartMove={canvasNodeActions.startTextCardMove}
                      onOpenMenu={canvasNodeActions.openTextCardMenu}
                      onToggleCheckbox={canvasNodeActions.toggleTextCardCheckbox}
                      onRunCommands={canvasNodeActions.runTextCardCommands}
                      running={Boolean(runningCommandRuns[card.id]?.length)}
                      onStopCommands={canvasNodeActions.stopTextCardCommands}
                    />
                  ))}
                </div>
              )}
              {mindmapConnectionMode && (
                <div
                  className="pointer-events-none absolute left-0 top-0 z-[110] overflow-visible"
                  style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) translate3d(${CANVAS_CONTENT_INSET}px, ${CANVAS_CONTENT_INSET}px, 0)`,
                    transformOrigin: "0 0",
                  }}
                >
                  {Array.from(connectableBoundsById.entries()).map(([ownerId, bounds]) => {
                    const mindmap = textCardsById.get(ownerId);
                    const accent =
                      containersById.get(ownerId)?.accent ??
                      textBlocksById.get(ownerId)?.accent ??
                      imagesById.get(ownerId)?.accent ??
                      (mindmap?.kind === "mindmap"
                        ? getTextCardAccent(mindmap.accent)
                        : defaultElementColors.mindmap);
                    return (
                      <div
                        key={ownerId}
                        className="pointer-events-none absolute"
                        style={{
                          left: bounds.x,
                          top: bounds.y,
                          width: bounds.width,
                          height: bounds.height,
                        }}
                      >
                        <MindmapConnectors
                          ownerId={ownerId}
                          accent={accent}
                          connectionMode
                          activeSourcePort={
                            mindmapConnectionDrag?.sourceId === ownerId
                              ? mindmapConnectionDrag.sourcePort
                              : undefined
                          }
                          activeTargetPort={
                            mindmapConnectionDrag?.targetId === ownerId
                              ? mindmapConnectionDrag.targetPort
                              : undefined
                          }
                          onStartConnection={startMindmapConnection}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {selectionScreenBounds && (
                <div
                  className="pointer-events-none absolute z-30 rounded-md border border-dashed border-[#2dd8c8]/80 bg-[#2dd8c8]/[0.10] shadow-[0_0_0_1px_rgba(0,0,0,0.22)]"
                  style={selectionScreenBounds}
                />
              )}
            </WorkspaceBackdropLayer>

            {containerMenu && contextMenuElement && (
              <ContainerContextMenu
                key={`${containerMenu.id}-${containerMenu.left}-${containerMenu.top}`}
                menu={containerMenu}
                element={contextMenuElement}
                closing={false}
                isMultiTarget={isMultiContextAction(contextMenuElement.id)}
                extensionState={getSelectedExtensionState(
                  getContextActionIds(contextMenuElement.id),
                )}
                onStartRename={startRename}
                onUpdateAccent={updateContextAccent}
                onCut={cutContainer}
                onCopy={copyContainer}
                onRemovePrivacyExtension={(id) => stripContextExtension(id, "privacy")}
                onRemoveSearchExtension={(id) => stripContextExtension(id, "search")}
                onRemoveSortingExtension={(id) => stripContextExtension(id, "sorting")}
                onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
                onRemoveColorPickerExtension={(id) => stripContextExtension(id, "colorPicker")}
                onRemoveAutoCheckboxExtension={(id) => stripContextExtension(id, "autoCheckbox")}
                onRemoveDailyResetExtension={(id) => stripContextExtension(id, "dailyReset")}
                onRemoveCounterExtension={(id) => stripContextExtension(id, "counter")}
                onRemoveInheritCardColorExtension={(id) =>
                  stripContextExtension(id, "inheritCardColor")
                }
                onRemovePickCardExtension={(id) => stripContextExtension(id, "pickCard")}
                onRemoveCopyPasteJsonExtension={(id) => stripContextExtension(id, "copyPasteJson")}
                onMoveLayer={moveCanvasLayers}
                onDelete={deleteContextSelection}
              />
            )}

            {closingContainerMenu && closingContextMenuElement && (
              <ContainerContextMenu
                key={`closing-${closingContainerMenu.id}-${closingContainerMenu.left}-${closingContainerMenu.top}`}
                menu={closingContainerMenu}
                element={closingContextMenuElement}
                closing
                isMultiTarget={isMultiContextAction(closingContextMenuElement.id)}
                extensionState={getSelectedExtensionState(
                  getContextActionIds(closingContextMenuElement.id),
                )}
                onStartRename={startRename}
                onUpdateAccent={updateContextAccent}
                onCut={cutContainer}
                onCopy={copyContainer}
                onRemovePrivacyExtension={(id) => stripContextExtension(id, "privacy")}
                onRemoveSearchExtension={(id) => stripContextExtension(id, "search")}
                onRemoveSortingExtension={(id) => stripContextExtension(id, "sorting")}
                onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
                onRemoveColorPickerExtension={(id) => stripContextExtension(id, "colorPicker")}
                onRemoveAutoCheckboxExtension={(id) => stripContextExtension(id, "autoCheckbox")}
                onRemoveDailyResetExtension={(id) => stripContextExtension(id, "dailyReset")}
                onRemoveCounterExtension={(id) => stripContextExtension(id, "counter")}
                onRemoveInheritCardColorExtension={(id) =>
                  stripContextExtension(id, "inheritCardColor")
                }
                onRemovePickCardExtension={(id) => stripContextExtension(id, "pickCard")}
                onRemoveCopyPasteJsonExtension={(id) => stripContextExtension(id, "copyPasteJson")}
                onMoveLayer={moveCanvasLayers}
                onDelete={deleteContextSelection}
              />
            )}

            {containerContentMenu && (
              <ContainerContentContextMenu
                key={`${containerContentMenu.containerId}-${containerContentMenu.clientX}-${containerContentMenu.clientY}`}
                menu={containerContentMenu}
                hasCopiedItem={Boolean(copiedItem)}
                closing={false}
                onPaste={pasteCopiedItem}
                onCreateTextCard={createTextCardInContainer}
              />
            )}

            {closingContainerContentMenu && (
              <ContainerContentContextMenu
                key={`closing-${closingContainerContentMenu.containerId}-${closingContainerContentMenu.clientX}-${closingContainerContentMenu.clientY}`}
                menu={closingContainerContentMenu}
                hasCopiedItem={Boolean(copiedItem)}
                closing
                onPaste={pasteCopiedItem}
                onCreateTextCard={createTextCardInContainer}
              />
            )}

            {textCardMenu && textCardContextElement && (
              <TextCardContextMenu
                key={`${textCardMenu.id}-${textCardMenu.left}-${textCardMenu.top}`}
                menu={textCardMenu}
                card={textCardContextElement}
                closing={false}
                isMultiTarget={isMultiContextAction(textCardContextElement.id)}
                extensionState={getSelectedExtensionState(
                  getContextActionIds(textCardContextElement.id),
                )}
                onStartEdit={startTextCardEdit}
                onEditCommand={openCommandRunnerSettings}
                onUpdateAccent={updateContextAccent}
                recentColors={recentColors}
                onRememberRecentColor={canvasNodeActions.rememberRecentColor}
                onUpdateLink={updateTextCardLink}
                onToggleLock={canvasNodeActions.toggleLockExtension}
                onCut={cutTextCard}
                onCopy={copyTextCard}
                onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
                onRemoveColorPickerExtension={(id) => stripContextExtension(id, "colorPicker")}
                onRemoveCheckboxExtension={(id) => stripContextExtension(id, "checkbox")}
                onRemoveCommandRunnerExtension={(id) => stripContextExtension(id, "commandRunner")}
                onMoveLayer={moveCanvasLayers}
                onDelete={deleteContextSelection}
              />
            )}

            {closingTextCardMenu && closingTextCardContextElement && (
              <TextCardContextMenu
                key={`closing-${closingTextCardMenu.id}-${closingTextCardMenu.left}-${closingTextCardMenu.top}`}
                menu={closingTextCardMenu}
                card={closingTextCardContextElement}
                closing
                isMultiTarget={isMultiContextAction(closingTextCardContextElement.id)}
                extensionState={getSelectedExtensionState(
                  getContextActionIds(closingTextCardContextElement.id),
                )}
                onStartEdit={startTextCardEdit}
                onEditCommand={openCommandRunnerSettings}
                onUpdateAccent={updateContextAccent}
                recentColors={recentColors}
                onRememberRecentColor={canvasNodeActions.rememberRecentColor}
                onUpdateLink={updateTextCardLink}
                onToggleLock={canvasNodeActions.toggleLockExtension}
                onCut={cutTextCard}
                onCopy={copyTextCard}
                onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
                onRemoveColorPickerExtension={(id) => stripContextExtension(id, "colorPicker")}
                onRemoveCheckboxExtension={(id) => stripContextExtension(id, "checkbox")}
                onRemoveCommandRunnerExtension={(id) => stripContextExtension(id, "commandRunner")}
                onMoveLayer={moveCanvasLayers}
                onDelete={deleteContextSelection}
              />
            )}

            {textBlockMenu && textBlockContextElement && (
              <TextBlockContextMenu
                key={`${textBlockMenu.id}-${textBlockMenu.left}-${textBlockMenu.top}`}
                menu={textBlockMenu}
                element={textBlockContextElement}
                closing={false}
                isMultiTarget={isMultiContextAction(textBlockContextElement.id)}
                extensionState={getSelectedExtensionState(
                  getContextActionIds(textBlockContextElement.id),
                )}
                onStartEdit={startRename}
                onUpdateAccent={updateContextAccent}
                onCut={cutTextBlock}
                onCopy={copyTextBlock}
                onRemovePrivacyExtension={(id) => stripContextExtension(id, "privacy")}
                onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
                onRemoveColorPickerExtension={(id) => stripContextExtension(id, "colorPicker")}
                onMoveLayer={moveCanvasLayers}
                onDelete={deleteContextSelection}
              />
            )}

            {closingTextBlockMenu && closingTextBlockContextElement && (
              <TextBlockContextMenu
                key={`closing-${closingTextBlockMenu.id}-${closingTextBlockMenu.left}-${closingTextBlockMenu.top}`}
                menu={closingTextBlockMenu}
                element={closingTextBlockContextElement}
                closing
                isMultiTarget={isMultiContextAction(closingTextBlockContextElement.id)}
                extensionState={getSelectedExtensionState(
                  getContextActionIds(closingTextBlockContextElement.id),
                )}
                onStartEdit={startRename}
                onUpdateAccent={updateContextAccent}
                onCut={cutTextBlock}
                onCopy={copyTextBlock}
                onRemovePrivacyExtension={(id) => stripContextExtension(id, "privacy")}
                onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
                onRemoveColorPickerExtension={(id) => stripContextExtension(id, "colorPicker")}
                onMoveLayer={moveCanvasLayers}
                onDelete={deleteContextSelection}
              />
            )}

            {imageMenu && imageContextElement && (
              <ImageContextMenu
                key={`${imageMenu.id}-${imageMenu.left}-${imageMenu.top}`}
                menu={imageMenu}
                image={imageContextElement}
                closing={false}
                isMultiTarget={isMultiContextAction(imageContextElement.id)}
                extensionState={getSelectedExtensionState(
                  getContextActionIds(imageContextElement.id),
                )}
                onReplace={pickImageForElement}
                onUpdateAccent={updateContextAccent}
                onToggleBackground={toggleImageBackground}
                onToggleLock={canvasNodeActions.toggleLockExtension}
                onMoveLayer={moveCanvasLayers}
                onCut={cutImage}
                onCopy={copyImage}
                onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
                onDelete={deleteContextSelection}
              />
            )}

            {closingImageMenu && closingImageContextElement && (
              <ImageContextMenu
                key={`closing-${closingImageMenu.id}-${closingImageMenu.left}-${closingImageMenu.top}`}
                menu={closingImageMenu}
                image={closingImageContextElement}
                closing
                isMultiTarget={isMultiContextAction(closingImageContextElement.id)}
                extensionState={getSelectedExtensionState(
                  getContextActionIds(closingImageContextElement.id),
                )}
                onReplace={pickImageForElement}
                onUpdateAccent={updateContextAccent}
                onToggleBackground={toggleImageBackground}
                onToggleLock={canvasNodeActions.toggleLockExtension}
                onMoveLayer={moveCanvasLayers}
                onCut={cutImage}
                onCopy={copyImage}
                onRemoveLockExtension={(id) => stripContextExtension(id, "lock")}
                onDelete={deleteContextSelection}
              />
            )}

            {mindmapConnectionMenu && mindmapConnectionContextElement && (
              <MindmapConnectionContextMenu
                menu={mindmapConnectionMenu}
                connection={mindmapConnectionContextElement}
                onDelete={removeMindmapConnection}
              />
            )}

            {canvasMenu && (
              <CanvasContextMenu
                key={`${canvasMenu.clientX}-${canvasMenu.clientY}`}
                menu={canvasMenu}
                hasCopiedItem={Boolean(copiedItem)}
                closing={false}
                onPaste={pasteCopiedItem}
                onCreate={createContainer}
                onCreateTextCard={createTextCard}
                onCreateTextBlock={createTextBlock}
                onCreateImage={createImageFromMenu}
                onCreateMindmap={createMindmap}
                onClear={requestClearCanvas}
              />
            )}

            {closingCanvasMenu && (
              <CanvasContextMenu
                key={`closing-${closingCanvasMenu.clientX}-${closingCanvasMenu.clientY}`}
                menu={closingCanvasMenu}
                hasCopiedItem={Boolean(copiedItem)}
                closing
                onPaste={pasteCopiedItem}
                onCreate={createContainer}
                onCreateTextCard={createTextCard}
                onCreateTextBlock={createTextBlock}
                onCreateImage={createImageFromMenu}
                onCreateMindmap={createMindmap}
                onClear={requestClearCanvas}
              />
            )}

            <ModalPresence open={clearModalOpen}>
              <Suspense fallback={null}>
                <ClearCanvasModal
                  onCancel={() => setClearModalOpen(false)}
                  onConfirm={clearCanvas}
                />
              </Suspense>
            </ModalPresence>

            {commandRunnerEditorCardId &&
              textCardsById.get(commandRunnerEditorCardId)?.extensions?.commandRunner && (
                <Suspense fallback={null}>
                  <CommandRunnerSettingsModal
                    cardText={textCardsById.get(commandRunnerEditorCardId)?.text ?? "Text card"}
                    commands={
                      textCardsById.get(commandRunnerEditorCardId)?.extensions?.commandRunner
                        ?.commands ?? []
                    }
                    onCancel={() => setCommandRunnerEditorCardId(null)}
                    onSave={saveCommandRunnerSettings}
                  />
                </Suspense>
              )}

            {pendingExtensionConflict && (
              <Suspense fallback={null}>
                <ExtensionConflictModal
                  requestedLabel={EXTENSION_REGISTRY[pendingExtensionConflict.extensionId].label}
                  existingLabels={pendingExtensionConflict.conflictIds.map(
                    (id) => EXTENSION_REGISTRY[id].label,
                  )}
                  affectedCount={pendingExtensionConflict.affectedCount}
                  targetCount={pendingExtensionConflict.targetIds.length}
                  removesSavedCommands={pendingExtensionConflict.conflictIds.includes(
                    "commandRunner",
                  )}
                  onCancel={() => setPendingExtensionConflict(null)}
                  onConfirm={() => {
                    installExtensions(
                      pendingExtensionConflict.extensionId,
                      pendingExtensionConflict.targetIds,
                      true,
                    );
                    setPendingExtensionConflict(null);
                  }}
                />
              </Suspense>
            )}

            {containerJsonEditor &&
              containersById.get(containerJsonEditor.containerId)?.extensions?.copyPasteJson && (
                <ContainerJsonEditorWindow
                  key={containerJsonEditor.containerId}
                  containerName={
                    containersById.get(containerJsonEditor.containerId)?.name ?? "Container"
                  }
                  initialJson={containerJsonEditor.initialJson}
                  onApply={(json) => {
                    applyContainerJsonFromAi(containerJsonEditor.containerId, json);
                  }}
                  onClose={() => setContainerJsonEditor(null)}
                />
              )}

            <ModalPresence open={settingsOpen}>
              <Suspense fallback={null}>
                <SettingsModal
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
                  onExportData={exportData}
                  onImportData={importData}
                  discordRpcEnabled={discordRpcEnabled}
                  onDiscordRpcEnabledChange={updateDiscordRpcEnabled}
                  discordRpcShowCanvas={discordRpcShowCanvas}
                  onDiscordRpcShowCanvasChange={setDiscordRpcShowCanvas}
                  availableUpdate={availableUpdate}
                  appVersion={appVersion}
                  fpsCounterVisible={fpsCounterVisible}
                  onFpsCounterVisibleChange={setFpsCounterVisible}
                  privacyModeEnabled={privacyModeEnabled}
                  onPrivacyModeEnabledChange={setPrivacyModeEnabled}
                  temporaryPanelsVisible={temporaryPanelsVisible}
                  onTemporaryPanelsVisibleChange={setTemporaryPanelsVisible}
                  onCheckForUpdate={checkForAppUpdate}
                  onInstallUpdate={installAppUpdate}
                  onClose={() => setSettingsOpen(false)}
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

            {storageError && (
              <div className="fixed bottom-4 right-4 z-50 max-w-[420px] rounded-lg border border-red-300/25 bg-[#281b1d]/95 p-3 text-sm text-red-100 shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
                <div className="mb-1 font-semibold">Storage error</div>
                <div className="text-red-100/75">{storageError.message}</div>
                {storageError.canReset && (
                  <button
                    className="mt-3 flex h-9 items-center gap-2 rounded-md bg-red-300/14 px-3 text-sm text-red-100 transition-colors hover:bg-red-300/22"
                    onClick={() => {
                      resetLocalDatabase().catch((error) => {
                        const storageFailure = createStorageError(
                          "Failed to reset local database",
                          error,
                        );
                        setStorageError(storageFailure);
                        console.error(storageFailure.message);
                      });
                    }}
                  >
                    <IconRotateClockwise size={17} stroke={2} />
                    <span>Reset local data</span>
                  </button>
                )}
              </div>
            )}

            <ToastStack toasts={toasts} onDismiss={dismissToast} />
          </section>
        </div>
      </WorkspaceRoot>
    </TransientInteractionProvider>
  );
}

export default App;
