import type { ReactNode } from "react";
import { CanvasContextMenu, ContainerContentContextMenu } from "../components/ContextMenus";
import type { ElementId } from "../domain/ids/entityIds";
import { ContainerMenu, type ContainerMenuActions } from "../elements/container/ContainerMenu";
import { asContainerDocumentElement } from "../elements/container/containerViewProjection";
import { ImageMenu, type ImageMenuActions } from "../elements/image/ImageMenu";
import { asImageDocumentElement } from "../elements/image/imageViewProjection";
import { MindMapConnectionMenu } from "../elements/mind-map/MindMapConnectionMenu";
import { TextBlockMenu, type TextBlockMenuActions } from "../elements/text-block/TextBlockMenu";
import { asTextBlockDocumentElement } from "../elements/text-block/textBlockViewProjection";
import { TextCardMenu, type TextCardMenuActions } from "../elements/text-card/TextCardMenu";
import { asTextCardRendererElement } from "../elements/text-card/textCardViewProjection";
import type { ExtensionCommands } from "../extensions/extensionCommands";
import type { RetainedExtensionKey } from "../extensions/retainedExtensionDefinition";
import type { ElementExtensions } from "../types";
import { useRetainedDocumentElements } from "./RetainedCanvasContext";

/** An open menu and the copy that keeps rendering for its exit animation (see useClosingMenu). */
interface MenuPair<State> {
  readonly menu: State | null;
  readonly closing: State | null;
}

type AnchoredMenu = { readonly id: string; readonly left: number; readonly top: number };
type PointerMenu = { readonly clientX: number; readonly clientY: number };
type ContainerContentMenu = PointerMenu & { readonly containerId: string };

export interface RetainedCanvasMenusProps {
  readonly containerMenus: MenuPair<AnchoredMenu>;
  readonly textCardMenus: MenuPair<AnchoredMenu>;
  readonly textBlockMenus: MenuPair<AnchoredMenu>;
  readonly imageMenus: MenuPair<AnchoredMenu>;
  readonly containerContentMenus: MenuPair<ContainerContentMenu>;
  readonly canvasMenus: MenuPair<PointerMenu>;
  /** The open connection menu, when its connection still exists. */
  readonly connectionMenu: AnchoredMenu | null;
  /** The element a menu belongs to, or undefined once it no longer exists. */
  readonly elementOf: (id: string) => { readonly extensions?: ElementExtensions } | undefined;
  readonly isMultiTarget: (id: string) => boolean;
  readonly installedOnTargets: (id: string) => ReadonlySet<RetainedExtensionKey>;
  readonly extensionCommands: ExtensionCommands;
  readonly recentColors: readonly string[];
  readonly containerActions: ContainerMenuActions;
  readonly textCardActions: TextCardMenuActions;
  readonly textBlockActions: TextBlockMenuActions;
  readonly imageActions: ImageMenuActions;
  readonly hasCopiedItem: boolean;
  readonly onPaste: (clientX: number, clientY: number, containerId?: string) => void;
  readonly onCreateTextCardInContainer: (
    containerId: string,
    clientX: number,
    clientY: number,
  ) => void;
  readonly canvasActions: {
    readonly onCreateContainer: (clientX: number, clientY: number) => void;
    readonly onCreateTextCard: (clientX: number, clientY: number) => void;
    readonly onCreateTextBlock: (clientX: number, clientY: number) => void;
    readonly onCreateImage: (clientX: number, clientY: number) => void;
    readonly onCreateMindmap: (clientX: number, clientY: number) => void;
    readonly onClear: () => void;
  };
  readonly onDeleteConnection: (connectionId: string) => void;
}

/** Each menu of a pair, the closing copy keyed apart so its exit plays while a new one opens. */
function both<State>(pair: MenuPair<State>, render: (menu: State, closing: boolean) => ReactNode) {
  return (
    <>
      {pair.menu ? render(pair.menu, false) : null}
      {pair.closing ? render(pair.closing, true) : null}
    </>
  );
}

