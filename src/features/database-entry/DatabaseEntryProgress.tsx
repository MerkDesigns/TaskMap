import { useEffect, useState } from "react";

/** True once `active` has held for `delayMs`, so brief work never flashes busy UI. */
export function useLateFlag(active: boolean, delayMs: number): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) {
      setLate(false);
      return;
    }
    const timer = window.setTimeout(() => setLate(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);
  return active && late;
}

export type DatabaseEntryStage = "idle" | "unlocking" | "preparing" | "done";

// Unlocking (key derivation + document read) has no measurable progress, so the bar eases toward a
// stage target instead of claiming exact percentages.
const STAGE_PROGRESS: Record<DatabaseEntryStage, number> = {
  idle: 0,
  unlocking: 0.7,
  preparing: 0.92,
  done: 1,
};

export function DatabaseEntryProgress({ stage }: { readonly stage: DatabaseEntryStage }) {
  return (
    // The root carries the panel's presence fade; showing and hiding happen on the inner track so
    // its own opacity never overrides that fade.
    <div
      className="taskmap-database-entry__progress"
      data-stage={stage}
      role="progressbar"
      aria-label="Opening database"
      aria-hidden={stage === "idle"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(STAGE_PROGRESS[stage] * 100)}
    >
      <span className="taskmap-database-entry__progress-track">
        <span style={{ transform: `scaleX(${STAGE_PROGRESS[stage]})` }} />
      </span>
    </div>
  );
}
