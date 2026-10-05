import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CapturedCompletion } from "../app/commands/retainedCompletionOwner";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import { captureRetainedTextEdit } from "../app/commands/retainedEditorCallbacks";
import type { ElementId } from "../domain/ids/entityIds";

export interface RetainedInlineEdit {
  /** The element whose field is being edited, or null. */
  readonly editingId: string | null;
  /** The text typed so far; only meaningful while editing. */
  readonly draft: string;
  readonly setDraft: (draft: string) => void;
  /** Starts editing `id` with `text` as the draft. */
  readonly begin: (id: string, text: string) => void;
  /** Commits the draft as one completed edit and stops editing. */
  readonly complete: () => void;
  /** Stops editing without committing. */
  readonly end: () => void;
}

/**
 * Editing one text field of a retained element in place: the draft stays in the view, and the edit
 * is captured when editing starts so the final value lands as one domain transaction (or none, when
 * editing ends without saving or the document changes underneath).
 */
export function useRetainedInlineEdit(
  callbacks: RetainedActionCallbacks,
  field: "text" | "name",
): RetainedInlineEdit {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const captured = useRef<CapturedCompletion<string> | null>(null);

  useLayoutEffect(() => {
    captured.current = editingId
      ? captureRetainedTextEdit(callbacks, editingId as ElementId, field)
      : null;
    return () => {
      captured.current?.cancel();
      captured.current = null;
    };
  }, [callbacks, editingId, field]);

  useEffect(() => callbacks.subscribeInvalidation(() => setDraft("")), [callbacks]);

  // Stable actions, so effects and memoized callbacks can depend on them.
  const actions = useMemo(
    () => ({
      begin(id: string, text: string) {
        setDraft(text);
        setEditingId(id);
      },
      complete() {
        captured.current?.complete(draftRef.current);
        setEditingId(null);
        setDraft("");
      },
      end() {
        setEditingId(null);
        setDraft("");
      },
    }),
    [],
  );
  return useMemo(() => ({ editingId, draft, setDraft, ...actions }), [actions, draft, editingId]);
}
