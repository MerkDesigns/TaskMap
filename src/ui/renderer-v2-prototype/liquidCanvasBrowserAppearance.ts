import {
  BENCHMARK_CANVAS_BROWSER,
  canvasBrowserBodyBottom,
  canvasBrowserScrollHeight,
} from "./benchmarkCanvasBrowserLayout";
import { resizeLiquidCanvasBrowserSurface } from "./liquidCanvasCardFactory";
import type { LiquidCanvasCardGeometry } from "./liquidCanvasCardGeometry";
import {
  createRendererV2MaterialControls,
  rendererV2OpticsWithControls,
  type RendererV2MaterialControls,
} from "./rendererV2PanelMaterials";
import {
  createRendererV2PanelGeometry,
  type RendererV2PanelGeometry,
} from "./rendererV2PanelGeometry";

interface AppearanceTargets {
  readonly browserContainer: AppearanceContainer;
  readonly cardsContainer: AppearanceContainer;
  readonly dragContainer: AppearanceContainer | null;
  readonly browserGlass: AppearanceGlass;
  readonly cardGlasses: Iterable<AppearanceGlass>;
  readonly browserContent: AppearanceHtml;
  readonly geometry: LiquidCanvasCardGeometry;
  readonly viewportHeight: number;
  readonly cardCount: number;
}

type AppearanceContainer = object;
interface AppearanceGlass {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
}
interface AppearanceHtml {
  width: number;
  height: number;
}

export class LiquidCanvasBrowserAppearance {
  controls = createRendererV2MaterialControls();
  geometry = createRendererV2PanelGeometry();
  cardGap: number = BENCHMARK_CANVAS_BROWSER.cardGap;

  apply(
    controls: RendererV2MaterialControls,
    geometry: RendererV2PanelGeometry,
    cardGap: number,
    targets: AppearanceTargets,
  ) {
    this.controls = controls;
    this.geometry = geometry;
    this.cardGap = cardGap;
    Object.assign(
      targets.browserContainer,
      rendererV2OpticsWithControls("large-panel", controls["large-panel"]),
    );
    Object.assign(targets.cardsContainer, this.smallPanelOptions(60));
    if (targets.dragContainer) Object.assign(targets.dragContainer, this.smallPanelOptions(80));
    targets.browserGlass.cornerRadius = geometry["large-panel"].cornerRadius;
    this.applyCardCornerRadius(targets.cardGlasses);
    targets.geometry.setCardGap(cardGap);
    this.resizeSurface(
      targets.browserGlass,
      targets.browserContent,
      targets.viewportHeight,
      targets.cardCount,
    );
  }

  applyCardCornerRadius(glasses: Iterable<AppearanceGlass>) {
    for (const glass of glasses) glass.cornerRadius = this.geometry["small-panel"].cornerRadius;
  }

  smallPanelOptions(zIndex: number) {
    return {
      ...rendererV2OpticsWithControls("small-panel", this.controls["small-panel"]),
      spacing: 0,
      zIndex,
    };
  }

  largePanelOptions(zIndex: number) {
    return {
      ...rendererV2OpticsWithControls("large-panel", this.controls["large-panel"]),
      zIndex,
    };
  }

  resizeSurface(
    glass: AppearanceGlass,
    content: AppearanceHtml,
    viewportHeight: number,
    cardCount: number,
  ) {
    resizeLiquidCanvasBrowserSurface(
      glass,
      content,
      viewportHeight,
      cardCount,
      this.cardGap,
      this.geometry["large-panel"].cornerRadius,
    );
  }

  bodyBottom(viewportHeight: number, cardCount: number) {
    return canvasBrowserBodyBottom(viewportHeight, cardCount, this.cardGap);
  }

  scrollHeight(cardCount: number) {
    return canvasBrowserScrollHeight(cardCount, this.cardGap);
  }

  cardStep() {
    return BENCHMARK_CANVAS_BROWSER.cardHeight + this.cardGap;
  }
}
