import {
  tauriWindowChromeClient,
  type WindowChromeClient,
} from "../platform/window/tauriWindowChromeClient";

export type WindowChromeActions = WindowChromeClient;

export const windowChromeActions: WindowChromeActions = tauriWindowChromeClient;
