import { createTauriApplicationDatabase } from "../../platform/database/tauriApplicationDatabase";
import { acceptRetainedDocument } from "./acceptRetainedDocument";
import { tauriWindowPrivacyClient } from "../../platform/window/windowPrivacyClient";
import { subscribeNativeRevocation } from "../../platform/database/nativeSessionEvents";
import {
  createApplicationDatabaseRuntime,
  type DatabaseRuntimeOptions,
} from "./createApplicationDatabaseRuntime";

/** Explicit product factory; importing it never opens a database. */
export async function createTauriDatabaseSessionController(options: DatabaseRuntimeOptions) {
  const platform = await createTauriApplicationDatabase(acceptRetainedDocument);
  if (!platform.ok) return platform;
  const runtime = createApplicationDatabaseRuntime(platform.value, {
    ...options,
    windowPrivacyClient: tauriWindowPrivacyClient,
  });
  try {
    const stop = await subscribeNativeRevocation(() => {
      void runtime.value.controller.revokeFromNative();
    });
    const dispose = runtime.value.controller.dispose;
    runtime.value.controller.dispose = async () => {
      stop();
      return dispose();
    };
    return runtime;
  } catch {
    await runtime.value.controller.dispose();
    return {
      ok: false as const,
      error: {
        code: "unexpected" as const,
        message: "Session protection could not be connected.",
        retryable: true,
      },
    };
  }
}
