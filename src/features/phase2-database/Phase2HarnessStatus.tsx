import type { DatabaseSessionStatus } from "../../platform/database/databaseTypes";

interface Phase2HarnessStatusProps {
  readonly error: string | null;
  readonly session: DatabaseSessionStatus;
}

export function Phase2HarnessStatus({ error, session }: Phase2HarnessStatusProps) {
  return (
    <>
      <p className="mt-4 text-sm">
        Session: <strong>{session.phase}</strong> · Revision: {session.revision ?? "—"}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </>
  );
}
