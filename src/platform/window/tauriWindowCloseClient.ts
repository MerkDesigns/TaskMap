import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface WindowCloseClient {
  onCloseRequested(listener: () => void): Promise<() => void>;
  destroy(): Promise<void>;
}

export const tauriWindowCloseClient: WindowCloseClient = {
  onCloseRequested: async (listener) =>
    isTauri()
      ? getCurrentWindow().onCloseRequested((event) => {
          event.preventDefault();
          listener();
        })
      : () => {},
  destroy: async () => {
    if (!isTauri()) return;
    if (import.meta.env.MODE === "storage-preview") {
      await getCurrentWindow().destroy();
    } else {
      await invoke("app_destroy_main_window");
    }
  },
};

/** The tray's Quit, sent to an open window so it saves and quits through its session controller. */
export function listenForQuitRequests(listener: () => void): Promise<() => void> {
  return isTauri() ? listen("taskmap-quit-requested", () => listener()) : Promise.resolve(() => {});
}
