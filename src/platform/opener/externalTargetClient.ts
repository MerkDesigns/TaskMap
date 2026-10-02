import { invoke, isTauri } from "@tauri-apps/api/core";

/** Windows drive (`C:\…`) and UNC (`\\server\share`) paths open as files; anything else as a URL. */
export function isLocalPath(target: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(target) || /^\\\\[^\\]/.test(target);
}

/** Opens a link target with the system's default handler (browser, Explorer or app). */
export async function openExternalTarget(target: string): Promise<void> {
  if (!isTauri()) return;
  if (isLocalPath(target)) await invoke("plugin:opener|open_path", { path: target });
  else await invoke("plugin:opener|open_url", { url: target });
}
