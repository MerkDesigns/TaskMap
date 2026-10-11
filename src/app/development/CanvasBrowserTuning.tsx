import { useLayoutEffect, useState } from "react";

// Defaults match the shipped CSS in CanvasBrowser.css and CanvasBrowserCard.css.
const knobs = [
  {
    label: "Canvas card title",
    property: "--taskmap-canvas-card-title-size",
    initial: 14,
    min: 9,
    max: 22,
  },
  {
    label: "Canvas card subtitle",
    property: "--taskmap-canvas-card-subtitle-size",
    initial: 11,
    min: 8,
    max: 18,
  },
  {
    label: "Canvases title",
    property: "--taskmap-canvas-browser-title-size",
    initial: 16,
    min: 10,
    max: 26,
  },
  {
    label: "Heading offset X",
    property: "--taskmap-canvas-browser-heading-x",
    initial: 7.5,
    min: -20,
    max: 40,
  },
  {
    label: "Heading offset Y",
    property: "--taskmap-canvas-browser-heading-y",
    initial: 0,
    min: -20,
    max: 20,
  },
] as const;

/**
 * Development-only Canvas Browser typography and heading position: session overrides written as
 * variables on the document root, read the values off here to make them the shipped defaults.
 */
export function CanvasBrowserTuning() {
  const [values, setValues] = useState<readonly number[]>(knobs.map(({ initial }) => initial));

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    knobs.forEach(({ property }, index) => root.setProperty(property, `${values[index]}px`));
    return () => knobs.forEach(({ property }) => root.removeProperty(property));
  }, [values]);

  return (
    <>
      {knobs.map((knob, index) => (
        <label key={knob.property}>
          {knob.label}
          <input
            type="range"
            aria-label={knob.label}
            min={knob.min}
            max={knob.max}
            step={0.5}
            value={values[index]}
            onChange={(event) => {
              const next = [...values];
              next[index] = Number(event.target.value);
              setValues(next);
            }}
          />
          <output>{values[index]}px</output>
        </label>
      ))}
      <button type="button" onClick={() => setValues(knobs.map(({ initial }) => initial))}>
        Reset Canvas Browser tuning
      </button>
    </>
  );
}
