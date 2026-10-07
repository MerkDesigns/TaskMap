import { useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useClosingMenu } from "./useClosingMenu";

/** A context menu opened for one element, at a screen position. */
export type AnchoredMenu = { readonly id: string; readonly left: number; readonly top: number };
type PointerMenu = { readonly clientX: number; readonly clientY: number };
type ContainerContentMenu = PointerMenu & { readonly containerId: string };

/** Right-click menus open just below and right of the pointer. */
const POINTER_OFFSET = 8;

export interface CanvasMenuPorts {
  readonly selection: () => readonly string[];
  readonly select: (ids: string[]) => void;
  readonly endRename: () => void;
  readonly endTextCardEdit: () => void;
  /** Connection menus open only while connection mode shows the connections as targets. */
  readonly connectionMode: () => boolean;
}

/**
 * The canvas's context menus and how each opens: right-click menus at the pointer (selecting the
 * element unless it is already selected), header menus beside their button (a second press closes
 * them), the container content menu and the canvas menu. Opening one closes the others.
 */
export function useCanvasMenus(ports: CanvasMenuPorts) {
  const latest = useRef(ports);
  latest.current = ports;
  const container = useClosingMenu<AnchoredMenu>();
  const textBlock = useClosingMenu<AnchoredMenu>();
  const textCard = useClosingMenu<AnchoredMenu>();
  const image = useClosingMenu<AnchoredMenu>();
  const containerContent = useClosingMenu<ContainerContentMenu>();
  const canvas = useClosingMenu<PointerMenu>();
  const [connection, setConnection] = useState<AnchoredMenu | null>(null);
  const shown = useRef({ container: container.menu, textBlock: textBlock.menu });
  shown.current = { container: container.menu, textBlock: textBlock.menu };

  const closers = [container, textBlock, textCard, image, containerContent, canvas].map(
    (pair) => pair.close,
  );
  const opener = {
    container: container.open,
    textBlock: textBlock.open,
    textCard: textCard.open,
    image: image.open,
    containerContent: containerContent.open,
    canvas: canvas.open,
  };
  const stable = useRef({ closers, opener });

  const actions = useMemo(() => {
    const { closers: close, opener: open } = stable.current;
    const closeAll = () => {
      close.forEach((closeMenu) => closeMenu());
      setConnection(null);
    };
    const selectUnlessSelected = (id: string) => {
      if (!latest.current.selection().includes(id)) latest.current.select([id]);
    };

    /** Right-click menu of a text card or image, at the pointer. */
    const openAtPointer = (
      kind: "textCard" | "image",
      event: MouseEvent<HTMLElement>,
      id: string,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      closeAll();
      latest.current.endRename();
      if (kind === "textCard") latest.current.endTextCardEdit();
      selectUnlessSelected(id);
      open[kind]({ id, left: event.clientX + POINTER_OFFSET, top: event.clientY + POINTER_OFFSET });
    };

    /** Header menu of a container or text block, beside its button; a second press closes it. */
    const toggleBeside = (
      kind: "container" | "textBlock",
      event: MouseEvent<HTMLButtonElement>,
      id: string,
    ) => {
      event.stopPropagation();
      const button = event.currentTarget.getBoundingClientRect();
      selectUnlessSelected(id);
      latest.current.endRename();
      if (kind === "textBlock") latest.current.endTextCardEdit();
      const wasOpen = shown.current[kind]?.id === id;
      closeAll();
      if (!wasOpen) open[kind]({ id, left: button.right + POINTER_OFFSET, top: button.top });
    };

    const openContainerContent = (event: MouseEvent<HTMLElement>, containerId: string) => {
      event.preventDefault();
      event.stopPropagation();
      latest.current.select([containerId]);
      closeAll();
      latest.current.endRename();
      open.containerContent({ containerId, clientX: event.clientX, clientY: event.clientY });
    };

    const openCanvas = (clientX: number, clientY: number) => {
      latest.current.select([]);
      closeAll();
      latest.current.endRename();
      open.canvas({ clientX, clientY });
    };

    const openConnection = (event: PointerEvent<SVGPathElement>, connectionId: string) => {
      if (!latest.current.connectionMode()) return;
      event.preventDefault();
      event.stopPropagation();
      closeAll();
      setConnection({
        id: connectionId,
        left: event.clientX + POINTER_OFFSET,
        top: event.clientY + POINTER_OFFSET,
      });
    };

    return {
      closeAll,
      closeConnection: () => setConnection(null),
      openAtPointer,
      toggleBeside,
      openContainerContent,
      openCanvas,
      openConnection,
    };
  }, []);

  return useMemo(
    () => ({
      pairs: { container, textBlock, textCard, image, containerContent, canvas },
      connection,
      ...actions,
    }),
    [actions, canvas, connection, container, containerContent, image, textBlock, textCard],
  );
}
