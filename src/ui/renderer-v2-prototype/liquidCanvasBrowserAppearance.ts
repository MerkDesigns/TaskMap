import type { Container, Glass, Html } from "@liquid-dom/core";
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

interface AppearanceTargets {
  readonly browserContainer: Container;
  readonly cardsContainer: Container;
  readonly dragContainer: Container | null;
  readonly browserGlass: Glass;
  readonly cardGlasses: Iterable<Glass>;
  readonly browserContent: Html;
  readonly geometry: LiquidCanvasCardGeometry;
  readonly viewportHeight: number;
  readonly cardCount: number;
}

export class LiquidCanvasBrowserAppearance {
  controls = createRendererV2MaterialControls();
  cardGap: number = BENCHMARK_CANVAS_BROWSER.cardGap;

  apply(controls: RendererV2MaterialControls, cardGap: number, targets: AppearanceTargets) {
    this.controls = controls;
    this.cardGap = cardGap;
    Object.assign(
      targets.browserContainer,
      rendererV2OpticsWithControls("large-panel", controls["large-panel"]),
    );
    Object.assign(targets.cardsContainer, this.smallPanelOptions(60));
    if (targets.dragContainer) Object.assign(targets.dragContainer, this.smallPanelOptions(80));
    targets.browserGlass.cornerRadius = controls["large-panel"].cornerRadius;
    this.applyCardCornerRadius(targets.cardGlasses);
    targets.geometry.setCardGap(cardGap);
    this.resizeSurface(
      targets.browserGlass,
      targets.browserContent,
      targets.viewportHeight,
      targets.cardCount,
    );
  }

  applyCardCornerRadius(glasses: Iterable<Glass>) {
    for (const glass of glasses) glass.cornerRadius = this.controls["small-panel"].cornerRadius;
  }

  smallPanelOptions(zIndex: number) {
    return {
      ...rendererV2OpticsWithControls("small-panel", this.controls["small-panel"]),
      spacing: 0,
      zIndex,
    };
  }

  resizeSurface(glass: Glass, content: Html, viewportHeight: number, cardCount: number) {
    resizeLiquidCanvasBrowserSurface(
      glass,
      content,
      viewportHeight,
      cardCount,
      this.cardGap,
      this.controls["large-panel"].cornerRadius,
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
