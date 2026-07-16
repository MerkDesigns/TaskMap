import { AppData, ContainerElement, ElementExtensions, TaskCanvas, TextBlockElement } from "../types";
import { DEFAULT_CANVAS, DEFAULT_ELEMENTS, DEFAULT_GRID_OPACITY, DEFAULT_PAN } from "./defaultData";

type LegacyAppData = Partial<AppData> & {
  containers?: ContainerElement[];
  textBlocks?: TextBlockElement[];
  pan?: { x: number; y: number };
  zoom?: number;
};

export const getLocalDateKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export const cloneExtensions = (extensions?: ElementExtensions) =>
  extensions ? JSON.parse(JSON.stringify(extensions)) as ElementExtensions : undefined;

export const remapContainerExtensions = (
  extensions: ElementExtensions | undefined,
  textCardIdMap: Map<string, string>,
) => {
  const cloned = cloneExtensions(extensions);
  if (!cloned?.pickCard) {
    return cloned;
  }

  return {
    ...cloned,
    pickCard: {
      ...cloned.pickCard,
      selectedCardId: cloned.pickCard.selectedCardId
        ? textCardIdMap.get(cloned.pickCard.selectedCardId)
        : undefined,
      lastCardId: cloned.pickCard.lastCardId
        ? textCardIdMap.get(cloned.pickCard.lastCardId)
        : undefined,
    },
  };
};

export const normalizeAppData = (
  data: AppData | LegacyAppData,
  getPreviewViewport: () => NonNullable<TaskCanvas["previewViewport"]>,
): AppData => {
  if (Array.isArray(data.canvases) && data.activeCanvasId) {
    return {
      ...(data as AppData),
      discordRpcEnabled: (data as AppData).discordRpcEnabled ?? false,
      discordRpcShowCanvas: (data as AppData).discordRpcShowCanvas ?? true,
      minimapEnabled: (data as AppData).minimapEnabled ?? true,
      privacyModeEnabled: (data as AppData).privacyModeEnabled ?? false,
      toolbarButtonsVisible: (data as AppData).toolbarButtonsVisible ?? false,
      canvases: (data as AppData).canvases.map((canvas) => ({
        ...canvas,
        containers: canvas.containers.map((element) => ({
          ...element,
          extensions: element.extensions ?? {},
        })),
        textCards: canvas.textCards ?? [],
        textBlocks: (canvas.textBlocks ?? []).map((element, index) => ({
          ...element,
          name: element.name ?? `Text block ${index + 1}`,
          extensions: element.extensions ?? {},
        })),
        images: canvas.images ?? [],
        previewViewport: canvas.previewViewport ?? getPreviewViewport(),
      })),
    };
  }

  const legacy = data as LegacyAppData;

  return {
    activeCanvasId: DEFAULT_CANVAS.id,
    canvases: [
      {
        ...DEFAULT_CANVAS,
        containers: (legacy.containers ?? DEFAULT_ELEMENTS).map((element) => ({
          ...element,
          extensions: element.extensions ?? {},
        })),
        textCards: [],
        textBlocks: (legacy.textBlocks ?? []).map((element, index) => ({
          ...element,
          name: element.name ?? `Text block ${index + 1}`,
          extensions: element.extensions ?? {},
        })),
        images: [],
        pan: legacy.pan ?? DEFAULT_PAN,
        zoom: legacy.zoom ?? 1,
        previewViewport: getPreviewViewport(),
      },
    ],
    canvasGridStyle: data.canvasGridStyle ?? "dots",
    canvasGridOpacity: data.canvasGridOpacity ?? DEFAULT_GRID_OPACITY,
    discordRpcEnabled: data.discordRpcEnabled ?? false,
    discordRpcShowCanvas: data.discordRpcShowCanvas ?? true,
    minimapEnabled: data.minimapEnabled ?? true,
    privacyModeEnabled: data.privacyModeEnabled ?? false,
    toolbarButtonsVisible: data.toolbarButtonsVisible ?? false,
    dismissedUpdateVersion: data.dismissedUpdateVersion,
  };
};
