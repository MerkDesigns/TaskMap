import { useMemo, useRef, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import { captureRetainedLinkEdit } from "../app/commands/retainedEditorCallbacks";
import type { ElementId } from "../domain/ids/entityIds";
import type { ContainerActions } from "../elements/container/containerView";
import type { ContainerMenuActions } from "../elements/container/ContainerMenu";
import type { ImageMenuActions } from "../elements/image/ImageMenu";
import type { ImageActions } from "../elements/image/ImageRenderer";
import type { TextBlockMenuActions } from "../elements/text-block/TextBlockMenu";
import type { TextBlockActions } from "../elements/text-block/textBlockView";
import type { TextCardMenuActions } from "../elements/text-card/TextCardMenu";
import type { TextCardActions } from "../elements/text-card/TextCardRenderer";
import type { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";
import type { useCanvasGestures } from "./useCanvasGestures";
import type { useCanvasMenus } from "./useCanvasMenus";
import type { RetainedInlineEdit } from "./useRetainedInlineEdit";

type LayerDirection = "back" | "backward" | "forward" | "front";

export interface RetainedElementActionPorts {
  readonly callbacks: RetainedActionCallbacks;
  readonly find: {
    readonly container: (id: string) => ContainerElement | undefined;
    readonly textBlock: (id: string) => TextBlockElement | undefined;
    readonly image: (id: string) => ImageElement | undefined;
    readonly card: (id: string) => TextCardElement | undefined;
  };
  readonly menus: ReturnType<typeof useCanvasMenus>;
  readonly gestures: ReturnType<typeof useCanvasGestures>;
  readonly rename: RetainedInlineEdit;
  readonly cardEdit: RetainedInlineEdit;
  readonly blockEdit: RetainedInlineEdit;
  readonly select: (ids: string[], additive?: boolean) => void;
  readonly pulse: (kind: "textCards" | "textBlocks", id: string) => void;
  /** Context menu commands, applied to the element or the selection it is in. */
  readonly context: {
    readonly updateAccent: (id: string, accent: string) => void;
    readonly cut: (id: string) => void;
    readonly copy: (id: string) => void;
    readonly moveLayer: (id: string, direction: LayerDirection) => void;
    readonly remove: (id: string) => void;
  };
  readonly pickImage: (id: string) => void;
  readonly wheelContainer: (event: WheelEvent<HTMLElement>, container: ContainerElement) => void;
  readonly rememberCardSize: (id: string, size: { width: number; height: number }) => void;
}

/**
 * What each element's controls and context menu do: renaming frames, editing card and text block
 * text in place (pulsing the element when an edit ends), selecting, moving, resizing, opening
 * menus and the per-element content toggles. The returned action objects keep their identity, so
 * memoized element renderers do not rerender when App does.
 */
export function useRetainedElementActions(ports: RetainedElementActionPorts) {
  const latest = useRef(ports);
  latest.current = ports;

  return useMemo(() => {
    const p = () => latest.current;
    const content = (id: string, to: Record<string, string | boolean | null>) =>
      p()
        .callbacks.captureContent([{ elementId: id as ElementId, fields: Object.keys(to) }])
        ?.complete([{ elementId: id as ElementId, to }]);
    const withElement =
      <T>(find: (ports: RetainedElementActionPorts) => (id: string) => T | undefined) =>
      (id: string, action: (element: T) => void) => {
        const element = find(p())(id);
        if (element) action(element);
      };
    const withContainer = withElement((ports) => ports.find.container);
    const withTextBlock = withElement((ports) => ports.find.textBlock);
    const withImage = withElement((ports) => ports.find.image);
    const withCard = withElement((ports) => ports.find.card);

    const startRename = (element: ContainerElement | TextBlockElement) => {
      p().rename.begin(element.id, element.name);
      p().menus.closeAll();
    };
    const saveRename = () => {
      p().rename.complete();
      p().menus.closeAll();
    };
    const cancelRename = () => p().rename.end();
    const saveCardEdit = (id: string) => {
      p().cardEdit.complete();
      p().pulse("textCards", id);
    };
    const saveBlockEdit = (id: string) => {
      p().blockEdit.complete();
      p().pulse("textBlocks", id);
    };
    /** Ends an edit without saving, pulsing the element it was on. */
    const cancelEdit = (edit: RetainedInlineEdit, kind: "textCards" | "textBlocks") => {
      if (edit.editingId) p().pulse(kind, edit.editingId);
      edit.end();
    };
    const setHeaderButtonsVisible = (id: string, visible: boolean) =>
      content(id, { headerButtonsVisible: visible });
    const contextMenu = {
      onUpdateAccent: (id: string, accent: string) => p().context.updateAccent(id, accent),
      onCut: (id: string) => p().context.cut(id),
      onCopy: (id: string) => p().context.copy(id),
      onMoveLayer: (id: string, direction: LayerDirection) => p().context.moveLayer(id, direction),
      onDelete: (id: string) => p().context.remove(id),
    };

    const container: ContainerActions = {
      onRenameDraftChange: (draft) => p().rename.setDraft(draft),
      onSaveRename: saveRename,
      onCancelRename: cancelRename,
      onSelect: (id, additive) => withContainer(id, () => p().select([id], additive)),
      onStartMove: (event, id) => withContainer(id, (box) => p().gestures.moveFrame(event, box)),
      onStartResize: (event, id) =>
        withContainer(id, (box) => p().gestures.resizeFrame(event, box)),
      onToggleMenu: (event, id) =>
        withContainer(id, () => p().menus.toggleBeside("container", event, id)),
      onHeaderButtonsVisibleChange: setHeaderButtonsVisible,
      onOpenContentMenu: (event, id) =>
        withContainer(id, () => p().menus.openContainerContent(event, id)),
      onWheelContent: (event, id) => withContainer(id, (box) => p().wheelContainer(event, box)),
      onStartContentSelection: (event, id) =>
        withContainer(id, (box) => p().gestures.containerContentPointerDown(event, box)),
    };
    const containerMenu: ContainerMenuActions = {
      ...contextMenu,
      onStartRename: (id) => withContainer(id, startRename),
    };
    const textBlock: TextBlockActions = {
      onDraftChange: (draft) => p().blockEdit.setDraft(draft),
      onSave: saveBlockEdit,
      onCancel: () => cancelEdit(p().blockEdit, "textBlocks"),
      onRenameDraftChange: (draft) => p().rename.setDraft(draft),
      onSaveRename: saveRename,
      onCancelRename: cancelRename,
      onStartEdit: (id) =>
        withTextBlock(id, (block) => {
          p().blockEdit.begin(block.id, block.text);
          p().select([block.id]);
          p().rename.end();
          p().menus.closeAll();
        }),
      onSelect: (id, additive) => withTextBlock(id, () => p().select([id], additive)),
      onStartMove: (event, id) =>
        withTextBlock(id, (block) => p().gestures.moveFrame(event, block)),
      onStartResize: (event, id) =>
        withTextBlock(id, (block) => p().gestures.resizeFrame(event, block)),
      onToggleMenu: (event, id) =>
        withTextBlock(id, () => p().menus.toggleBeside("textBlock", event, id)),
      onHeaderButtonsVisibleChange: setHeaderButtonsVisible,
    };
    const textBlockMenu: TextBlockMenuActions = {
      ...contextMenu,
      onStartRename: (id) => withTextBlock(id, startRename),
    };
    const image: ImageActions = {
      onStartMove: (event, id) =>
        withImage(id, (picture) => p().gestures.moveImage(event, picture)),
      onStartResize: (event, id) =>
        withImage(id, (picture) => p().gestures.resizeImage(event, picture)),
      onOpenMenu: (event, id) => withImage(id, () => p().menus.openAtPointer("image", event, id)),
      onPick: (id) => p().pickImage(id),
    };
    const imageMenu: ImageMenuActions = {
      ...contextMenu,
      onReplace: (id) => p().pickImage(id),
      onToggleBackground: (id) => {
        content(id, { background: p().find.image(id)?.background === false });
        p().menus.closeAll();
      },
    };
    const textCard: TextCardActions = {
      onDraftChange: (draft) => p().cardEdit.setDraft(draft),
      onSave: saveCardEdit,
      onCancel: () => cancelEdit(p().cardEdit, "textCards"),
      onStartMove: (event: PointerEvent<HTMLElement>, id: string) =>
        withCard(id, (card) => p().gestures.moveTextCard(event, card)),
      onOpenMenu: (event: MouseEvent<HTMLElement>, id: string) =>
        p().menus.openAtPointer("textCard", event, id),
      onSizeChange: (id, size) => p().rememberCardSize(id, size),
    };
    const textCardMenu: TextCardMenuActions = {
      ...contextMenu,
      onStartEdit: (id) =>
        withCard(id, (card) => {
          p().cardEdit.begin(card.id, card.text);
          p().menus.closeAll();
        }),
      onUpdateLink: (id, link) =>
        captureRetainedLinkEdit(p().callbacks, id as ElementId)?.complete(link),
    };

    return {
      container,
      containerMenu,
      textBlock,
      textBlockMenu,
      image,
      imageMenu,
      textCard,
      textCardMenu,
      saveRename,
      saveCardEdit,
      saveBlockEdit,
    };
  }, []);
}
