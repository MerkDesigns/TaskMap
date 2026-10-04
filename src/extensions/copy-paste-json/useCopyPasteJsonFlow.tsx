import { useCallback, useEffect, useRef, useState } from "react";
import type { CapturedCompletion } from "../../app/commands/retainedCompletionOwner";
import { commandErrorMessage } from "../../app/commandError";
import type { ToastMessage } from "../../types";
import { ContainerJsonEditorWindow } from "./ContainerJsonEditorWindow";
import { parseCopyPasteJson } from "./copyPasteJsonFormat";

/** What the Copy/Paste JSON flow needs from the application. */
export interface CopyPasteJsonPort {
  /** The container's cards as AI JSON, or null when Copy/Paste JSON is not installed on it. */
  readonly getJson: (containerId: string) => string | null;
  /** Captures replacing the container's cards; null when the container cannot be replaced now. */
  readonly captureReplace: (containerId: string) => CapturedCompletion<string> | null;
  /** The container's name while Copy/Paste JSON is installed on it, otherwise null. */
  readonly containerName: (containerId: string) => string | null;
  /** Runs after a replacement completed, to reset the container's presentation. */
  readonly onReplaced: (containerId: string) => void;
  readonly showToast: (toast: Omit<ToastMessage, "id"> & { duration?: number }) => void;
}

type OpenEditor = { readonly containerId: string; readonly initialJson: string };

/**
 * Copy/Paste JSON's behavior: copying a container as AI JSON, pasting JSON back from the clipboard,
 * and the editor window. A replacement is captured before the clipboard is read or the editor opens,
 * so it completes against the container as it was then, or not at all.
 */
export function useCopyPasteJsonFlow(port: CopyPasteJsonPort) {
  const portRef = useRef(port);
  portRef.current = port;
  const [editor, setEditor] = useState<OpenEditor | null>(null);
  const editorCapture = useRef<CapturedCompletion<string> | null>(null);

  const closeEditor = useCallback(() => {
    editorCapture.current?.cancel();
    editorCapture.current = null;
    setEditor(null);
  }, []);
  useEffect(() => () => editorCapture.current?.cancel(), []);

  const apply = (
    containerId: string,
    json: string,
    captured: CapturedCompletion<string> | null,
  ) => {
    const { containerName, onReplaced, showToast } = portRef.current;
    if (containerName(containerId) === null) return;
    const parsed = parseCopyPasteJson(json);
    if (!parsed.success) {
      showToast({ tone: "error", title: "Invalid AI JSON", message: parsed.error, duration: 7000 });
      return;
    }
    if (!captured?.complete(json).ok) {
      showToast({
        tone: "error",
        title: "JSON was not applied",
        message: "The container changed or the action expired. Reopen the editor and retry.",
      });
      return;
    }
    onReplaced(containerId);
    // The container now differs from what any open editor captured.
    closeEditor();
  };

  const copyJsonForAi = async (containerId: string) => {
    const { getJson, showToast } = portRef.current;
    const json = getJson(containerId);
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      showToast({
        tone: "success",
        title: "Container JSON copied",
        message: "Paste it into an AI, then copy only the returned JSON.",
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not copy JSON",
        message: commandErrorMessage(error),
      });
    }
  };

  const pasteJsonFromAi = async (containerId: string) => {
    const captured = portRef.current.captureReplace(containerId);
    if (!captured) return;
    let clipboardText: string;
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch (error) {
      captured.cancel();
      portRef.current.showToast({
        tone: "error",
        title: "Could not read clipboard",
        message: commandErrorMessage(error),
      });
      return;
    }
    apply(containerId, clipboardText, captured);
    captured.cancel();
  };

  const openJsonEditor = (containerId: string) => {
    const { getJson, captureReplace } = portRef.current;
    const json = getJson(containerId);
    if (!json) return;
    editorCapture.current?.cancel();
    editorCapture.current = captureReplace(containerId);
    if (!editorCapture.current) return;
    setEditor({ containerId, initialJson: json });
  };

  /** Closes the editor when its container is among `containerIds`, e.g. after removing the extension. */
  const closeEditorFor = (containerIds: ReadonlySet<string>) => {
    if (editor && containerIds.has(editor.containerId)) closeEditor();
  };

  const editorName = editor ? port.containerName(editor.containerId) : null;
  const editorWindow =
    editor && editorName !== null ? (
      <ContainerJsonEditorWindow
        key={editor.containerId}
        containerName={editorName}
        initialJson={editor.initialJson}
        onApply={(json) => apply(editor.containerId, json, editorCapture.current)}
        onClose={closeEditor}
      />
    ) : null;

  return {
    copyJsonForAi,
    pasteJsonFromAi,
    openJsonEditor,
    closeEditor,
    closeEditorFor,
    editorWindow,
  };
}
