import {
  IconChevronDown,
  IconChevronUp,
  IconDeviceFloppy,
  IconFolder,
  IconInfoCircle,
  IconPlus,
  IconTerminal2,
  IconTrash,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { FloatingToolWindow, type FloatingToolWindowHandle } from "../../ui/patterns/overlays";
import { Button, IconButton, SegmentedControl, TextField, Tooltip } from "../../ui/primitives";
import { formatCommandLine, parseCommandLine } from "./commandLine";
import {
  MAX_WORKFLOW_LINES,
  workflowConfigurationSchema,
  type WorkflowLine,
} from "./workflowDefinition";
import "./workflow.css";

/** A line as the editor holds it: the command line as typed, the directory as plain text. */
interface LineDraft {
  readonly key: number;
  readonly command: string;
  readonly workingDirectory: string;
  readonly display: WorkflowLine["display"];
}

let nextDraftKey = 0;

const toDraft = (line: WorkflowLine): LineDraft => ({
  key: nextDraftKey++,
  command: formatCommandLine(line.invocations),
  workingDirectory: line.workingDirectory ?? "",
  display: line.display,
});

const emptyDraft = (): LineDraft => ({
  key: nextDraftKey++,
  command: "",
  workingDirectory: "",
  display: "terminal",
});

const DISPLAY_ITEMS = [
  { value: "terminal", label: "Terminal" },
  { value: "background", label: "Background" },
] as const;
const OPEN_ONLY_DISPLAY_ITEMS = DISPLAY_ITEMS.map((item) => ({ ...item, disabled: true }));

/** Whether a command only opens targets: start has no window of its own to show or hide. */
const opensOnly = (command: string) => {
  const parsed = parseCommandLine(command);
  return parsed.ok && parsed.invocations.every((invocation) => invocation.kind === "open");
};

const GUIDE = (
  <div className="taskmap-workflow-window__guide">
    <p>Each command line starts at the same time when the workflow runs.</p>
    <ul>
      <li>
        <code>a && b</code> runs b after a succeeds.
      </li>
      <li>
        <code>start</code> opens a website, file or folder with its default app.
      </li>
      <li>
        Terminal shows a program in a console window; Background runs it hidden. A line that only
        uses start opens in its own app either way.
      </li>
      <li>Programs run in the working directory; relative paths are taken from there.</li>
    </ul>
    <p>
      Commands are not run by a shell: pipes, redirects, a single &, %VARIABLES% and cmd commands
      such as dir are not supported. Use <code>cmd.exe /c ...</code> for those.
    </p>
  </div>
);

export interface WorkflowEditorWindowProps {
  readonly cardName: string;
  readonly initialLines: readonly WorkflowLine[];
  /** Resolves false when the workflow could not be saved; the window then stays open. */
  readonly onSave: (cardName: string, lines: WorkflowLine[]) => Promise<boolean>;
  /** Lets the user pick a working directory; null when cancelled. */
  readonly onChooseFolder: () => Promise<string | null>;
  readonly onClose: () => void;
}

/**
 * The Workflow editor, laid out like the Command Runner's window: one command line per row, typed
 * as in a terminal but parsed by TaskMap into programs and arguments, never run by a shell.
 */
export function WorkflowEditorWindow({
  cardName,
  initialLines,
  onSave,
  onChooseFolder,
  onClose,
}: WorkflowEditorWindowProps) {
  const windowRef = useRef<FloatingToolWindowHandle>(null);
  const [name, setName] = useState(cardName);
  const [drafts, setDrafts] = useState<LineDraft[]>(() =>
    initialLines.length > 0 ? initialLines.map(toDraft) : [emptyDraft()],
  );
  const [errors, setErrors] = useState<ReadonlyMap<number, string>>(new Map());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (key: number, change: Partial<LineDraft>) => {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)),
    );
    if (change.command !== undefined && errors.has(key)) {
      const next = new Map(errors);
      next.delete(key);
      setErrors(next);
    }
  };
  const move = (index: number, offset: -1 | 1) =>
    setDrafts((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  const chooseFolder = async (key: number) => {
    const folder = await onChooseFolder();
    if (folder) update(key, { workingDirectory: folder });
  };

  const save = async () => {
    const found = new Map<number, string>();
    const lines: WorkflowLine[] = [];
    for (const draft of drafts) {
      const parsed = parseCommandLine(draft.command);
      if (!parsed.ok) {
        found.set(draft.key, parsed.error);
        continue;
      }
      lines.push({
        invocations: [...parsed.invocations],
        workingDirectory: draft.workingDirectory.trim() || null,
        display: draft.display,
      });
    }
    setErrors(found);
    if (found.size > 0) return;
    if (!name.trim()) {
      setError("The card needs a name.");
      return;
    }
    if (!workflowConfigurationSchema.safeParse({ lines }).success) {
      setError("A command is too long or contains characters that cannot be run.");
      return;
    }
    setError("");
    setSaving(true);
    const saved = await onSave(name.trim(), lines);
    setSaving(false);
    if (saved) windowRef.current?.requestClose();
    else setError("The workflow could not be saved. Try again.");
  };

  return (
    <FloatingToolWindow
      ref={windowRef}
      label="Edit workflow"
      icon={<IconTerminal2 size={19} stroke={2} />}
      title={
        <span className="taskmap-workflow-editor__title">
          Workflow
          <span aria-hidden="true">-</span>
          <input
            aria-label="Text card name"
            className="taskmap-workflow-editor__name"
            value={name}
            spellCheck={false}
            onChange={(event) => setName(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </span>
      }
      actions={
        <Tooltip label={GUIDE} className="taskmap-workflow-window__guide-tooltip">
          <IconButton
            variant="ghost"
            size="compact"
            icon={<IconInfoCircle size={17} stroke={2} />}
            aria-label="How commands run"
          />
        </Tooltip>
      }
      closeLabel="Close workflow editor"
      onClose={onClose}
      initialSize={{ width: 760, height: 560 }}
      minimumSize={{ width: 560, height: 320 }}
      className="taskmap-workflow-window"
    >
      <div className="taskmap-workflow-window__body">
        <ol className="taskmap-workflow-window__lines taskmap-scrollbar-thin">
          {drafts.map((draft, index) => (
            <li key={draft.key} className="taskmap-workflow-window__line">
              <div className="taskmap-workflow-window__row">
                <span className="taskmap-workflow-window__index">{index + 1}</span>
                <TextField
                  aria-label={`Command ${index + 1}`}
                  value={draft.command}
                  placeholder="npm run dev, docker compose up -d or start http://localhost:3000"
                  spellCheck={false}
                  aria-invalid={errors.has(draft.key) || undefined}
                  onChange={(event) => update(draft.key, { command: event.target.value })}
                />
                <SegmentedControl
                  label={`Command ${index + 1} display`}
                  items={opensOnly(draft.command) ? OPEN_ONLY_DISPLAY_ITEMS : DISPLAY_ITEMS}
                  value={draft.display}
                  onValueChange={(display) => update(draft.key, { display })}
                />
              </div>
              <div className="taskmap-workflow-window__row">
                <span className="taskmap-workflow-window__order">
                  <IconButton
                    variant="ghost"
                    size="compact"
                    icon={<IconChevronUp size={16} stroke={2.5} />}
                    aria-label={`Move command ${index + 1} up`}
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <IconButton
                    variant="ghost"
                    size="compact"
                    icon={<IconChevronDown size={16} stroke={2.5} />}
                    aria-label={`Move command ${index + 1} down`}
                    title="Move down"
                    disabled={index === drafts.length - 1}
                    onClick={() => move(index, 1)}
                  />
                </span>
                <TextField
                  aria-label={`Working directory ${index + 1}`}
                  value={draft.workingDirectory}
                  placeholder="Working directory (optional)"
                  spellCheck={false}
                  onChange={(event) => update(draft.key, { workingDirectory: event.target.value })}
                />
                <IconButton
                  variant="ghost"
                  size="compact"
                  icon={<IconFolder size={18} stroke={2} />}
                  aria-label={`Choose folder for command ${index + 1}`}
                  title="Choose folder"
                  onClick={() => void chooseFolder(draft.key)}
                />
                <IconButton
                  variant="ghost"
                  size="compact"
                  icon={<IconTrash size={18} stroke={2} />}
                  aria-label={`Remove command ${index + 1}`}
                  title="Remove command"
                  disabled={drafts.length === 1}
                  onClick={() =>
                    setDrafts((current) => current.filter((other) => other.key !== draft.key))
                  }
                />
              </div>
              {errors.has(draft.key) ? (
                <div role="alert" className="taskmap-workflow-window__error">
                  {errors.get(draft.key)}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        {error ? (
          <div role="alert" className="taskmap-workflow-window__error">
            {error}
          </div>
        ) : null}
        <div className="taskmap-workflow-window__footer">
          <Button
            variant="ghost"
            leadingIcon={<IconPlus size={17} stroke={2} />}
            disabled={drafts.length >= MAX_WORKFLOW_LINES}
            onClick={() => setDrafts((current) => [...current, emptyDraft()])}
          >
            Add command
          </Button>
          <span className="taskmap-workflow-window__spacer" />
          <Button
            variant="ghost"
            onClick={() => windowRef.current?.requestClose()}
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
        </div>
      </div>
    </FloatingToolWindow>
  );
}
