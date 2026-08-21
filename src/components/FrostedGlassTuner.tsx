import { useEffect, useMemo, useState } from "react";

export type FrostedGlassValues = {
  bgOpacity: number;
  bgBrightness: number;
  borderOpacity: number;
  blur: number;
  shadowOpacity: number;
  shadowY: number;
  shadowBlur: number;
};

export type LeftPanelCardValues = {
  bgOpacity: number;
  outlineOpacity: number;
};

export type WorkspaceGeometryValues = {
  canvasBrowserRadius: number;
  canvasCardRadius: number;
  topBarRadius: number;
  sideInset: number;
  topInset: number;
};

type FrostedGlassTunerProps = {
  frostedValues: FrostedGlassValues;
  cardValues: LeftPanelCardValues;
  geometryValues: WorkspaceGeometryValues;
  onFrostedChange: (values: FrostedGlassValues) => void;
  onCardChange: (values: LeftPanelCardValues) => void;
  onGeometryChange: (values: WorkspaceGeometryValues) => void;
};

type RangeControl<Key> = {
  key: Key;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
};

const GLASS_CONTROLS: Array<RangeControl<keyof FrostedGlassValues>> = [
  { key: "bgOpacity", label: "Background", min: 0, max: 1, step: 0.01 },
  { key: "bgBrightness", label: "Brightness", min: 0, max: 1, step: 0.01 },
  { key: "borderOpacity", label: "Border", min: 0, max: 1, step: 0.01 },
  { key: "blur", label: "Blur", min: 0, max: 32, step: 1, suffix: "px" },
  { key: "shadowOpacity", label: "Shadow", min: 0, max: 1, step: 0.01 },
  { key: "shadowY", label: "Shadow Y", min: 0, max: 36, step: 1, suffix: "px" },
  { key: "shadowBlur", label: "Shadow blur", min: 0, max: 80, step: 1, suffix: "px" },
];

const CARD_CONTROLS: Array<RangeControl<keyof LeftPanelCardValues>> = [
  { key: "bgOpacity", label: "Card background", min: 0, max: 1, step: 0.01 },
  { key: "outlineOpacity", label: "Outline brightness", min: 0, max: 1, step: 0.01 },
];

const GEOMETRY_CONTROLS: Array<RangeControl<keyof WorkspaceGeometryValues>> = [
  { key: "canvasBrowserRadius", label: "Canvas Browser radius", min: 0, max: 40, step: 0.5 },
  { key: "canvasCardRadius", label: "Canvas card radius", min: 0, max: 24, step: 0.5 },
  { key: "topBarRadius", label: "Top bars radius", min: 0, max: 32, step: 0.5 },
  { key: "sideInset", label: "Side edge gap", min: 0, max: 48, step: 1 },
  { key: "topInset", label: "Top edge gap", min: 0, max: 48, step: 1 },
];

