import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { CanvasContextMenu, ContainerContextMenu } from "../components/ContextMenus";
import { ContainerNode } from "../components/ContainerNode";
import { EXTENSION_REGISTRY } from "../extensions/registry";
import { CanvasFrame } from "../ui/patterns/workspace/CanvasFrame";
import type { ContainerElement, ContainerMenuState, ElementExtensions } from "../types";
import "./contextMenuPlayground.css";

type PlaygroundMenu =
  | { readonly kind: "container"; readonly value: ContainerMenuState }
  | { readonly kind: "canvas"; readonly value: { clientX: number; clientY: number } };

const CONTENT_REVISION = {};

function createPlaygroundContainer(): ContainerElement {
  return {
    id: "ui-lab-context-menu-container",
    name: "Production Container",
    x: 56,
    y: 56,
    width: 440,
    height: 260,
    accent: "#9f4f42",
    headerButtonsVisible: true,
    extensions: {
      search: EXTENSION_REGISTRY.search.createDefault(),
      lock: EXTENSION_REGISTRY.lock.createDefault(),
      colorPicker: EXTENSION_REGISTRY.colorPicker.createDefault(),
    },
  };
}

export function ContextMenuPlayground() {
  const [element, setElement] = useState(createPlaygroundContainer);
  const [menu, setMenu] = useState<PlaygroundMenu | null>(null);
  const [selected, setSelected] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(element.name);

  const openContainerMenu = (
    event: ReactMouseEvent<HTMLElement>,
    target: ContainerElement = element,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({
      kind: "container",
      value: { id: target.id, left: event.clientX, top: event.clientY },
    });
  };

  const removeExtension = (extensionId: keyof ElementExtensions) => {
    setElement((current) => {
      const extensions = { ...current.extensions };
      delete extensions[extensionId];
      return { ...current, extensions };
    });
    setMenu(null);
  };

  const closeMenu = () => setMenu(null);

  return (
    <section
      className="taskmap-ui-lab-context-menu"
      aria-labelledby="context-menu-playground-title"
      onPointerDownCapture={(event) => {
        if (!(event.target as Element).closest("[data-context-menu]")) closeMenu();
      }}
    >
      <div className="taskmap-ui-lab-prototype__heading">
        <span className="taskmap-ui-lab__eyebrow">Production canvas interaction</span>
        <h2 id="context-menu-playground-title">Context Menu playground</h2>
        <p>Right-click the Container or empty canvas space.</p>
      </div>

      <CanvasFrame
        className="taskmap-ui-lab-context-menu__canvas"
        aria-label="Context menu playground canvas"
        data-grid-style="dots"
        onContextMenu={(event) => {
          event.preventDefault();
          if (event.target !== event.currentTarget) return;
          setSelected(false);
          setMenu({
            kind: "canvas",
            value: { clientX: event.clientX, clientY: event.clientY },
          });
        }}
      >
        <div className="taskmap-ui-lab-context-menu__container" onContextMenu={openContainerMenu}>
          <ContainerNode
            element={element}
            selected={selected}
            multiSelected={false}
            entering={false}
            deleting={false}
            moving={false}
            shadowsUnderElements={false}
            recentColors={[]}
            renaming={renaming}
            renameDraft={renameDraft}
            onRenameDraftChange={setRenameDraft}
            onSaveRename={() => {
              setElement((current) => ({ ...current, name: renameDraft.trim() || current.name }));
              setRenaming(false);
            }}
            onCancelRename={() => setRenaming(false)}
            onSelect={() => setSelected(true)}
            onStartMove={(event) => event.preventDefault()}
            onStartResize={(event) => event.preventDefault()}
            onToggleMenu={openContainerMenu}
            onTogglePrivacy={() => undefined}
            onToggleLock={() =>
              setElement((current) => ({
                ...current,
                extensions: {
                  ...current.extensions,
                  lock: {
                    enabled: !current.extensions?.lock?.enabled,
                  },
                },
              }))
            }
            onUpdateAccent={(_, accent) => setElement((current) => ({ ...current, accent }))}
            onRememberRecentColor={() => undefined}
            onTogglePickCard={() => undefined}
            onCopyJsonForAi={async () => undefined}
            onPasteJsonFromAi={async () => undefined}
            onOpenJsonEditor={() => undefined}
            onHeaderButtonsVisibleChange={(_, visible) =>
              setElement((current) => ({ ...current, headerButtonsVisible: visible }))
            }
            onSetSort={() => undefined}
            onSearchChange={(_, query) =>
              setElement((current) => ({
                ...current,
                extensions: { ...current.extensions, search: { query } },
              }))
            }
            onOpenContentMenu={openContainerMenu}
            onWheelContent={() => undefined}
            onStartContentSelection={(event) => event.stopPropagation()}
            cardCount={0}
            contentRevision={CONTENT_REVISION}
            contentEditRevision="ui-lab-context-menu"
          />
        </div>
      </CanvasFrame>

      {menu?.kind === "container" ? (
        <ContainerContextMenu
          menu={menu.value}
          element={element}
          closing={false}
          onStartRename={() => {
            setRenameDraft(element.name);
            setRenaming(true);
            closeMenu();
          }}
          onUpdateAccent={(_, accent) => setElement((current) => ({ ...current, accent }))}
          onCut={closeMenu}
          onCopy={closeMenu}
          onRemovePrivacyExtension={() => removeExtension("privacy")}
          onRemoveSearchExtension={() => removeExtension("search")}
          onRemoveSortingExtension={() => removeExtension("sorting")}
          onRemoveLockExtension={() => removeExtension("lock")}
          onRemoveColorPickerExtension={() => removeExtension("colorPicker")}
          onRemoveAutoCheckboxExtension={() => removeExtension("autoCheckbox")}
          onRemoveDailyResetExtension={() => removeExtension("dailyReset")}
          onRemoveCounterExtension={() => removeExtension("counter")}
          onRemoveInheritCardColorExtension={() => removeExtension("inheritCardColor")}
          onRemovePickCardExtension={() => removeExtension("pickCard")}
          onRemoveCopyPasteJsonExtension={() => removeExtension("copyPasteJson")}
          onMoveLayer={closeMenu}
          onDelete={closeMenu}
        />
      ) : null}

      {menu?.kind === "canvas" ? (
        <CanvasContextMenu
          menu={menu.value}
          hasCopiedItem={false}
          closing={false}
          onPaste={closeMenu}
          onCreate={closeMenu}
          onCreateTextCard={closeMenu}
          onCreateTextBlock={closeMenu}
          onCreateImage={closeMenu}
          onCreateMindmap={closeMenu}
          onClear={closeMenu}
        />
      ) : null}
    </section>
  );
}
