import type { createTauriDatabaseSessionController } from "../../app/database/createTauriDatabaseSessionController";

type RuntimeResult = Awaited<ReturnType<typeof createTauriDatabaseSessionController>>;
export type DatabaseApplicationRuntime = Extract<RuntimeResult, { ok: true }>["value"];
export type DatabaseEntryRuntime = Pick<
  DatabaseApplicationRuntime,
  "controller" | "initializeResources" | "settingsClient" | "edition"
>;
