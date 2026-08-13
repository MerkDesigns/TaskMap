import type { BenchmarkElementModel } from "./benchmarkTypes";

export function benchmarkElementCssGeometry(element: BenchmarkElementModel): React.CSSProperties {
  return {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.z,
  };
}

export function applyBenchmarkElementCssGeometry(
  node: HTMLElement,
  element: BenchmarkElementModel,
) {
  Object.assign(node.style, {
    left: `${element.x}px`,
    top: `${element.y}px`,
    width: `${element.width}px`,
    height: `${element.height}px`,
    zIndex: String(element.z),
  });
}
