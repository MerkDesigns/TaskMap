import type { PlatformResult } from "../../platform/platformErrors";

interface RuntimeResources {
  flush(): Promise<PlatformResult<void>>;
  purge(): void;
  dispose(): void;
}

/** Explicit two-stage wiring: construct the session, then attach its resource owner before use. */
export function createDatabaseRuntimeResources() {
  let owned: RuntimeResources | undefined;
  const requireOwned = () => {
    if (!owned) throw new Error("Database runtime resources are not attached.");
    return owned;
  };
  return {
    attach(resources: RuntimeResources) {
      if (owned) throw new Error("Database runtime resources are already attached.");
      owned = resources;
    },
    flush: () => requireOwned().flush(),
    purge: () => requireOwned().purge(),
    dispose: () => requireOwned().dispose(),
  };
}

/** Revocation must attempt every owner even if one UI/resource cleanup fails. */
export function clearDatabaseResources(operations: readonly (() => void)[]) {
  let failed = false;
  for (const operation of operations) {
    try {
      operation();
    } catch {
      failed = true;
    }
  }
  if (failed) throw new Error("Database resource cleanup failed.");
}
