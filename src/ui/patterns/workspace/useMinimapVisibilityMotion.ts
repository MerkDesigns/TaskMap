import { useLayoutEffect, type RefObject } from "react";
import { presetChannels, type PresencePresetName } from "../../motion/presencePresets";
import { usePresenceMotion, usePresencePreset } from "../../motion/usePresenceMotion";

/** Retained production Minimap fade-out duration; App owns the matching unmount timer. */
export const MINIMAP_VISIBILITY_DURATION_MS = 500;
/** Fade in 50% faster than fade out. */
const MINIMAP_ENTER_DURATION_MS = MINIMAP_VISIBILITY_DURATION_MS / 2;

const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);
const ENTER = { durationMs: MINIMAP_ENTER_DURATION_MS, easing: smoothstep };
const EXIT = { durationMs: MINIMAP_VISIBILITY_DURATION_MS, easing: smoothstep };
const DEFAULT_PRESET: PresencePresetName = "materialFade";

/**
 * Minimap presence through the shared presence controller: glass fades through the material
 * presence variable and content fades on glass-free children, never ancestor opacity. The
 * workbench previews alternative presets.
 */
export function useMinimapVisibilityMotion(
  surfaceRef: RefObject<HTMLElement | null>,
  visible: boolean,
): void {
  const preset = usePresencePreset("minimap", DEFAULT_PRESET);
  const channels = presetChannels(preset, DEFAULT_PRESET);
  const presence = usePresenceMotion(surfaceRef, {
    channels,
    enter: ENTER,
    exit: EXIT,
    initialProgress: 0,
  });

  useLayoutEffect(() => {
    if (visible) presence.show();
    else presence.hide();
  }, [presence, visible]);
}