export function FrostedGlassTuner({
  frostedValues,
  cardValues,
  geometryValues,
  onFrostedChange,
  onCardChange,
  onGeometryChange,
}: FrostedGlassTunerProps) {
  const [tab, setTab] = useState<"glass" | "cards" | "geometry">("geometry");
  const activeValues =
    tab === "glass" ? frostedValues : tab === "cards" ? cardValues : geometryValues;
  const serializedValues = useMemo(() => JSON.stringify(activeValues, null, 2), [activeValues]);
  const [draft, setDraft] = useState(serializedValues);

  useEffect(() => {
    setDraft(serializedValues);
  }, [serializedValues]);

  return (
    <div className="frosted-glass fixed bottom-4 right-4 z-[80] w-[280px] rounded-xl border border-white/[0.15] bg-[#1b1b1e]/94 p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-sm">
      <div className="mb-2 flex rounded-lg border border-white/[0.10] bg-[#111216] p-0.5">
        <button
          className={`h-7 flex-1 rounded-md text-xs font-semibold transition-colors ${
            tab === "glass" ? "bg-white/[0.12] text-white" : "text-white/48 hover:text-white/72"
          }`}
          onClick={() => setTab("glass")}
        >
          Glass
        </button>
        <button
          className={`h-7 flex-1 rounded-md text-xs font-semibold transition-colors ${
            tab === "cards" ? "bg-white/[0.12] text-white" : "text-white/48 hover:text-white/72"
          }`}
          onClick={() => setTab("cards")}
        >
          Cards
        </button>
        <button
          className={`h-7 flex-1 rounded-md text-xs font-semibold transition-colors ${
            tab === "geometry" ? "bg-white/[0.12] text-white" : "text-white/48 hover:text-white/72"
          }`}
          onClick={() => setTab("geometry")}
        >
          Geometry
        </button>
      </div>

      {tab === "glass" ? (
        <div className="space-y-2">
          {GLASS_CONTROLS.map((control) => (
            <label key={control.key} className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-white/58">
                <span>{control.label}</span>
                <span className="font-mono text-white/72">
                  {frostedValues[control.key]}
                  {control.suffix ?? ""}
                </span>
              </div>
              <input
                className="taskmap-range [--taskmap-range-accent:#8aa0ff]"
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={frostedValues[control.key]}
                onChange={(event) =>
                  onFrostedChange({ ...frostedValues, [control.key]: Number(event.target.value) })
                }
              />
            </label>
          ))}
        </div>
      ) : tab === "cards" ? (
        <div className="space-y-2">
          {CARD_CONTROLS.map((control) => (
            <label key={control.key} className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-white/58">
                <span>{control.label}</span>
                <span className="font-mono text-white/72">{cardValues[control.key]}</span>
              </div>
              <input
                className="taskmap-range [--taskmap-range-accent:#8aa0ff]"
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={cardValues[control.key]}
                onChange={(event) =>
                  onCardChange({ ...cardValues, [control.key]: Number(event.target.value) })
                }
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {GEOMETRY_CONTROLS.map((control) => (
            <label key={control.key} className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-white/58">
                <span>{control.label}</span>
                <span className="font-mono text-white/72">{geometryValues[control.key]}px</span>
              </div>
              <input
                className="taskmap-range [--taskmap-range-accent:#8aa0ff]"
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={geometryValues[control.key]}
                onChange={(event) =>
                  onGeometryChange({
                    ...geometryValues,
                    [control.key]: Number(event.target.value),
                  })
                }
              />
            </label>
          ))}
        </div>
      )}

      <textarea
        className="mt-3 h-28 w-full resize-none rounded-lg border border-white/[0.10] bg-[#111216] p-2 font-mono text-[11px] leading-4 text-white/72 outline-none focus:border-white/[0.20]"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setDraft(serializedValues)}
        spellCheck={false}
      />
      <div className="mt-2 flex justify-end">
        <button
          className="rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-1 text-xs font-medium text-white/68 hover:bg-white/[0.10] hover:text-white"
          onClick={() => {
            try {
              if (tab === "glass") {
                const parsed = JSON.parse(draft) as Partial<FrostedGlassValues>;
                onFrostedChange({
                  bgOpacity: Number(parsed.bgOpacity ?? frostedValues.bgOpacity),
                  bgBrightness: Number(parsed.bgBrightness ?? frostedValues.bgBrightness),
                  borderOpacity: Number(parsed.borderOpacity ?? frostedValues.borderOpacity),
                  blur: Number(parsed.blur ?? frostedValues.blur),
                  shadowOpacity: Number(parsed.shadowOpacity ?? frostedValues.shadowOpacity),
                  shadowY: Number(parsed.shadowY ?? frostedValues.shadowY),
                  shadowBlur: Number(parsed.shadowBlur ?? frostedValues.shadowBlur),
                });
              } else if (tab === "cards") {
                const parsed = JSON.parse(draft) as Partial<LeftPanelCardValues>;
                onCardChange({
                  bgOpacity: Number(parsed.bgOpacity ?? cardValues.bgOpacity),
                  outlineOpacity: Number(parsed.outlineOpacity ?? cardValues.outlineOpacity),
                });
              } else {
                const parsed = JSON.parse(draft) as Partial<WorkspaceGeometryValues>;
                onGeometryChange({
                  canvasBrowserRadius: Number(
                    parsed.canvasBrowserRadius ?? geometryValues.canvasBrowserRadius,
                  ),
                  canvasCardRadius: Number(
                    parsed.canvasCardRadius ?? geometryValues.canvasCardRadius,
                  ),
                  topBarRadius: Number(parsed.topBarRadius ?? geometryValues.topBarRadius),
                  sideInset: Number(parsed.sideInset ?? geometryValues.sideInset),
                  topInset: Number(parsed.topInset ?? geometryValues.topInset),
                });
              }
            } catch {
              setDraft(serializedValues);
            }
          }}
        >
          Apply pasted values
        </button>
      </div>
    </div>
  );
}
