import { IconArrowsHorizontal, IconArrowsVertical } from "@tabler/icons-react";
import type { KeyboardEvent, Ref } from "react";
import type { TaskCanvas } from "../types";
import { Field } from "../ui/primitives/Field";
import { TextField } from "../ui/primitives/FormControls";

export type CanvasDraft = Pick<TaskCanvas, "name" | "width" | "height">;

export interface CanvasDraftFieldsProps {
  readonly draft: CanvasDraft;
  readonly nameRef?: Ref<HTMLInputElement>;
  readonly onChange: (draft: CanvasDraft) => void;
  readonly onSubmit: () => void;
  /** Escape inside the name field; dialogs handle Escape themselves. */
  readonly onCancel?: () => void;
}

/** Name + size fields shared by the inline canvas editor and the Create Canvas dialog. */
export function CanvasDraftFields({
  draft,
  nameRef,
  onCancel,
  onChange,
  onSubmit,
}: CanvasDraftFieldsProps) {
  const submitOnEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter") onSubmit();
  };
  return (
    <>
      <Field label="Name">
        <TextField
          ref={nameRef}
          value={draft.name}
          placeholder="Canvas name"
          spellCheck={false}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          onKeyDown={(event) => {
            submitOnEnter(event);
            if (event.key === "Escape") onCancel?.();
          }}
        />
      </Field>
      <div className="taskmap-canvas-inline-editor__dimensions">
        <Field
          label={
            <span className="flex items-center gap-1">
              <IconArrowsHorizontal size={13} stroke={2} />
              Width
            </span>
          }
        >
          <TextField
            className="taskmap-canvas-inline-editor__number"
            type="number"
            min={600}
            max={10000}
            step={100}
            value={draft.width}
            spellCheck={false}
            onChange={(event) => onChange({ ...draft, width: Number(event.target.value) })}
            onKeyDown={submitOnEnter}
            title="Canvas width"
          />
        </Field>
        <Field
          label={
            <span className="flex items-center gap-1">
              <IconArrowsVertical size={13} stroke={2} />
              Height
            </span>
          }
        >
          <TextField
            className="taskmap-canvas-inline-editor__number"
            type="number"
            min={600}
            max={10000}
            step={100}
            value={draft.height}
            spellCheck={false}
            onChange={(event) => onChange({ ...draft, height: Number(event.target.value) })}
            onKeyDown={submitOnEnter}
            title="Canvas height"
          />
        </Field>
      </div>
    </>
  );
}
