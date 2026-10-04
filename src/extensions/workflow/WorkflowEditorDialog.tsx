import {
  IconArrowDown,
  IconArrowUp,
  IconDeviceFloppy,
  IconPlus,
  IconTerminal2,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import {
  ModalDialog,
  ModalDialogActions,
  ModalDialogBody,
  ModalDialogHeader,
  useDialogFocus,
} from "../../ui/patterns/overlays";
import {
  Button,
  Field,
  IconButton,
  SegmentedControl,
  Switch,
  TextArea,
  TextField,
} from "../../ui/primitives";
import {
  MAX_WORKFLOW_STEPS,
  workflowConfigurationSchema,
  type WorkflowStep,
} from "./workflowDefinition";
import "./workflow.css";

/** A step as the editor holds it: arguments as one line each, the directory as plain text. */
interface StepDraft {
  readonly key: number;
  readonly executable: string;
  readonly argumentLines: string;
  readonly workingDirectory: string;
  readonly display: WorkflowStep["display"];
  readonly waitForExit: boolean;
}

let nextDraftKey = 0;

const toDraft = (step: WorkflowStep): StepDraft => ({
  key: nextDraftKey++,
  executable: step.executable,
  argumentLines: step.arguments.join("\n"),
  workingDirectory: step.workingDirectory ?? "",
  display: step.display,
  waitForExit: step.waitForExit,
});

const emptyDraft = (): StepDraft =>
  toDraft({
    executable: "",
    arguments: [],
    workingDirectory: null,
    display: "terminal",
    waitForExit: false,
  });

/** Blank argument lines are dropped; every other line is one argument exactly as typed. */
const toStep = (draft: StepDraft): WorkflowStep => ({
  executable: draft.executable.trim(),
  arguments: draft.argumentLines.split(/\r?\n/).filter((line) => line.trim().length > 0),
  workingDirectory: draft.workingDirectory.trim() || null,
  display: draft.display,
  waitForExit: draft.waitForExit,
});

const DISPLAY_ITEMS = [
  { value: "terminal", label: "Terminal" },
  { value: "background", label: "Background" },
] as const;

export interface WorkflowEditorDialogProps {
  readonly initialSteps: readonly WorkflowStep[];
  /** Resolves false when the workflow could not be saved; the dialog then stays open. */
  readonly onSave: (steps: WorkflowStep[]) => Promise<boolean>;
  readonly onClose: () => void;
}

export function WorkflowEditorDialog({ initialSteps, onSave, onClose }: WorkflowEditorDialogProps) {
  const dialogRef = useDialogFocus();
  const [drafts, setDrafts] = useState<StepDraft[]>(() =>
    initialSteps.length > 0 ? initialSteps.map(toDraft) : [emptyDraft()],
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, saving]);

  const update = (key: number, change: Partial<StepDraft>) =>
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)),
    );
  const move = (index: number, offset: -1 | 1) =>
    setDrafts((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });

  const save = async () => {
    const steps = drafts.map(toStep);
    const blank = steps.findIndex((step) => !step.executable);
    if (blank >= 0) {
      setError(`Step ${blank + 1} needs a program to run.`);
      return;
    }
    if (!workflowConfigurationSchema.safeParse({ steps }).success) {
      setError("A step is too long or contains characters that cannot be run.");
      return;
    }
    setError("");
    setSaving(true);
    const saved = await onSave(steps);
    setSaving(false);
    if (!saved) setError("The workflow could not be saved. Try again.");
  };

  return (
    <ModalDialog
      ref={dialogRef}
      width={560}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workflow-editor-title"
      tabIndex={-1}
      data-production-dialog="workflow-editor"
    >
      <ModalDialogHeader
        titleId="workflow-editor-title"
        title="Edit workflow"
        icon={<IconTerminal2 size={19} stroke={2} className="taskmap-modal-dialog__icon" />}
        onClose={onClose}
        closeDisabled={saving}
      />
      <ModalDialogBody className="taskmap-workflow-editor">
        <ol className="taskmap-workflow-editor__steps">
          {drafts.map((draft, index) => (
            <li key={draft.key} className="taskmap-workflow-editor__step">
              <div className="taskmap-workflow-editor__step-header">
                <span className="taskmap-workflow-editor__step-title">Step {index + 1}</span>
                <IconButton
                  variant="ghost"
                  size="compact"
                  icon={<IconArrowUp size={16} stroke={2} />}
                  aria-label={`Move step ${index + 1} up`}
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                />
                <IconButton
                  variant="ghost"
                  size="compact"
                  icon={<IconArrowDown size={16} stroke={2} />}
                  aria-label={`Move step ${index + 1} down`}
                  title="Move down"
                  disabled={index === drafts.length - 1}
                  onClick={() => move(index, 1)}
                />
                <IconButton
                  variant="ghost"
                  size="compact"
                  icon={<IconTrash size={16} stroke={2} />}
                  aria-label={`Remove step ${index + 1}`}
                  title="Remove step"
                  disabled={drafts.length === 1}
                  onClick={() =>
                    setDrafts((current) => current.filter((other) => other.key !== draft.key))
                  }
                />
              </div>
              <Field label="Program">
                <TextField
                  value={draft.executable}
                  placeholder="npm, cargo or C:\Tools\tool.exe"
                  spellCheck={false}
                  onChange={(event) => update(draft.key, { executable: event.target.value })}
                />
              </Field>
              <Field label="Arguments" description="One argument per line, exactly as typed.">
                <TextArea
                  value={draft.argumentLines}
                  rows={2}
                  spellCheck={false}
                  onChange={(event) => update(draft.key, { argumentLines: event.target.value })}
                />
              </Field>
              <Field label="Working directory">
                <TextField
                  value={draft.workingDirectory}
                  placeholder="Optional, for example C:\Projects\App"
                  spellCheck={false}
                  onChange={(event) => update(draft.key, { workingDirectory: event.target.value })}
                />
              </Field>
              <div className="taskmap-workflow-editor__step-options">
                <SegmentedControl
                  label={`Step ${index + 1} display`}
                  items={DISPLAY_ITEMS}
                  value={draft.display}
                  onValueChange={(display) => update(draft.key, { display })}
                />
                <Switch
                  label="Wait until it exits"
                  checked={draft.waitForExit}
                  onChange={(event) => update(draft.key, { waitForExit: event.target.checked })}
                />
              </div>
            </li>
          ))}
        </ol>
        <Button
          variant="ghost"
          leadingIcon={<IconPlus size={17} stroke={2} />}
          disabled={drafts.length >= MAX_WORKFLOW_STEPS}
          onClick={() => setDrafts((current) => [...current, emptyDraft()])}
        >
          Add step
        </Button>
        {error ? (
          <div role="alert" className="taskmap-modal-dialog__error">
            {error}
          </div>
        ) : null}
      </ModalDialogBody>
      <ModalDialogActions>
        <Button
          variant="ghost"
          leadingIcon={<IconX size={17} stroke={2} />}
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          leadingIcon={<IconDeviceFloppy size={17} stroke={2} />}
          onClick={() => void save()}
          disabled={saving}
        >
          Save
        </Button>
      </ModalDialogActions>
    </ModalDialog>
  );
}
