import { MaterialSurface } from "./MaterialSurface";

export function MaterialAcrylicProof() {
  return (
    <MaterialSurface
      material="acrylic-large"
      radius={12}
      className="taskmap-acrylic-proof"
      aria-label="Acrylic compositor development proof"
    >
      <strong>Acrylic runtime proof</strong>
      <span>Real registered surface - no tuning controls</span>
    </MaterialSurface>
  );
}
