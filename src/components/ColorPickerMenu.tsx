import { IconX } from "@tabler/icons-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ACCENT_PRESETS } from "../constants";
import { useClampedFixedPosition } from "../useClampedFixedPosition";

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

type ColorPickerMenuProps = {
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

const NUMBER_INPUT_CLASS =
  "h-8 w-full rounded-md border border-white/[0.12] bg-black/[0.20] px-2 text-center text-xs text-white outline-none focus:border-white/30";

export function ColorPickerMenu({
  color,
  left,
  top,
  recentColors,
  onChange,
  onClose,
}: ColorPickerMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initialColorRef = useRef(rgbToHex(colorToRgb(color)));
  const currentColorRef = useRef(initialColorRef.current);
  const [rgb, setRgb] = useState(() => colorToRgb(color));
  const [hexDraft, setHexDraft] = useState(initialColorRef.current);
  const hsl = useMemo(() => rgbToHsl(rgb), [rgb]);
  const position = useClampedFixedPosition(menuRef, { left, top });
  const closePicker = useCallback(() => {
    const finalColor = currentColorRef.current;
    onClose(finalColor === initialColorRef.current ? undefined : finalColor);
  }, [onClose]);

  useEffect(() => {
    const nextRgb = colorToRgb(color);
    setRgb(nextRgb);
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

  const commitRgb = (nextRgb: Rgb) => {
    const normalized = {
      r: clampChannel(nextRgb.r),
      g: clampChannel(nextRgb.g),
      b: clampChannel(nextRgb.b),
    };
    setRgb(normalized);
    const hex = rgbToHex(normalized);
    currentColorRef.current = hex;
    setHexDraft(hex);
    onChange(hex);
  };

  const changeRgbChannel = (channel: keyof Rgb, event: ChangeEvent<HTMLInputElement>) => {
    commitRgb({ ...rgb, [channel]: Number(event.target.value) });
  };

  const changeHslChannel = (channel: keyof Hsl, event: ChangeEvent<HTMLInputElement>) => {
    const max = channel === "h" ? 360 : 100;
    const nextHsl = { ...hsl, [channel]: clampChannel(Number(event.target.value), max) };
    commitRgb(hslToRgb(nextHsl));
  };

  const commitHex = () => {
    const nextRgb = hexToRgb(hexDraft);
    if (nextRgb) {
      commitRgb(nextRgb);
    } else {
      setHexDraft(rgbToHex(rgb));
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      data-color-picker-menu
      className="context-menu-enter fixed z-[1002] w-[286px] rounded-lg border border-white/[0.15] bg-[#1b1b1e] p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.52)]"
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center gap-2">
        <input
          type="color"
          value={rgbToHex(rgb)}
          onChange={(event) => commitRgb(colorToRgb(event.target.value))}
          className="h-9 w-12 cursor-pointer rounded-md border border-white/[0.14] bg-transparent p-0.5"
          title="Visual color picker"
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-white/90">Extra colors</div>
          <div className="text-[10px] uppercase text-white/42">{rgbToHex(rgb)}</div>
        </div>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          onClick={closePicker}
          title="Close"
        >
          <IconX size={18} stroke={2} />
        </button>
      </div>

      <div className="grid grid-cols-[44px_1fr] items-center gap-2">
        <label className="text-[11px] font-medium text-white/48">Hex</label>
        <input
          value={hexDraft}
          onChange={(event) => setHexDraft(event.target.value.toUpperCase())}
          onBlur={commitHex}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitHex();
              event.currentTarget.blur();
            }
          }}
          className="h-8 rounded-md border border-white/[0.12] bg-black/[0.20] px-2 text-xs uppercase text-white outline-none focus:border-white/30"
          spellCheck={false}
        />
      </div>

      <div className="mt-2 grid grid-cols-[44px_repeat(3,1fr)] items-center gap-2">
        <span className="text-[11px] font-medium text-white/48">RGB</span>
        {(["r", "g", "b"] as const).map((channel) => (
          <label key={channel} className="min-w-0">
            <span className="sr-only">{channel.toUpperCase()}</span>
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[channel]}
              onChange={(event) => changeRgbChannel(channel, event)}
              className={NUMBER_INPUT_CLASS}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {(["h", "s", "l"] as const).map((channel) => {
          const max = channel === "h" ? 360 : 100;
          const label = channel === "h" ? "Hue" : channel === "s" ? "Sat" : "Light";
          return (
            <label key={channel} className="grid grid-cols-[44px_1fr_34px] items-center gap-2">
              <span className="text-[11px] font-medium text-white/48">{label}</span>
              <input
                type="range"
                min={0}
                max={max}
                value={hsl[channel]}
                onChange={(event) => changeHslChannel(channel, event)}
                className="h-1.5 w-full cursor-pointer accent-white"
                style={
                  channel === "h"
                    ? { background: "linear-gradient(90deg,#f44,#ff4,#4f4,#4ff,#44f,#f4f,#f44)" }
                    : undefined
                }
              />
              <span className="text-right text-[11px] tabular-nums text-white/62">
                {hsl[channel]}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-3 border-t border-white/[0.10] pt-3">
        <div className="grid grid-cols-8 gap-1.5">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.swatch}
              type="button"
              className="h-6 rounded border border-white/[0.12] transition-transform hover:scale-110"
              style={{ backgroundColor: preset.swatch }}
              onClick={() => commitRgb(colorToRgb(preset.accent))}
              title={preset.swatch}
            />
          ))}
        </div>
      </div>
      {recentColors.length > 0 && (
        <div className="mt-2 border-t border-white/[0.08] pt-2">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/38">
            Recent
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {recentColors.map((recentColor) => (
              <button
                key={recentColor}
                type="button"
                className="h-6 rounded border border-white/[0.12] transition-transform hover:scale-110"
                style={{ backgroundColor: recentColor }}
                onClick={() => commitRgb(colorToRgb(recentColor))}
                title={recentColor}
              />
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
