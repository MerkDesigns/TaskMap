import { ActionIcon, Button, NumberInput, Popover, TextInput, Tooltip } from "@mantine/core";
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPlus,
  IconStack2,
} from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";
import { useAppStore } from "../../app/hooks";
import type { DocumentElement, TaskMapDocument } from "../../domain/document/documentTypes";
import type { CanvasId } from "../../domain/ids/entityIds";
import { CanvasCard } from "./CanvasCard";
import {
  createCanvas,
  deleteCanvas,
  normalizeCanvasDraft,
  reorderCanvases,
  selectCanvas,
  updateCanvas,
  type CanvasDraft,
} from "./canvasWorkspaceCommands";
import { useCanvasPointerReorder } from "./useCanvasPointerReorder";

export interface CanvasBrowserProps {
  readonly document: TaskMapDocument | null;
  readonly minimal: boolean;
  readonly onMinimalChange: (minimal: boolean) => void;
}

const DEFAULT_DRAFT: CanvasDraft = { name: "", width: 3_000, height: 3_000 };

export function CanvasBrowser({ document, minimal, onMinimalChange }: CanvasBrowserProps) {
  const store = useAppStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const order = useMemo(() => document?.canvasOrder ?? [], [document?.canvasOrder]);
  const commitOrder = useCallback(
    (nextOrder: readonly CanvasId[]) => reorderCanvases(store.workspace, nextOrder),
    [store],
  );
  const reorder = useCanvasPointerReorder(order, commitOrder, document);
  const elementsByCanvas = useMemo(() => {
    const result = new Map<CanvasId, DocumentElement[]>();
    if (!document) return result;
    for (const element of Object.values(document.elements)) {
      const elements = result.get(element.canvasId) ?? [];
      elements.push(element);
      result.set(element.canvasId, elements);
    }
    return result;
  }, [document]);

  const openCreate = () => {
    setDraft({
      name: `Canvas ${(document?.canvasOrder.length ?? 0) + 1}`,
      width: 3_000,
      height: 3_000,
    });
    setCreateOpen(true);
  };
  const submitCreate = () => {
    createCanvas(store.workspace, normalizeCanvasDraft(draft));
    setCreateOpen(false);
    setDraft(DEFAULT_DRAFT);
  };

  return (
    <section
      className={`taskmap-canvas-browser ${minimal ? "is-minimal" : ""}`}
      aria-label="Canvases"
    >
      <header className="taskmap-browser-header">
        <div className="taskmap-browser-heading">
          <IconStack2 size={19} />
          {!minimal ? <strong>Canvases</strong> : null}
          <span className="taskmap-browser-count">{order.length}</span>
        </div>
        <div className="taskmap-browser-actions">
          <Tooltip label={minimal ? "Full view" : "Minimal view"}>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={minimal ? "Use full canvas browser" : "Use minimal canvas browser"}
              onClick={() => onMinimalChange(!minimal)}
            >
              {minimal ? (
                <IconLayoutSidebarLeftExpand size={17} />
              ) : (
                <IconLayoutSidebarLeftCollapse size={17} />
              )}
            </ActionIcon>
          </Tooltip>
          <Popover opened={createOpen} onChange={setCreateOpen} position="bottom-end" withinPortal>
            <Popover.Target>
              <ActionIcon
                variant="light"
                aria-label="Create canvas"
                disabled={!document}
                onClick={openCreate}
              >
                <IconPlus size={17} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <CanvasCreateForm draft={draft} onChange={setDraft} onCreate={submitCreate} />
            </Popover.Dropdown>
          </Popover>
        </div>
      </header>

      <div className="taskmap-canvas-browser__list" data-testid="canvas-browser-list">
        {reorder.displayOrder.map((canvasId) => {
          const canvas = document?.canvases[canvasId];
          if (!canvas) return null;
          return (
            <CanvasCard
              key={canvasId}
              canvas={canvas}
              elements={elementsByCanvas.get(canvasId) ?? []}
              active={document.activeCanvasId === canvasId}
              minimal={minimal}
              dragging={reorder.draggingId === canvasId}
              canDelete={order.length > 1}
              surfaceRef={(handle) => reorder.registerSurface(canvasId, handle)}
              cardRef={(node) => reorder.registerCardNode(canvasId, node)}
              onPointerDown={(event) => reorder.onPointerDown(canvasId, event)}
              suppressSelection={reorder.consumeSuppressedClick}
              onSelect={() => selectCanvas(store.workspace, canvasId)}
              onUpdate={(nextDraft) => updateCanvas(store.workspace, canvasId, nextDraft)}
              onDelete={() => deleteCanvas(store.workspace, canvasId)}
            />
          );
        })}
        {!document ? (
          <p className="taskmap-browser-empty">Open a TaskMap document to browse its canvases.</p>
        ) : null}
      </div>
    </section>
  );
}

function CanvasCreateForm({
  draft,
  onChange,
  onCreate,
}: {
  readonly draft: CanvasDraft;
  readonly onChange: (draft: CanvasDraft) => void;
  readonly onCreate: () => void;
}) {
  return (
    <div className="taskmap-canvas-create-form">
      <strong>New canvas</strong>
      <TextInput
        size="xs"
        label="Name"
        value={draft.name}
        onChange={(event) => onChange({ ...draft, name: event.currentTarget.value })}
      />
      <div className="taskmap-canvas-card__dimensions">
        <NumberInput
          size="xs"
          label="Width"
          min={600}
          max={10_000}
          value={draft.width}
          onChange={(value) => onChange({ ...draft, width: Number(value) })}
        />
        <NumberInput
          size="xs"
          label="Height"
          min={600}
          max={10_000}
          value={draft.height}
          onChange={(value) => onChange({ ...draft, height: Number(value) })}
        />
      </div>
      <Button size="xs" fullWidth onClick={onCreate}>
        Create canvas
      </Button>
    </div>
  );
}
