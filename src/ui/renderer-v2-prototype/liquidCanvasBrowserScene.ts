import { Container, Glass, Group, Html, type Scene } from "@liquid-dom/core";
import type { LiquidCanvasBrowserAppearance } from "./liquidCanvasBrowserAppearance";
import {
  removeLiquidCanvasCardRecords,
  type LiquidCanvasCardFactories,
} from "./liquidCanvasCardFactory";
import type { LiquidCanvasCardRecord } from "./liquidCanvasCardGeometry";
import type { CanvasBrowserPresentationController } from "./liquidCanvasBrowserPresentation";
import type { CanvasBrowserItemId } from "./liquidCanvasBrowserTypes";

export type LiquidCanvasBrowserScene = Scene;

export function createLiquidCanvasBrowserScene(
  scene: Scene,
  appearance: LiquidCanvasBrowserAppearance,
) {
  const browserHost = document.createElement("div");
  browserHost.className = "renderer-benchmark__canvas-browser-host";
  const browserContainer = scene.add(new Container(appearance.largePanelOptions(40)));
  const browserGlass = browserContainer.add(
    new Glass({ cornerSmoothing: 0, pointerEvents: false }),
  );
  const browserContent = browserGlass.add(new Html({ element: browserHost }));
  const cardsContainer = scene.add(new Container(appearance.smallPanelOptions(60)));
  const scrollGroup = cardsContainer.add(new Group());
  return {
    browserHost,
    browserContainer,
    browserGlass,
    browserContent,
    cardsContainer,
    scrollGroup,
  };
}

export function createLiquidCanvasBrowserDragContainer(
  scene: Scene,
  appearance: LiquidCanvasBrowserAppearance,
) {
  return scene.add(new Container(appearance.smallPanelOptions(80)));
}

export const LIQUID_CANVAS_CARD_FACTORIES: LiquidCanvasCardFactories = {
  createGroup: () => new Group(),
  createGlass: (options) => new Glass(options),
  createHtml: (host) => new Html({ element: host }),
};

export type LiquidCanvasBrowserSceneNodes = ReturnType<typeof createLiquidCanvasBrowserScene>;
export type LiquidCanvasBrowserContainer = ReturnType<
  typeof createLiquidCanvasBrowserDragContainer
>;

export function destroyLiquidCanvasBrowserScene<Id extends string = CanvasBrowserItemId>(
  nodes: LiquidCanvasBrowserSceneNodes,
  cards: ReadonlyMap<Id, LiquidCanvasCardRecord<Id>>,
  presentation: CanvasBrowserPresentationController<Id>,
) {
  removeLiquidCanvasCardRecords(cards, presentation);
  nodes.scrollGroup.remove();
  nodes.browserContent.remove();
  nodes.browserGlass.remove();
  nodes.browserContainer.remove();
  nodes.cardsContainer.remove();
  presentation.destroy();
}
