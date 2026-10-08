import { useEffect } from "react";
import type { ToastRequest } from "../components/useToastQueue";
import type { ElementId } from "../domain/ids/entityIds";
import { useCopyPasteJsonFlow } from "../extensions/copy-paste-json/useCopyPasteJsonFlow";
import { useWorkflowEditorFlow } from "../extensions/workflow/useWorkflowEditorFlow";
import { useWorkflowRuns } from "../extensions/workflow/useWorkflowRuns";
import type { ContainerElement, TextCardElement } from "../types";
import type { RetainedCanvasContextValue } from "./RetainedCanvasContext";
import { captureRetainedViewJsonEdit } from "./retainedViewJsonEdit";
import { useRetainedExtensionCommands } from "./useRetainedExtensionCommands";

const uuids = { nextUuid: () => crypto.randomUUID() };

export interface RetainedExtensionFlowPorts {
  readonly retained: RetainedCanvasContextValue;
  readonly container: (id: string) => ContainerElement | undefined;
  readonly card: (id: string) => TextCardElement | undefined;
  readonly selection: () => readonly string[];
  readonly select: (ids: string[]) => void;
  readonly resetContainerScroll: (ids: readonly string[]) => void;
  /** Ends the inline edits a replaced container's cards may have open. */
  readonly endEditing: () => void;
  readonly rememberRecentColor: (color?: string) => void;
  readonly closeContextMenus: () => void;
  readonly showToast: (toast: ToastRequest) => void;
}

/**
 * The extensions' own flows on the open canvas: the Copy/Paste JSON editor, the workflow editor,
 * workflow runs and their review dialog, and the extension commands the element menus call. A
 * reloaded document closes the editors and resets runs.
 */
export function useRetainedExtensionFlows({
  retained,
  container,
  card,
  selection,
  select,
  resetContainerScroll,
  endEditing,
  rememberRecentColor,
  closeContextMenus,
  showToast,
}: RetainedExtensionFlowPorts) {
  const { callbacks, controller, workflows } = retained.runtime;
  const workflowLines = (id: string) => card(id)?.extensions?.workflow?.lines ?? null;

  const copyPasteJson = useCopyPasteJsonFlow({
    getJson: (id) => callbacks.getContainerJsonForAi(id as ElementId),
    captureReplace: (id) =>
      captureRetainedViewJsonEdit(
        callbacks,
        controller.store.getState().documentWorkspace.document,
        id as ElementId,
        uuids,
      ),
    containerName: (id) => {
      const element = container(id);
      return element?.extensions?.copyPasteJson ? element.name : null;
    },
    onReplaced: (id) => {
      resetContainerScroll([id]);
      select([id]);
      endEditing();
    },
    showToast,
  });
  const workflowEditor = useWorkflowEditorFlow({
    getLines: workflowLines,
    getCardName: (id) => card(id)?.text ?? "",
    saveLines: (id, lines) =>
      callbacks.captureExtensionConfiguration("workflow", id as ElementId)?.complete({ lines })
        .ok ?? false,
    saveCardName: (id, name) =>
      Boolean(
        callbacks
          .captureContent([{ elementId: id as ElementId, fields: ["text"] }])
          ?.complete([{ elementId: id as ElementId, to: { text: name } }])?.ok,
      ),
    trust: async (lines) => (await workflows.trust(lines)).ok,
    chooseFolder: async () => {
      const chosen = await workflows.chooseFolder();
      return chosen.ok ? chosen.value : null;
    },
  });
  const workflowRuns = useWorkflowRuns({ getLines: workflowLines, client: workflows });

  useEffect(
    () => callbacks.subscribeInvalidation(copyPasteJson.closeEditor),
    [callbacks, copyPasteJson.closeEditor],
  );
  useEffect(
    () => callbacks.subscribeInvalidation(workflowEditor.closeEditor),
    [callbacks, workflowEditor.closeEditor],
  );
  useEffect(
    () => callbacks.subscribeInvalidation(workflowRuns.reset),
    [callbacks, workflowRuns.reset],
  );

  const commands = useRetainedExtensionCommands({
    callbacks,
    selection,
    rememberRecentColor,
    resetContainerScroll,
    closeContextMenus,
    copyPasteJson,
    openWorkflowEditor: workflowEditor.openWorkflowEditor,
    workflowRuns,
  });

  return {
    commands,
    windows: (
      <>
        {copyPasteJson.editorWindow}
        {workflowEditor.editorWindow}
        {workflowRuns.reviewDialog}
      </>
    ),
  };
}
