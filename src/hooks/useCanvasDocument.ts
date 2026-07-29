import { type Dispatch, type SetStateAction, useCallback, useMemo, useReducer } from "react";
import { DEFAULT_CANVAS } from "../app/defaultData";
import type {
  ContainerElement,
  ImageElement,
  TaskCanvas,
  TextBlockElement,
  TextCardElement,
} from "../types";

type CanvasDocumentState = {
  activeCanvasId: string;
  canvases: TaskCanvas[];
};

type CanvasCollectionKey = "containers" | "textCards" | "textBlocks" | "images";
type CanvasValueKey = "pan" | "zoom";

type CanvasDocumentAction =
  | { type: "set-canvases"; value: SetStateAction<TaskCanvas[]> }
  | { type: "set-active-canvas"; value: SetStateAction<TaskCanvas> }
  | {
      type: "set-collection";
      key: CanvasCollectionKey;
      value: SetStateAction<TaskCanvas[CanvasCollectionKey]>;
    }
  | {
      type: "set-value";
      key: CanvasValueKey;
      value: SetStateAction<TaskCanvas[CanvasValueKey]>;
    }
  | { type: "set-camera"; pan: TaskCanvas["pan"]; zoom: number };

const resolveUpdate = <T>(value: SetStateAction<T>, current: T): T =>
  typeof value === "function" ? (value as (previous: T) => T)(current) : value;

const replaceCanvas = (canvases: TaskCanvas[], replacement: TaskCanvas) => {
  const index = canvases.findIndex((canvas) => canvas.id === replacement.id);
  if (index < 0) {
    return [...canvases, replacement];
  }

  const next = [...canvases];
  next[index] = replacement;
  return next;
};

const canvasDocumentReducer = (
  state: CanvasDocumentState,
  action: CanvasDocumentAction,
): CanvasDocumentState => {
  const activeCanvas =
    state.canvases.find((canvas) => canvas.id === state.activeCanvasId) ??
    state.canvases[0] ??
    DEFAULT_CANVAS;

  switch (action.type) {
    case "set-canvases": {
      const canvases = resolveUpdate(action.value, state.canvases);
      const activeCanvasId = canvases.some((canvas) => canvas.id === state.activeCanvasId)
        ? state.activeCanvasId
        : (canvases[0]?.id ?? DEFAULT_CANVAS.id);
      return { activeCanvasId, canvases: canvases.length ? canvases : [DEFAULT_CANVAS] };
    }
    case "set-active-canvas": {
      const nextActiveCanvas = resolveUpdate(action.value, activeCanvas);
      return {
        activeCanvasId: nextActiveCanvas.id,
        canvases: replaceCanvas(state.canvases, nextActiveCanvas),
      };
    }
    case "set-collection": {
      const nextActiveCanvas = {
        ...activeCanvas,
        [action.key]: resolveUpdate(action.value, activeCanvas[action.key]),
      };
      return { ...state, canvases: replaceCanvas(state.canvases, nextActiveCanvas) };
    }
    case "set-value": {
      const nextActiveCanvas = {
        ...activeCanvas,
        [action.key]: resolveUpdate(action.value, activeCanvas[action.key]),
      };
      return { ...state, canvases: replaceCanvas(state.canvases, nextActiveCanvas) };
    }
    case "set-camera": {
      const nextActiveCanvas = {
        ...activeCanvas,
        pan: action.pan,
        zoom: action.zoom,
      };
      return { ...state, canvases: replaceCanvas(state.canvases, nextActiveCanvas) };
    }
  }
};

const createCollectionSetter = <Key extends CanvasCollectionKey>(
  dispatch: Dispatch<CanvasDocumentAction>,
  key: Key,
) =>
  ((value: SetStateAction<TaskCanvas[Key]>) => {
    dispatch({
      type: "set-collection",
      key,
      value: value as SetStateAction<TaskCanvas[CanvasCollectionKey]>,
    });
  }) as Dispatch<SetStateAction<TaskCanvas[Key]>>;

const createValueSetter = <Key extends CanvasValueKey>(
  dispatch: Dispatch<CanvasDocumentAction>,
  key: Key,
) =>
  ((value: SetStateAction<TaskCanvas[Key]>) => {
    dispatch({
      type: "set-value",
      key,
      value: value as SetStateAction<TaskCanvas[CanvasValueKey]>,
    });
  }) as Dispatch<SetStateAction<TaskCanvas[Key]>>;

export const useCanvasDocument = (initialCanvas: TaskCanvas = DEFAULT_CANVAS) => {
  const [state, dispatch] = useReducer(canvasDocumentReducer, {
    activeCanvasId: initialCanvas.id,
    canvases: [initialCanvas],
  });
  const activeCanvas = useMemo(
    () =>
      state.canvases.find((canvas) => canvas.id === state.activeCanvasId) ??
      state.canvases[0] ??
      DEFAULT_CANVAS,
    [state.activeCanvasId, state.canvases],
  );

  const setCanvases = useCallback<Dispatch<SetStateAction<TaskCanvas[]>>>((value) => {
    dispatch({ type: "set-canvases", value });
  }, []);
  const setActiveCanvas = useCallback<Dispatch<SetStateAction<TaskCanvas>>>((value) => {
    dispatch({ type: "set-active-canvas", value });
  }, []);
  const setCamera = useCallback((pan: TaskCanvas["pan"], zoom: number) => {
    dispatch({ type: "set-camera", pan, zoom });
  }, []);

  const setters = useMemo(
    () => ({
      setElements: createCollectionSetter(dispatch, "containers"),
      setTextCards: createCollectionSetter(dispatch, "textCards"),
      setTextBlocks: createCollectionSetter(dispatch, "textBlocks"),
      setImages: createCollectionSetter(dispatch, "images"),
      setPan: createValueSetter(dispatch, "pan"),
      setZoom: createValueSetter(dispatch, "zoom"),
    }),
    [dispatch],
  );

  return {
    activeCanvas,
    canvases: state.canvases,
    elements: activeCanvas.containers,
    textCards: activeCanvas.textCards,
    textBlocks: activeCanvas.textBlocks,
    images: activeCanvas.images,
    pan: activeCanvas.pan,
    zoom: activeCanvas.zoom,
    setActiveCanvas,
    setCanvases,
    setCamera,
    ...setters,
  } satisfies {
    activeCanvas: TaskCanvas;
    canvases: TaskCanvas[];
    elements: ContainerElement[];
    textCards: TextCardElement[];
    textBlocks: TextBlockElement[];
    images: ImageElement[];
    pan: TaskCanvas["pan"];
    zoom: number;
    setActiveCanvas: Dispatch<SetStateAction<TaskCanvas>>;
    setCanvases: Dispatch<SetStateAction<TaskCanvas[]>>;
    setCamera: (pan: TaskCanvas["pan"], zoom: number) => void;
    setElements: Dispatch<SetStateAction<ContainerElement[]>>;
    setTextCards: Dispatch<SetStateAction<TextCardElement[]>>;
    setTextBlocks: Dispatch<SetStateAction<TextBlockElement[]>>;
    setImages: Dispatch<SetStateAction<ImageElement[]>>;
    setPan: Dispatch<SetStateAction<TaskCanvas["pan"]>>;
    setZoom: Dispatch<SetStateAction<number>>;
  };
};
