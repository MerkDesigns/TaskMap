import { ActionIcon, Button, Menu, NumberInput, TextInput } from "@mantine/core";
import { IconCheck, IconDotsVertical, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { type PointerEvent, type Ref, useState } from "react";
import type { CanvasRecord, DocumentElement } from "../../domain/document/documentTypes";
import {
  LiquidMaterialSurface,
  type LiquidMaterialSurfaceHandle,
} from "../../ui/materials/liquid-dom";
import { CanvasPreview } from "./CanvasPreview";
import { normalizeCanvasDraft, type CanvasDraft } from "./canvasWorkspaceCommands";

export interface CanvasCardProps {
  readonly canvas: CanvasRecord;
  readonly elements: readonly DocumentElement[];
  readonly active: boolean;
  readonly minimal: boolean;
  readonly dragging: boolean;
  readonly canDelete: boolean;
  readonly surfaceRef: Ref<LiquidMaterialSurfaceHandle>;
  readonly cardRef: Ref<HTMLDivElement>;
  readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onSelect: () => void;
  readonly onUpdate: (draft: CanvasDraft) => void;
  readonly onDelete: () => void;
  readonly suppressSelection: () => boolean;
}

export function CanvasCard(props: CanvasCardProps) {
  const { canvas, minimal, active, dragging } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CanvasDraft>({
    name: canvas.name,
    width: canvas.settings.width,
    height: canvas.settings.height,
  });
  const save = () => {
    props.onUpdate(normalizeCanvasDraft(draft));
    setEditing(false);
  };
  const beginEdit = () => {
    setDraft({
      name: canvas.name,
      width: canvas.settings.width,
      height: canvas.settings.height,
    });
    setEditing(true);
  };

  return (
    <LiquidMaterialSurface
      ref={props.surfaceRef}
      role="small-panel"
      sceneOrder={20}
      className={`taskmap-canvas-card-anchor ${minimal ? "is-minimal" : ""} ${editing ? "is-editing" : ""}`}
    >
      <div
        ref={props.cardRef}
        className={`taskmap-canvas-card ${active ? "is-active" : ""} ${dragging ? "is-dragging" : ""}`}
        onPointerDown={props.onPointerDown}
        onClick={() => {
          if (!props.suppressSelection()) props.onSelect();
        }}
      >
        <span className="taskmap-canvas-card__active-bar" />
        {editing ? (
          <CanvasCardEditor
            draft={draft}
            onChange={setDraft}
            onSave={save}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            {!minimal ? <CanvasPreview canvas={canvas} elements={props.elements} /> : null}
            <div className="taskmap-canvas-card__details">
              <strong>{canvas.name}</strong>
              {!minimal ? (
                <span>
                  {canvas.settings.width} × {canvas.settings.height}
                </span>
              ) : null}
            </div>
            <Menu withinPortal position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={`Canvas options for ${canvas.name}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <IconDotsVertical size={15} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconPencil size={15} />} onClick={beginEdit}>
                  Edit canvas
                </Menu.Item>
                <Menu.Item
                  color="red"
                  disabled={!props.canDelete}
                  leftSection={<IconTrash size={15} />}
                  onClick={props.onDelete}
                >
                  Delete canvas
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        )}
      </div>
    </LiquidMaterialSurface>
  );
}

function CanvasCardEditor({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  readonly draft: CanvasDraft;
  readonly onChange: (draft: CanvasDraft) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div className="taskmap-canvas-card__editor" onClick={(event) => event.stopPropagation()}>
      <TextInput
        size="xs"
        aria-label="Canvas name"
        value={draft.name}
        onChange={(event) => onChange({ ...draft, name: event.currentTarget.value })}
      />
      <div className="taskmap-canvas-card__dimensions">
        <NumberInput
          size="xs"
          aria-label="Canvas width"
          min={600}
          max={10_000}
          value={draft.width}
          onChange={(value) => onChange({ ...draft, width: Number(value) })}
        />
        <NumberInput
          size="xs"
          aria-label="Canvas height"
          min={600}
          max={10_000}
          value={draft.height}
          onChange={(value) => onChange({ ...draft, height: Number(value) })}
        />
      </div>
      <Button.Group className="taskmap-canvas-card__edit-actions">
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={onCancel}
          leftSection={<IconX size={13} />}
        >
          Cancel
        </Button>
        <Button size="compact-xs" onClick={onSave} leftSection={<IconCheck size={13} />}>
          Save
        </Button>
      </Button.Group>
    </div>
  );
}
