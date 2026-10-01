import { IconX } from "@tabler/icons-react";
import { ChangeEvent, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ACCENT_PRESETS } from "../constants";
import { useClampedFixedPosition } from "../useClampedFixedPosition";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import { IconButton } from "../ui/primitives/Button";
import { TextField } from "../ui/primitives/FormControls";
import { Slider } from "../ui/primitives/SelectionControls";
import "./ColorPickerMenu.css";

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

type ColorPickerMenuProps = {
  className?: string;
  /** Opened from a modal (e.g. Settings): render above modal scrims and dialogs. */
  aboveModals?: boolean;
  color: string;
  left: number;
  top: number;
  recentColors: string[];
  onChange: (color: string) => void;
  onClose: (recentColor?: string) => void;
};

const clampChannel = (value: number, max = 255) =>
  Math.min(max, Math.max(0, Number.isFinite(value) ? Math.round(value) : 0));

const componentToHex = (value: number) => clampChannel(value).toString(16).padStart(2, "0");

const rgbToHex = ({ r, g, b }: Rgb) =>
  `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`.toUpperCase();

const hexToRgb = (value: string): Rgb | null => {
  const hex = value.trim().replace(/^#/, "");
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => part + part)
          .join("")
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return null;
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

const colorToRgb = (color: string): Rgb => {
  const directHex = hexToRgb(color);
  if (directHex) {
    return directHex;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return { r: 71, g: 111, b: 168 };
  }

  context.fillStyle = "#476FA8";
  context.fillStyle = color;
  const normalized = context.fillStyle;
  const normalizedHex = hexToRgb(normalized);
  if (normalizedHex) {
    return normalizedHex;
  }

  const match = normalized.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  return match
    ? {
        r: clampChannel(Number(match[1])),
        g: clampChannel(Number(match[2])),
        b: clampChannel(Number(match[3])),
      }
    : { r: 71, g: 111, b: 168 };
};

const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(lightness * 100) };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === red) hue = 60 * (((green - blue) / delta) % 6);
  else if (max === green) hue = 60 * ((blue - red) / delta + 2);
  else hue = 60 * ((red - green) / delta + 4);

  return {
    h: Math.round((hue + 360) % 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
};

const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clampChannel(s, 100) / 100;
  const lightness = clampChannel(l, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = lightness - chroma / 2;
  let channels = [0, 0, 0];

  if (hue < 60) channels = [chroma, x, 0];
  else if (hue < 120) channels = [x, chroma, 0];
  else if (hue < 180) channels = [0, chroma, x];
  else if (hue < 240) channels = [0, x, chroma];
  else if (hue < 300) channels = [x, 0, chroma];
  else channels = [chroma, 0, x];

  return {
    r: Math.round((channels[0] + offset) * 255),
    g: Math.round((channels[1] + offset) * 255),
    b: Math.round((channels[2] + offset) * 255),
  };
};

const HUE_TRACK = "linear-gradient(90deg,#f44,#ff4,#4f4,#4ff,#44f,#f4f,#f44)";

/** Each slider track shows the colours its range produces at the current other channels. */
function sliderTrack(channel: "h" | "s" | "l", { h, s, l }: { h: number; s: number; l: number }) {
  if (channel === "h") return HUE_TRACK;
  if (channel === "s") return `linear-gradient(90deg,hsl(${h} 0% ${l}%),hsl(${h} 100% ${l}%))`;
  return `linear-gradient(90deg,hsl(${h} ${s}% 0%),hsl(${h} ${s}% 50%),hsl(${h} ${s}% 100%))`;
}

export function ColorPickerMenu({
  aboveModals = false,
  className,
  color,
  left,
  top,
  recentColors,
  onChange,
  onClose,
}: ColorPickerMenuProps) {
  const menuRef = useRef<HTMLElement | null>(null);
  const initialColorRef = useRef(rgbToHex(colorToRgb(color)));
  const currentColorRef = useRef(initialColorRef.current);
  // Every colour this picker emitted while open. Callers persist each change and echo it back later,
  // so a fast drag (hundreds of values) receives old echoes out of order; none may reset the editor.
  const emittedColorsRef = useRef(new Set<string>());
  const [rgb, setRgb] = useState(() => colorToRgb(color));
  const [hexDraft, setHexDraft] = useState(initialColorRef.current);
  // H/S/L are edited directly: deriving them from rounded RGB on every change made the other
  // sliders drift (and hue snap to 0 at low saturation) while dragging.
  const [hsl, setHsl] = useState(() => rgbToHsl(colorToRgb(color)));
  const position = useClampedFixedPosition(menuRef, { left, top });
  const closePicker = useCallback(() => {
    const finalColor = currentColorRef.current;
    onClose(finalColor === initialColorRef.current ? undefined : finalColor);
  }, [onClose]);

  useEffect(() => {
    const nextRgb = colorToRgb(color);
    // The parent echoes each emitted colour back; only external changes re-derive the editor state.
    const nextHex = rgbToHex(nextRgb);
    if (nextHex === currentColorRef.current || emittedColorsRef.current.has(nextHex)) return;
    currentColorRef.current = rgbToHex(nextRgb);
    setRgb(nextRgb);
    setHsl(rgbToHsl(nextRgb));
    setHexDraft(rgbToHex(nextRgb));
  }, [color]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        closePicker();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePicker();
      }
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closePicker]);

  const commitRgb = (nextRgb: Rgb, nextHsl?: Hsl) => {
    const normalized = {
      r: clampChannel(nextRgb.r),
      g: clampChannel(nextRgb.g),
      b: clampChannel(nextRgb.b),
    };
    setRgb(normalized);
    setHsl(nextHsl ?? rgbToHsl(normalized));
    const hex = rgbToHex(normalized);
    currentColorRef.current = hex;
    emittedColorsRef.current.add(hex);
    setHexDraft(hex);
    onChange(hex);
  };

  const changeRgbChannel = (channel: keyof Rgb, event: ChangeEvent<HTMLInputElement>) => {
    commitRgb({ ...rgb, [channel]: Number(event.target.value) });
  };

  const changeHslChannel = (channel: keyof Hsl, event: ChangeEvent<HTMLInputElement>) => {
    const max = channel === "h" ? 360 : 100;
    const nextHsl = { ...hsl, [channel]: clampChannel(Number(event.target.value), max) };
    commitRgb(hslToRgb(nextHsl), nextHsl);
  };

  const commitHex = () => {
    const nextRgb = hexToRgb(hexDraft);
    if (nextRgb) {
      commitRgb(nextRgb);
    } else {
      setHexDraft(rgbToHex(rgb));
    }
  };

  const swatch = (value: string, apply: string) => (
    <button
      key={value}
      type="button"
      className="taskmap-color-picker__swatch"
      style={{ backgroundColor: value }}
      onClick={() => commitRgb(colorToRgb(apply))}
      title={value}
      aria-label={value}
    />
  );

  return createPortal(
    <div className="taskmap-target-theme">
      <MaterialSurface
        ref={menuRef}
        material="opaque"
        radius={8}
        data-context-menu
        data-color-picker-menu
        role="dialog"
        aria-label="Extra colors"
        className={["taskmap-color-picker", className].filter(Boolean).join(" ")}
        style={{ ...position, zIndex: aboveModals ? "var(--taskmap-layer-modal-overlay)" : 1002 }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="taskmap-color-picker__header">
          <input
            type="color"
            value={rgbToHex(rgb)}
            onChange={(event) => commitRgb(colorToRgb(event.target.value))}
            className="taskmap-color-picker__native"
            title="Visual color picker"
          />
          <div className="taskmap-color-picker__identity">
            <div className="taskmap-color-picker__title">Extra colors</div>
            <div className="taskmap-color-picker__value">{rgbToHex(rgb)}</div>
          </div>
          <IconButton
            variant="ghost"
            size="compact"
            aria-label="Close"
            title="Close"
            onClick={closePicker}
            icon={<IconX size={17} stroke={2} />}
          />
        </div>

        <div className="taskmap-color-picker__row">
          <span className="taskmap-color-picker__label">Hex</span>
          <TextField
            className="taskmap-color-picker__hex"
            value={hexDraft}
            onChange={(event) => setHexDraft(event.target.value.toUpperCase())}
            onBlur={commitHex}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitHex();
                event.currentTarget.blur();
              }
            }}
            spellCheck={false}
            aria-label="Hex"
          />
        </div>

        <div className="taskmap-color-picker__row taskmap-color-picker__row--rgb">
          <span className="taskmap-color-picker__label">RGB</span>
          {(["r", "g", "b"] as const).map((channel) => (
            <TextField
              key={channel}
              className="taskmap-color-picker__number"
              type="number"
              min={0}
              max={255}
              value={rgb[channel]}
              onChange={(event) => changeRgbChannel(channel, event)}
              aria-label={channel.toUpperCase()}
            />
          ))}
        </div>

        <div className="taskmap-color-picker__sliders">
          {(["h", "s", "l"] as const).map((channel) => {
            const max = channel === "h" ? 360 : 100;
            const label = channel === "h" ? "Hue" : channel === "s" ? "Sat" : "Light";
            return (
              <label key={channel} className="taskmap-color-picker__slider-row">
                <span className="taskmap-color-picker__label">{label}</span>
                <Slider
                  className="taskmap-slider--marker"
                  min={0}
                  max={max}
                  step={1}
                  value={hsl[channel]}
                  onChange={(event) => changeHslChannel(channel, event)}
                  aria-label={label}
                  style={{ "--taskmap-slider-track": sliderTrack(channel, hsl) } as CSSProperties}
                />
                <span className="taskmap-color-picker__slider-value">{hsl[channel]}</span>
              </label>
            );
          })}
        </div>

        <div className="taskmap-color-picker__swatches">
          {ACCENT_PRESETS.map((preset) => swatch(preset.swatch, preset.accent))}
        </div>
        {recentColors.length > 0 && (
          <div className="taskmap-color-picker__recent">
            <div className="taskmap-color-picker__section-label">Recent</div>
            <div className="taskmap-color-picker__swatches taskmap-color-picker__swatches--plain">
              {recentColors.map((recentColor) => swatch(recentColor, recentColor))}
            </div>
          </div>
        )}
      </MaterialSurface>
    </div>,
    document.body,
  );
}
