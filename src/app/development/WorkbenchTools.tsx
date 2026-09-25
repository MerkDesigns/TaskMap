import { useLayoutEffect, useState } from "react";
import { ACRYLIC_LARGE, ACRYLIC_SMALL } from "../../ui/materials/materialDefinitions";
import { notifyMaterialTuningChanged } from "../../ui/materials/materialGeometryInvalidation";
import { WorkbenchDiagnostics } from "./WorkbenchDiagnostics";

const knobs = [
  {
    label: "Major blur",
    property: "--taskmap-material-large-blur-override",
    initial: ACRYLIC_LARGE.blurPx,
  },
  {
    label: "Minor blur",
    property: "--taskmap-material-small-blur-override",
    initial: ACRYLIC_SMALL.blurPx,
  },
] as const;

export function WorkbenchTools() {
  const [values, setValues] = useState<readonly number[] | null>(null);
  const [bounds, setBounds] = useState(false);
  const [hitTargets, setHitTargets] = useState(false);
  const [performance, setPerformance] = useState(false);
  useLayoutEffect(() => {
    if (!values) return;
    // Root ownership includes portals and window chrome. Restore inherited values on lock/unmount.
    const style = document.documentElement.style;
    const previous = knobs.map(({ property }) => [
      style.getPropertyValue(property),
      style.getPropertyPriority(property),
    ]);
    knobs.forEach(({ property }, index) => style.setProperty(property, `${values[index]}px`));
    notifyMaterialTuningChanged();
    return () => {
      knobs.forEach(({ property }, index) => {
        const [value, priority] = previous[index];
        if (value) style.setProperty(property, value, priority);
        else style.removeProperty(property);
      });
      notifyMaterialTuningChanged();
    };
  }, [values]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("taskmap-debug-material-bounds", bounds);
    root.classList.toggle("taskmap-debug-hit-targets", hitTargets);
    return () =>
      root.classList.remove("taskmap-debug-material-bounds", "taskmap-debug-hit-targets");
  }, [bounds, hitTargets]);
  return (
    <details>
      <summary>Tuning & diagnostics</summary>
      <div className="taskmap-workbench__tools">
        <p>Session-only overrides · shared by App and Lab</p>
        {knobs.map((knob, index) => (
          <label key={knob.property}>
            {knob.label} ({values?.[index] ?? knob.initial}px)
            <input
              type="range"
              aria-label={knob.label}
              min="0"
              max="100"
              step="0.5"
              value={values?.[index] ?? knob.initial}
              onChange={(event) => {
                const next = [...(values ?? knobs.map(({ initial }) => initial))];
                next[index] = Number(event.target.value);
                setValues(next);
              }}
            />
          </label>
        ))}
        <button type="button" onClick={() => setValues(null)}>
          Reset material tuning
        </button>
        <label>
          <input type="checkbox" checked={bounds} onChange={(e) => setBounds(e.target.checked)} />
          Material bounds (cyan), effect bounds (orange)
        </label>
        <label>
          <input
            type="checkbox"
            checked={hitTargets}
            onChange={(e) => setHitTargets(e.target.checked)}
          />
          Hit targets (pink)
        </label>
        <label>
          <input
            type="checkbox"
            checked={performance}
            onChange={(e) => setPerformance(e.target.checked)}
          />
          Frame and material counters
        </label>
        {performance && <WorkbenchDiagnostics />}
      </div>
    </details>
  );
}