const anchoredKey = (menu: AnchoredMenu, closing: boolean) =>
  `${closing ? "closing-" : ""}${menu.id}-${menu.left}-${menu.top}`;
const pointerKey = (menu: PointerMenu, closing: boolean) =>
  `${closing ? "closing-" : ""}${menu.clientX}-${menu.clientY}`;

/** The canvas's context menus: element menus, the container content menu and the canvas menu. */
export function RetainedCanvasMenus(props: RetainedCanvasMenusProps) {
  const documentElements = useRetainedDocumentElements();
  const elementMenu = (id: string) => {
    const target = props.elementOf(id);
    return {
      exists: target !== undefined,
      shared: {
        isMultiTarget: props.isMultiTarget(id),
        extensions: target?.extensions,
        installedOnTargets: props.installedOnTargets(id),
        extensionCommands: props.extensionCommands,
      },
    };
  };

  return (
    <>
      {both(props.containerMenus, (menu, closing) => {
        const element = asContainerDocumentElement(documentElements[menu.id as ElementId]);
        const { exists, shared } = elementMenu(menu.id);
        if (!exists || !element) return null;
        return (
          <ContainerMenu
            key={anchoredKey(menu, closing)}
            element={element}
            position={menu}
            closing={closing}
            {...shared}
            actions={props.containerActions}
          />
        );
      })}
      {both(props.containerContentMenus, (menu, closing) => (
        <ContainerContentContextMenu
          key={`${closing ? "closing-" : ""}${menu.containerId}-${menu.clientX}-${menu.clientY}`}
          menu={menu}
          hasCopiedItem={props.hasCopiedItem}
          closing={closing}
          onPaste={props.onPaste}
          onCreateTextCard={props.onCreateTextCardInContainer}
        />
      ))}
      {both(props.textCardMenus, (menu, closing) => {
        const element = asTextCardRendererElement(documentElements[menu.id as ElementId]);
        const { exists, shared } = elementMenu(menu.id);
        if (!exists || !element) return null;
        return (
          <TextCardMenu
            key={anchoredKey(menu, closing)}
            element={element}
            position={menu}
            closing={closing}
            {...shared}
            recentColors={props.recentColors}
            actions={props.textCardActions}
          />
        );
      })}
      {both(props.textBlockMenus, (menu, closing) => {
        const element = asTextBlockDocumentElement(documentElements[menu.id as ElementId]);
        const { exists, shared } = elementMenu(menu.id);
        if (!exists || !element) return null;
        return (
          <TextBlockMenu
            key={anchoredKey(menu, closing)}
            element={element}
            position={menu}
            closing={closing}
            {...shared}
            actions={props.textBlockActions}
          />
        );
      })}
      {both(props.imageMenus, (menu, closing) => {
        const element = asImageDocumentElement(documentElements[menu.id as ElementId]);
        const { exists, shared } = elementMenu(menu.id);
        if (!exists || !element) return null;
        return (
          <ImageMenu
            key={anchoredKey(menu, closing)}
            element={element}
            position={menu}
            closing={closing}
            {...shared}
            actions={props.imageActions}
          />
        );
      })}
      {props.connectionMenu ? (
        <MindMapConnectionMenu
          position={props.connectionMenu}
          connectionId={props.connectionMenu.id}
          onDelete={props.onDeleteConnection}
        />
      ) : null}
      {both(props.canvasMenus, (menu, closing) => (
        <CanvasContextMenu
          key={pointerKey(menu, closing)}
          menu={menu}
          hasCopiedItem={props.hasCopiedItem}
          closing={closing}
          onPaste={props.onPaste}
          onCreate={props.canvasActions.onCreateContainer}
          onCreateTextCard={props.canvasActions.onCreateTextCard}
          onCreateTextBlock={props.canvasActions.onCreateTextBlock}
          onCreateImage={props.canvasActions.onCreateImage}
          onCreateMindmap={props.canvasActions.onCreateMindmap}
          onClear={props.canvasActions.onClear}
        />
      ))}
    </>
  );
}
