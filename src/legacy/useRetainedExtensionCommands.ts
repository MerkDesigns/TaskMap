import { useMemo, useRef } from "react";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { ElementId } from "../domain/ids/entityIds";
import type { ExtensionCommands } from "../extensions/extensionCommands";
import type { RetainedExtensionKey } from "../extensions/retainedExtensionDefinition";
import type { CardWorkflowRun } from "../extensions/workflow/workflowRunStore";
import { retainedExtensionId } from "./retainedViewExtensions";

/**
 * The elements a menu or header action on `id` applies to: the whole selection when `id` is part
 * of a multi-selection, otherwise just `id`.
 */
export function contextActionIds(selection: readonly string[], id: string): readonly string[] {
  return selection.length > 1 && selection.includes(id) ? selection : [id];
}

export interface RetainedExtensionCommandPorts {
  readonly callbacks: RetainedActionCallbacks;
  /** The current selection, read when a command runs. */
  readonly selection: () => readonly string[];
  readonly rememberRecentColor: (color?: string) => void;
  /** Search changed or was removed on these containers; their card lists start at the top. */
  readonly resetContainerScroll: (ids: readonly string[]) => void;
  readonly closeContextMenus: () => void;
  readonly copyPasteJson: {
    readonly copyJsonForAi: (id: string) => Promise<void>;
    readonly pasteJsonFromAi: (id: string) => Promise<void>;
    readonly openJsonEditor: (id: string) => void;
    readonly closeEditorFor: (ids: ReadonlySet<string>) => void;
  };
  readonly openWorkflowEditor: (cardId: string) => void;
  readonly workflowRuns: {
    readonly runWorkflow: (cardId: string) => Promise<void>;
    readonly stopWorkflow: (cardId: string) => Promise<void>;
    readonly subscribeWorkflowRuns: (listener: () => void) => () => void;
    readonly getWorkflowRun: (cardId: string) => CardWorkflowRun | null;
  };
}

/**
 * The ExtensionCommands port over the retained document callbacks. The returned object is stable;
 * every command reads the latest ports, so elements never rerender because the port changed.
 */
export function useRetainedExtensionCommands(
  ports: RetainedExtensionCommandPorts,
): ExtensionCommands {
  const latest = useRef(ports);
  latest.current = ports;

  return useMemo<ExtensionCommands>(() => {
    const current = () => latest.current;
    const toggle = (extension: "lock" | "privacy" | "checkbox", elementId: string) => {
      const { callbacks, selection } = current();
      // Lock follows the selection the element is in; privacy and checkboxes are per element.
      const targets = extension === "lock" ? (selection() as ElementId[]) : undefined;
      callbacks.captureExtensionToggle(extension, elementId as ElementId, targets)?.complete();
    };
    const remove = (extension: RetainedExtensionKey, elementId: string) => {
      const { callbacks, selection, resetContainerScroll, copyPasteJson, closeContextMenus } =
        current();
      const targets = contextActionIds(selection(), elementId);
      const extensionId = retainedExtensionId(extension);
      if (
        !extensionId ||
        !callbacks.captureExtensionRemove(extensionId, targets as ElementId[])?.complete().ok
      )
        return;
      if (extension === "search") resetContainerScroll(targets);
      if (extension === "copyPasteJson") copyPasteJson.closeEditorFor(new Set(targets));
      closeContextMenus();
    };
    const updateAccent = (elementId: string, accent: string) => {
      current()
        .callbacks.captureContent([{ elementId: elementId as ElementId, fields: ["accent"] }])
        ?.complete([{ elementId: elementId as ElementId, to: { accent } }]);
    };
    const updateSelectionAccent = (elementId: string, accent: string) => {
      const { callbacks, selection } = current();
      const targets = contextActionIds(selection(), elementId) as ElementId[];
      callbacks
        .captureContent(targets.map((target) => ({ elementId: target, fields: ["accent"] })))
        ?.complete(targets.map((target) => ({ elementId: target, to: { accent } })));
    };
    const setSearchQuery = (elementId: string, query: string) => {
      const { callbacks, resetContainerScroll } = current();
      callbacks
        .captureExtensionConfiguration("search", elementId as ElementId)
        ?.complete({ query });
      resetContainerScroll([elementId]);
    };
    return {
      toggle,
      remove,
      updateAccent,
      updateSelectionAccent,
      setSearchQuery,
      rememberRecentColor: (color) => current().rememberRecentColor(color),
      copyJsonForAi: (id) => current().copyPasteJson.copyJsonForAi(id),
      pasteJsonFromAi: (id) => current().copyPasteJson.pasteJsonFromAi(id),
      openJsonEditor: (id) => current().copyPasteJson.openJsonEditor(id),
      openWorkflowEditor: (cardId) => {
        current().closeContextMenus();
        current().openWorkflowEditor(cardId);
      },
      runWorkflow: (cardId) => current().workflowRuns.runWorkflow(cardId),
      stopWorkflow: (cardId) => current().workflowRuns.stopWorkflow(cardId),
      subscribeWorkflowRuns: (listener) => current().workflowRuns.subscribeWorkflowRuns(listener),
      getWorkflowRun: (cardId) => current().workflowRuns.getWorkflowRun(cardId),
    };
  }, []);
}
