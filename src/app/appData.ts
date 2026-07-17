import {
  AppData,
  ContainerElement,
  ElementExtensions,
  TaskCanvas,
  TextBlockElement,
} from "../types";
import { quantizeZoom } from "../canvasMath";
import { DEFAULT_CANVAS, DEFAULT_ELEMENTS, DEFAULT_GRID_OPACITY, DEFAULT_PAN } from "./defaultData";
import { APP_DATA_SCHEMA_VERSION, validateAppData } from "./appDataSchema";
export { getLocalDateKey } from "../utils/date";

type LegacyAppData = Partial<AppData> & {
  containers?: ContainerElement[];
  textBlocks?: TextBlockElement[];
  pan?: { x: number; y: number };
  zoom?: number;
};

export const cloneExtensions = (extensions?: ElementExtensions) =>
  extensions ? structuredClone(extensions) : undefined;

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

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeCanvasZooms = (data: AppData): AppData => {
  let changed = false;
  const canvases = data.canvases.map((canvas) => {
    const zoom = quantizeZoom(canvas.zoom);
    if (zoom === canvas.zoom) {
      return canvas;
    }

    changed = true;
    return { ...canvas, zoom };
  });

  return changed ? { ...data, canvases } : data;
};

const stripRemovedExtensions = (data: AppData): AppData => {
  let changed = false;

  const cleanElement = <T extends { extensions?: ElementExtensions }>(element: T): T => {
    if (!element.extensions || !("colors" in element.extensions)) {
      return element;
    }

    const extensions = { ...element.extensions } as ElementExtensions & { colors?: unknown };
    delete extensions.colors;
    changed = true;
    return { ...element, extensions };
  };

  const canvases = data.canvases.map((canvas) => ({
    ...canvas,
    containers: canvas.containers.map(cleanElement),
    textCards: canvas.textCards.map(cleanElement),
    textBlocks: canvas.textBlocks.map(cleanElement),
    images: canvas.images.map(cleanElement),
  }));

  return changed ? { ...data, canvases } : data;
};

const normalizeValidatedAppData = (data: AppData) =>
  stripRemovedExtensions(normalizeCanvasZooms(data));

const prepareCanvas = (
  value: unknown,
  getPreviewViewport: () => NonNullable<TaskCanvas["previewViewport"]>,
) => {
  if (!isRecord(value)) {
    return value;
  }

  const containers = value.containers === undefined ? [] : value.containers;
  const textCards = value.textCards === undefined ? [] : value.textCards;
  const textBlocks = value.textBlocks === undefined ? [] : value.textBlocks;
  const images = value.images === undefined ? [] : value.images;

  return {
    ...value,
    containers: Array.isArray(containers)
      ? containers.map((element) =>
          isRecord(element) ? { ...element, extensions: element.extensions ?? {} } : element,
        )
      : containers,
    textCards,
    textBlocks: Array.isArray(textBlocks)
      ? textBlocks.map((element, index) =>
          isRecord(element)
            ? {
                ...element,
                name: element.name ?? `Text block ${index + 1}`,
                extensions: element.extensions ?? {},
              }
            : element,
        )
      : textBlocks,
    images,
    previewViewport: value.previewViewport ?? getPreviewViewport(),
  };
};

export const normalizeAppData = (
  data: unknown,
  getPreviewViewport: () => NonNullable<TaskCanvas["previewViewport"]>,
): AppData => {
  if (!isRecord(data)) {
    throw new Error("Invalid TaskMap data (root must be an object)");
  }

  if (
    "schemaVersion" in data &&
    data.schemaVersion !== undefined &&
    data.schemaVersion !== APP_DATA_SCHEMA_VERSION
  ) {
    throw new Error(`Unsupported TaskMap data schema version: ${String(data.schemaVersion)}`);
  }

  if (data.schemaVersion === APP_DATA_SCHEMA_VERSION) {
    return normalizeValidatedAppData(validateAppData(data));
  }

  if ("canvases" in data) {
    const canvases = Array.isArray(data.canvases)
      ? data.canvases.map((canvas) => prepareCanvas(canvas, getPreviewViewport))
      : data.canvases;
    const firstCanvasId =
      Array.isArray(canvases) && isRecord(canvases[0]) ? canvases[0].id : undefined;
    const requestedActiveCanvasId = data.activeCanvasId;
    const activeCanvasExists =
      typeof requestedActiveCanvasId === "string" &&
      Array.isArray(canvases) &&
      canvases.some((canvas) => isRecord(canvas) && canvas.id === requestedActiveCanvasId);

    return normalizeValidatedAppData(
      validateAppData({
        ...data,
        schemaVersion: APP_DATA_SCHEMA_VERSION,
        activeCanvasId: activeCanvasExists ? requestedActiveCanvasId : firstCanvasId,
        canvases,
        canvasGridStyle: data.canvasGridStyle ?? "dots",
        canvasGridOpacity: data.canvasGridOpacity ?? DEFAULT_GRID_OPACITY,
        discordRpcEnabled: data.discordRpcEnabled ?? false,
        discordRpcShowCanvas: data.discordRpcShowCanvas ?? true,
        minimapEnabled: data.minimapEnabled ?? true,
        privacyModeEnabled: data.privacyModeEnabled ?? false,
        toolbarButtonsVisible: data.toolbarButtonsVisible ?? false,
      }),
    );
  }

  const legacy = data as LegacyAppData;
  const legacyContainers = data.containers === undefined ? DEFAULT_ELEMENTS : data.containers;
  const legacyTextBlocks = data.textBlocks === undefined ? [] : data.textBlocks;
  if (!Array.isArray(legacyContainers) || !Array.isArray(legacyTextBlocks)) {
    throw new Error("Invalid TaskMap data (legacy element collections must be arrays)");
  }

  return normalizeValidatedAppData(
    validateAppData({
      schemaVersion: APP_DATA_SCHEMA_VERSION,
      activeCanvasId: DEFAULT_CANVAS.id,
      canvases: [
        {
          ...DEFAULT_CANVAS,
          containers: legacyContainers.map((element) =>
            isRecord(element) ? { ...element, extensions: element.extensions ?? {} } : element,
          ),
          textCards: [],
          textBlocks: legacyTextBlocks.map((element, index) =>
            isRecord(element)
              ? {
                  ...element,
                  name: element.name ?? `Text block ${index + 1}`,
                  extensions: element.extensions ?? {},
                }
              : element,
          ),
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
    }),
  );
};
