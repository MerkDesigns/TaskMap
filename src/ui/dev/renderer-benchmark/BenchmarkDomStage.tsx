import type { BenchmarkPresentation } from "./benchmarkPresentation";
import { BenchmarkDomCanvas } from "./BenchmarkDomCanvas";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkViewportController } from "./benchmarkViewportController";
import type { BenchmarkSpawnMenuRequest } from "./useBenchmarkCanvasInput";

interface Props {
  store: BenchmarkSceneStore;
  viewport: BenchmarkViewportController;
  version: number;
  onPresentation: (presentation: BenchmarkPresentation | null) => void;
  onSpawnMenu: (request: BenchmarkSpawnMenuRequest | null) => void;
}

export function BenchmarkDomStage({
  store,
  viewport,
  version,
  onPresentation,
  onSpawnMenu,
}: Props) {
  return (
    <BenchmarkDomCanvas
      mode="A"
      store={store}
      viewport={viewport}
      version={version}
      onPresentation={onPresentation}
      onSpawnMenu={onSpawnMenu}
    />
  );
}
