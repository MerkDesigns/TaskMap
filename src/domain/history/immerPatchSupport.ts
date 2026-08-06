import { enablePatches } from "immer";

let patchesEnabled = false;

export function ensureImmerPatchSupport(): void {
  if (patchesEnabled) return;
  enablePatches();
  patchesEnabled = true;
}
