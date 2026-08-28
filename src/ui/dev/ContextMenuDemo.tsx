import {
  IconArrowAutofitDown,
  IconArrowAutofitDownFilled,
  IconArrowAutofitUp,
  IconArrowAutofitUpFilled,
  IconCopy,
  IconCut,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  Button,
  ContextMenu,
  ContextMenuActionGroup,
  ContextMenuDivider,
  ContextMenuIconAction,
  ContextMenuItem,
  ContextMenuSection,
  Inline,
} from "../primitives";
import {
  LAB_CONTAINER_ACCENTS,
  LAB_CONTAINER_EXTENSION_LABELS,
} from "./containerContextMenuFixture";
import "./ContextMenuDemo.css";

export function ContextMenuDemo({ embedded = false }: { readonly embedded?: boolean }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const position = useLabContextMenuPosition(triggerRef, menuRef, open);
  const [accent, setAccent] = useState<string>(LAB_CONTAINER_ACCENTS[5].accent);
  const [status, setStatus] = useState("No mock action selected");
  const runAction = useCallback((label: string) => {
    setStatus(label);
    setOpen(false);
  }, []);

  const content = (
    <>
      <Inline gap="large">
        <Button ref={triggerRef} onClick={() => setOpen((current) => !current)}>
          Open container context menu
        </Button>
        <span className="taskmap-ui-lab__muted" aria-live="polite">
          {status}
        </span>
      </Inline>
      <ContextMenu
        ref={menuRef}
        label="Container context menu example"
        open={open}
        onOpenChange={setOpen}
        position={position}
        returnFocusRef={triggerRef}
      >
        <ContextMenuItem
          data-menu-section="edit"
          icon={<IconPencil />}
          onClick={() => runAction("Edit Container")}
        >
          Edit Container
        </ContextMenuItem>
        <ContextMenuDivider />
        <div className="taskmap-context-menu-demo__swatches" data-menu-section="colors">
          {LAB_CONTAINER_ACCENTS.map((preset) => (
            <button
              key={preset.accent}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-label={`Container accent ${preset.swatch}`}
              aria-pressed={accent === preset.accent}
              className="taskmap-context-menu-demo__swatch"
              style={{ backgroundColor: preset.swatch }}
              onClick={() => {
                setAccent(preset.accent);
                setStatus(`Container accent ${preset.swatch}`);
              }}
            />
          ))}
        </div>
        <ContextMenuDivider />
        <ContextMenuActionGroup label="Layer order" data-menu-section="layers">
          <ContextMenuIconAction
            icon={<IconArrowAutofitDown />}
            aria-label="Send to back"
            onClick={() => runAction("Send to back")}
          />
          <ContextMenuIconAction
            icon={<IconArrowAutofitDownFilled />}
            aria-label="Send one layer back"
            onClick={() => runAction("Send one layer back")}
          />
          <ContextMenuIconAction
            icon={<IconArrowAutofitUpFilled />}
            aria-label="Bring one layer forward"
            onClick={() => runAction("Bring one layer forward")}
          />
          <ContextMenuIconAction
            icon={<IconArrowAutofitUp />}
            aria-label="Bring to front"
            onClick={() => runAction("Bring to front")}
          />
        </ContextMenuActionGroup>
        <ContextMenuDivider />
        <div data-menu-section="clipboard">
          <ContextMenuItem icon={<IconCut />} onClick={() => runAction("Cut")}>
            Cut
          </ContextMenuItem>
          <ContextMenuItem icon={<IconCopy />} onClick={() => runAction("Copy")}>
            Copy
          </ContextMenuItem>
        </div>
        <ContextMenuDivider />
        <ContextMenuSection
          label="Remove Extensions"
          data-menu-section="extensions"
          aria-label="Representative installed extensions"
        >
          {LAB_CONTAINER_EXTENSION_LABELS.map((label) => (
            <ContextMenuItem
              key={label}
              icon={<IconTrash />}
              onClick={() => runAction(`Remove extension: ${label}`)}
            >
              {label}
            </ContextMenuItem>
          ))}
        </ContextMenuSection>
        <ContextMenuDivider />
        <ContextMenuItem
          danger
          data-menu-section="remove"
          icon={<IconTrash />}
          onClick={() => runAction("Remove")}
        >
          Remove
        </ContextMenuItem>
      </ContextMenu>
    </>
  );
  if (embedded) {
    return (
      <div
        className="taskmap-context-menu-demo--playground"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span>Context menu</span>
        {content}
      </div>
    );
  }
  return (
    <section className="taskmap-ui-lab__section">
      <h2>Context menu</h2>
      {content}
    </section>
  );
}

function useLabContextMenuPosition(
  triggerRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
  open: boolean,
) {
  const [position, setPosition] = useState({ left: 8, top: 8 });
  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const triggerBounds = trigger.getBoundingClientRect();
      const menuBounds = menu.getBoundingClientRect();
      const left = Math.max(
        8,
        Math.min(triggerBounds.left, window.innerWidth - menuBounds.width - 8),
      );
      const below = triggerBounds.bottom + 6;
      const top =
        below + menuBounds.height <= window.innerHeight - 8
          ? below
          : Math.max(8, triggerBounds.top - menuBounds.height - 6);
      setPosition({ left, top });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuRef, open, triggerRef]);
  return position;
}
