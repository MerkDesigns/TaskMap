import { useState } from "react";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import { Field } from "../ui/primitives/Field";
import { Select } from "../ui/primitives/FormControls";
import { Slider } from "../ui/primitives/SelectionControls";
import { Surface } from "./system/Surface";
import type { SurfaceMaterial } from "./system/Material";

const MATERIAL_OPTIONS = [
  { value: "major-glass", label: "Major glass" },
  { value: "minor-glass", label: "Minor glass" },
  { value: "opaque", label: "Opaque" },
  { value: "cutout", label: "Cutout" },
] as const;

export function SurfaceMaterialPrototype() {
  const [material, setMaterial] = useState<SurfaceMaterial>("major-glass");
  const [width, setWidth] = useState(220);
  const [height, setHeight] = useState(112);
  const [radius, setRadius] = useState(23);

  return (
    <section className="taskmap-ui-lab-prototype" aria-labelledby="surface-material-title">
      <div className="taskmap-ui-lab-prototype__heading">
        <span className="taskmap-ui-lab__eyebrow">Experimental system boundary</span>
        <h2 id="surface-material-title">Surface + Material prototype</h2>
      </div>

      <div className="taskmap-ui-lab-prototype__samples">
        <Surface
          className="taskmap-ui-lab-prototype__surface taskmap-ui-lab-prototype__plain"
          data-prototype-sample="plain"
          radius={10}
        >
          <strong>Plain Surface</strong>
          <span>No Material</span>
        </Surface>

        <Surface
          className="taskmap-ui-lab-prototype__surface"
          data-prototype-sample="major-glass"
          material="major-glass"
          radius={23}
        >
          <strong>Surface</strong>
          <span>major-glass</span>
        </Surface>

        <MaterialSurface
          className="taskmap-ui-lab-prototype__surface"
          data-prototype-sample="direct-acrylic-large"
          material="acrylic-large"
          radius={23}
        >
          <strong>Direct reference</strong>
          <span>acrylic-large</span>
        </MaterialSurface>

        <Surface
          className="taskmap-ui-lab-prototype__surface"
          data-prototype-sample="minor-glass"
          material="minor-glass"
          radius={13.5}
        >
          <strong>Surface</strong>
          <span>minor-glass</span>
        </Surface>

        <Surface
          className="taskmap-ui-lab-prototype__surface"
          data-prototype-sample="opaque"
          material="opaque"
          radius={12}
        >
          <strong>Surface</strong>
          <span>opaque</span>
        </Surface>

        <Surface
          className="taskmap-ui-lab-prototype__surface"
          data-prototype-sample="cutout"
          material="cutout"
          radius={8}
        >
          <strong>Surface</strong>
          <span>cutout</span>
        </Surface>
      </div>

      <div className="taskmap-ui-lab-prototype__interactive">
        <div className="taskmap-ui-lab-prototype__controls">
          <Field label="Material">
            <Select
              aria-label="Prototype material"
              options={MATERIAL_OPTIONS}
              value={material}
              onValueChange={(value) => setMaterial(value as SurfaceMaterial)}
            />
          </Field>
          <RangeControl label="Width" value={width} min={140} max={300} onChange={setWidth} />
          <RangeControl label="Height" value={height} min={80} max={160} onChange={setHeight} />
          <RangeControl
            label="Corner radius"
            value={radius}
            min={0}
            max={32}
            onChange={setRadius}
          />
        </div>

        <Surface
          className="taskmap-ui-lab-prototype__interactive-surface"
          data-prototype-interactive="true"
          material={material}
          radius={radius}
          style={{ width, height }}
        >
          <strong>Interactive Surface</strong>
          <span>{material}</span>
          <span>
            {width} × {height} · {radius}px
          </span>
        </Surface>
      </div>
    </section>
  );
}

interface RangeControlProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
}

function RangeControl({ label, value, min, max, onChange }: RangeControlProps) {
  return (
    <Field label={`${label} · ${value}`}>
      <Slider
        aria-label={`Prototype ${label.toLowerCase()}`}
        min={min}
        max={max}
        value={value}
        onValueChange={onChange}
      />
    </Field>
  );
}
