import { getCurrentWindow } from "@tauri-apps/api/window";
/** Native event contains no document, paths or keys. Backend has already revoked access. */
export const subscribeNativeRevocation = (listener: () => void) =>
  getCurrentWindow().listen("taskmap-session-revoked", () => listener());
