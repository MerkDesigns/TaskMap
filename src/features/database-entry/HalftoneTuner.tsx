import { useState } from "react";
import { Button } from "../../ui/primitives/Button";
import { Tabs } from "../../ui/primitives/Tabs";
import {
  DEFAULT_HALFTONE_SETTINGS,
  getHalftoneSettings,
  setHalftoneSettings,
  type HalftoneSettings,
} from "../../ui/patterns/halftone/halftoneSettings";
import "./halftoneTuner.css";

type Keys<Value> = {
  [Key in keyof HalftoneSettings]: HalftoneSettings[Key] extends Value ? Key : never;
}[keyof HalftoneSettings];

type Control =
  | {
      readonly kind: "range";
      readonly key: Keys<number>;
      readonly label: string;
      readonly min: number;
      readonly max: number;
      readonly step: number;
    }
  | { readonly kind: "toggle"; readonly key: Keys<boolean>; readonly label: string }
  | { readonly kind: "color"; readonly key: Keys<string>; readonly label: string };

type Tab = "dots" | "waves" | "color" | "pointer";

const CONTROLS: Record<Tab, readonly Control[]> = {
  dots: [
    { kind: "range", key: "opacity", label: "Overall opacity", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "cellSize", label: "Grid spacing (px)", min: 6, max: 32, step: 1 },
    {
      kind: "range",
      key: "maxDotSize",
      label: "Max dot size (× cell)",
      min: 0.05,
      max: 0.5,
      step: 0.01,
    },
    { kind: "range", key: "minDotSize", label: "Min dot size (px)", min: 0, max: 3, step: 0.05 },
    {
      kind: "range",
      key: "noiseScale",
      label: "Noise frequency",
      min: 0.0005,
      max: 0.012,
      step: 0.0001,
    },
    { kind: "range", key: "warp", label: "Flow warp", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 0.6, step: 0.005 },
    { kind: "range", key: "rangeLow", label: "Range low", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "rangeHigh", label: "Range high", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "minOpacity", label: "Min dot opacity", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "vibrance", label: "Accent vibrance", min: 0, max: 2.5, step: 0.05 },
    { kind: "range", key: "brightness", label: "Accent brightness", min: 0.3, max: 2, step: 0.02 },
  ],
  waves: [
    { kind: "range", key: "waveAmount", label: "Wave amount", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "waveAngle", label: "Angle (°)", min: 0, max: 360, step: 1 },
    { kind: "range", key: "waveLength", label: "Wavelength (px)", min: 60, max: 1600, step: 10 },
    { kind: "range", key: "waveSpeed", label: "Speed (waves/s)", min: -1, max: 1, step: 0.01 },
    { kind: "range", key: "waveBend", label: "Bend", min: 0, max: 1.5, step: 0.01 },
  ],
  color: [
    { kind: "range", key: "heatAmount", label: "Height → colour", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "heatCurve", label: "Highlight curve", min: 0.3, max: 4, step: 0.05 },
    { kind: "color", key: "shadowColor", label: "Low dots" },
    { kind: "color", key: "highlightColor", label: "High dots" },
    { kind: "toggle", key: "hazeEnabled", label: "Grayscale noise underneath" },
    { kind: "range", key: "hazeOpacity", label: "Noise opacity", min: 0, max: 0.6, step: 0.01 },
    {
      kind: "range",
      key: "hazeScale",
      label: "Noise frequency",
      min: 0.0002,
      max: 0.01,
      step: 0.0001,
    },
    { kind: "range", key: "hazeSpeed", label: "Noise speed (× dots)", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "hazeContrast", label: "Noise contrast", min: 0, max: 4, step: 0.05 },
  ],
  pointer: [
    { kind: "toggle", key: "pointerEnabled", label: "Follow the pointer" },
    { kind: "range", key: "pointerRadius", label: "Radius (px)", min: 20, max: 500, step: 5 },
    { kind: "range", key: "pointerStrength", label: "Strength", min: 0, max: 1.5, step: 0.01 },
    { kind: "range", key: "pointerGrowth", label: "Dot growth (×)", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "trailDuration", label: "Trail length (s)", min: 0, max: 5, step: 0.05 },
  ],
};

const TABS = [
  { value: "dots", label: "Dots" },
  { value: "waves", label: "Waves" },
  { value: "color", label: "Colour" },
  { value: "pointer", label: "Pointer" },
] as const;

const decimals = (step: number) => Math.max(0, -Math.floor(Math.log10(step)));

/** Development-only live tuner for the unlock-screen halftone; never shipped in stable builds. */
export default function HalftoneTuner() {
  const [stored, setSettings] = useState(getHalftoneSettings);
  // Filled from the defaults so settings added while hot-reloading never read as undefined.
  const settings: HalftoneSettings = { ...DEFAULT_HALFTONE_SETTINGS, ...stored };
  const [tab, setTab] = useState<Tab>("dots");
  const [open, setOpen] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const update = (next: HalftoneSettings) => {
    setSettings(next);
    setHalftoneSettings(next);
    setCopyState("idle");
  };
  const copy = () =>
    navigator.clipboard.writeText(JSON.stringify({ halftone: settings }, null, 2)).then(
      () => setCopyState("copied"),
      () => setCopyState("failed"),
    );

  const renderControl = (control: Control) => {
    switch (control.kind) {
      case "range":
        return (
          <label key={control.key} className="taskmap-halftone-tuner__row">
            <span className="taskmap-halftone-tuner__label">
              {control.label}
              <output>{settings[control.key].toFixed(decimals(control.step))}</output>
            </span>
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={settings[control.key]}
              onChange={(event) =>
                update({ ...settings, [control.key]: Number(event.target.value) })
              }
            />
          </label>
        );
      case "toggle":
        return (
          <label key={control.key} className="taskmap-halftone-tuner__label">
            {control.label}
            <input
              type="checkbox"
              checked={settings[control.key]}
              onChange={(event) => update({ ...settings, [control.key]: event.target.checked })}
            />
          </label>
        );
      case "color":
        return (
          <label key={control.key} className="taskmap-halftone-tuner__label">
            {control.label}
            <input
              type="color"
              value={settings[control.key]}
              onChange={(event) => update({ ...settings, [control.key]: event.target.value })}
            />
          </label>
        );
    }
  };

  return (
    <aside className="taskmap-halftone-tuner" aria-label="Halftone tuner">
      <header className="taskmap-halftone-tuner__header">
        <span>Halftone tuner</span>
        <Button size="compact" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"}
        </Button>
      </header>
      {open ? (
        <>
          <Tabs label="Tuner sections" items={TABS} value={tab} onValueChange={setTab} />
          {CONTROLS[tab].map(renderControl)}
          <div className="taskmap-halftone-tuner__actions">
            <Button size="compact" onClick={() => update(DEFAULT_HALFTONE_SETTINGS)}>
              Reset
            </Button>
            <Button size="compact" variant="primary" onClick={() => void copy()}>
              {copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Copy failed"
                  : "Copy values"}
            </Button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
