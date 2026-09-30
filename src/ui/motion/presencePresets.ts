import { cubicBezier } from "./motionMath";
import type { PresenceChannels, PresenceTiming } from "./presenceMotion";

/** JS equivalents of the theme's CSS easing tokens. */
export const EASE_STANDARD = cubicBezier(0.2, 0, 0, 1);
export const EASE_EMPHASIZED = cubicBezier(0.16, 1, 0.3, 1);

/**
 * Named channel combinations offered to surfaces (glass contract section 16). Components pick one;
 * the development workbench can preview alternatives on real panels.
 */
export const PRESENCE_PRESETS = Object.freeze({
  materialFade: { materialFade: true },
  materialFadeLift: { materialFade: true, lift: 10 },
  materialFadeScale: { materialFade: true, scale: 0.96 },
  materialFadeSlideUp: { materialFade: true, slide: { y: 16 } },
  materialFadeSlideLeft: { materialFade: true, slide: { x: -24 } },
  materialFadeLiftScale: { materialFade: true, lift: 10, scale: 0.97 },
  /** Retained dialog motion: a small upward settle with a slight scale. */
  materialFadeSettle: { materialFade: true, slide: { y: 6 }, scale: 0.98 },
  lift: { lift: 10 },
} satisfies Record<string, PresenceChannels>);

export type PresencePresetName = keyof typeof PRESENCE_PRESETS;

export const PRESENCE_PRESET_LABELS: Readonly<Record<PresencePresetName, string>> = {
  materialFade: "Material fade",
  materialFadeLift: "Material fade + Lift",
  materialFadeScale: "Material fade + Scale",
  materialFadeSlideUp: "Material fade + Slide up",
  materialFadeSlideLeft: "Material fade + Slide from left",
  materialFadeLiftScale: "Material fade + Lift + Scale",
  materialFadeSettle: "Material fade + Settle",
  lift: "Lift only",
};

/**
 * Menu presence timing: the original 220 ms emphasized / 160 ms standard keyframe timing, 20% slower
 * (user choice 2026-09-29 after trying 320/220 ms on `ease`, which felt too slow).
 */
export const MENU_PRESENCE_TIMING = Object.freeze({
  enter: { durationMs: 264, easing: EASE_EMPHASIZED } satisfies PresenceTiming,
  exit: { durationMs: 192, easing: EASE_STANDARD } satisfies PresenceTiming,
});

/** Channels for a named preset; names a surface cannot use fall back to its default preset. */
export function presetChannels(name: string, fallback: PresencePresetName): PresenceChannels {
  return name in PRESENCE_PRESETS
    ? PRESENCE_PRESETS[name as PresencePresetName]
    : PRESENCE_PRESETS[fallback];
}
