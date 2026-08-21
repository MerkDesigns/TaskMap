import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface WindowChromeClient {
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  minimize(): Promise<void>;
  onResized(listener: () => void): Promise<() => void>;
  startDragging(): Promise<void>;
  toggleMaximize(): Promise<void>;
}

const whenTauri = async (operation: () => Promise<void>) => {
  if (isTauri()) await operation();
};

export const tauriWindowChromeClient: WindowChromeClient = {
  close: () => whenTauri(() => getCurrentWindow().close()),
  isMaximized: () => (isTauri() ? getCurrentWindow().isMaximized() : Promise.resolve(false)),
  minimize: () => whenTauri(() => getCurrentWindow().minimize()),
  onResized: (listener) =>
    isTauri() ? getCurrentWindow().onResized(listener) : Promise.resolve(() => undefined),
  startDragging: () => whenTauri(() => getCurrentWindow().startDragging()),
  toggleMaximize: () => whenTauri(() => getCurrentWindow().toggleMaximize()),
};
