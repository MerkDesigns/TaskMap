import { createValidatedDatabaseClient } from "./createValidatedDatabaseClient";

// Development harness only. Production composition uses the edition-checked application factory.
export const tauriDatabaseClient = createValidatedDatabaseClient("phase2", "development");
