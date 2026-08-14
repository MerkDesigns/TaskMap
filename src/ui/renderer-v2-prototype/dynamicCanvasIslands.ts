import type { BenchmarkAnimationSettings, BenchmarkElementModel } from "./benchmarkTypes";
import type { CanvasIslandDiagnosticMode } from "./canvasIslandDiagnostics";

export interface DynamicElementClassification {
  readonly element: BenchmarkElementModel;
  readonly positionOnly: boolean;
}

export function classifyDynamicCanvasElement(
  element: BenchmarkElementModel,
  animations: BenchmarkAnimationSettings,
): DynamicElementClassification | null {
  const movesWithCards = animations.moveCards && element.ordinal % 5 === 0;
  const containsMovingImage = animations.moveImage && element.ordinal % 7 === 0;
  const containsGif = animations.showGif && element.ordinal % 10 === 0;
  if (!movesWithCards && !containsMovingImage && !containsGif) return null;
  return {
    element,
    positionOnly: movesWithCards && !containsMovingImage && !containsGif,
  };
}

export function selectDynamicCanvasElements(
  elements: readonly BenchmarkElementModel[],
  animations: BenchmarkAnimationSettings,
  mode: CanvasIslandDiagnosticMode,
) {
  if (mode === "coarse-canvas") return [];
  return elements.flatMap((element) => {
    const classification = classifyDynamicCanvasElement(element, animations);
    return classification ? [classification] : [];
  });
}
