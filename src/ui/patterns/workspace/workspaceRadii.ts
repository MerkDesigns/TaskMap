import { useSyncExternalStore } from "react";
import {
  DEFAULT_CHROME_RADII,
  type ChromeRadii,
} from "../../../platform/settings/preferenceContracts";

/** Corner radii of the workspace chrome (Settings → Visual → Interface). */
export type WorkspaceRadii = ChromeRadii;
export const DEFAULT_WORKSPACE_RADII: WorkspaceRadii = DEFAULT_CHROME_RADII;

// The applied radii. App writes the saved preference here and Settings previews slider drags
// live; readers outside the workspace tree (the app-level window controls) subscribe too.
let radii: WorkspaceRadii = DEFAULT_WORKSPACE_RADII;
const listeners = new Set<() => void>();

export function setWorkspaceRadii(next: Partial<WorkspaceRadii> | null): void {
  const merged = next ? { ...radii, ...next } : DEFAULT_WORKSPACE_RADII;
  if ((Object.keys(merged) as (keyof WorkspaceRadii)[]).every((key) => merged[key] === radii[key]))
    return;
  radii = Object.freeze(merged);
  listeners.forEach((listener) => listener());
}

export function useWorkspaceRadii(): WorkspaceRadii {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => radii,
    () => DEFAULT_WORKSPACE_RADII,
  );
}
