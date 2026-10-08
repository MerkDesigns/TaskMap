import type { RetainedExtensionKey } from "../extensions/retainedExtensionDefinition";
import { contextActionIds } from "./useRetainedExtensionCommands";

type LayerDirection = "back" | "backward" | "forward" | "front";

export interface ContextTargetPorts {
  readonly selection: readonly string[];
  readonly element: (id: string) => { readonly extensions?: object } | undefined;
  /** Whether an element is at the top level, where layer commands apply. */
  readonly isTopLevel: (id: string) => boolean;
  readonly reorder: (ids: readonly string[], direction: LayerDirection) => void;
  readonly updateAccent: (id: string, accent: string) => void;
  readonly remove: (ids: string[]) => void;
  readonly closeContextMenus: () => void;
  readonly endRename: () => void;
}

/**
 * What a context menu's commands apply to: the element it was opened on, or the whole selection
 * when that element is part of a multi-selection.
 */
export function createContextTargets(ports: ContextTargetPorts) {
  const targets = (id: string) => [...contextActionIds(ports.selection, id)];
  return {
    isMulti: (id: string) => ports.selection.length > 1 && ports.selection.includes(id),
    /** Extensions installed on any of the targets. */
    installedExtensions(id: string): ReadonlySet<RetainedExtensionKey> {
      const installed = new Set<RetainedExtensionKey>();
      for (const targetId of targets(id)) {
        for (const [key, state] of Object.entries(ports.element(targetId)?.extensions ?? {}))
          if (state) installed.add(key as RetainedExtensionKey);
      }
      return installed;
    },
    updateAccent: (id: string, accent: string) => ports.updateAccent(id, accent),
    /** Removes the targets, or `ids` when given (e.g. the elements a cut copied). */
    remove(id: string, ids?: string[]) {
      ports.remove(ids ?? targets(id));
      ports.closeContextMenus();
      ports.endRename();
    },
    moveLayer(id: string, direction: LayerDirection) {
      ports.reorder(targets(id).filter(ports.isTopLevel), direction);
      ports.endRename();
    },
  };
}
