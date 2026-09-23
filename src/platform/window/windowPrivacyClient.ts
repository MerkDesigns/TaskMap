import { getCurrentWindow } from "@tauri-apps/api/window";
import type { PlatformResult } from "../platformErrors";
export interface WindowPrivacyClient {
  setProtected(enabled: boolean): Promise<PlatformResult<void>>;
}
export const tauriWindowPrivacyClient: WindowPrivacyClient = {
  async setProtected(enabled) {
    try {
      await getCurrentWindow().setContentProtected(enabled);
      return { ok: true, value: undefined };
    } catch {
      return {
        ok: false,
        error: {
          code: "unexpected",
          message: "Window privacy could not be applied.",
          retryable: true,
        },
      };
    }
  },
};
