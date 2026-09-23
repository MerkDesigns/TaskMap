import { invoke, isTauri } from "@tauri-apps/api/core";
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
    if (import.meta.env.MODE === "storage-preview" || import.meta.env.MODE === "ui-lab") {
      await getCurrentWindow().destroy();
    } else {
      await invoke("app_destroy_main_window");
    }
  },
};
