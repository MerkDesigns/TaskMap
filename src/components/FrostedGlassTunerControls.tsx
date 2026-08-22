import { useId } from "react";

type RangeControlProps = {
  defaultValue: number;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  suffix?: string;
  value: number;
};

export function TunerRange({
  defaultValue,
  label,
  max,
  min,
  onChange,
  step,
  suffix = "",
  value,
}: RangeControlProps) {
  const inputId = useId();
  return (
    <div className="block">
      <div className="mb-1 flex items-center justify-between text-xs text-white/58">
        <label htmlFor={inputId}>{label}</label>
        <div className="flex items-center gap-1">
          <span className="font-mono text-white/72">
            {value}
            {suffix}
          </span>
          <button
            type="button"
            aria-label={`Reset ${label}`}
            title={`Reset ${label}`}
            className="h-4 w-4 rounded text-[11px] leading-none text-white/40 hover:bg-white/[0.08] hover:text-white/75 disabled:opacity-25"
            disabled={value === defaultValue}
            onClick={() => onChange(defaultValue)}
          >
            ↺
          </button>
        </div>
      </div>
      <input
        id={inputId}
        className="taskmap-range [--taskmap-range-accent:#8aa0ff]"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

type ColorControlProps = {
  defaultValue: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
};

export function TunerColor({ defaultValue, label, name, onChange, value }: ColorControlProps) {
  const inputId = useId();
  return (
    <div className="flex items-center justify-between text-xs text-white/58">
      <label htmlFor={inputId}>{label}</label>
      <div className="flex items-center gap-1">
        <input
          id={inputId}
          aria-label={name}
          className="h-7 w-12 cursor-pointer rounded border border-white/[0.14] bg-transparent p-0.5"
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={`Reset ${label}`}
          title={`Reset ${label}`}
          className="h-4 w-4 rounded text-[11px] leading-none text-white/40 hover:bg-white/[0.08] hover:text-white/75 disabled:opacity-25"
          disabled={value.toLowerCase() === defaultValue.toLowerCase()}
          onClick={() => onChange(defaultValue)}
        >
          ↺
        </button>
      </div>
    </div>
  );
}
